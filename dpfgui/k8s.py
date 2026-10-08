"""Read-only access to a profile's clusters' Kubernetes APIs, for the browser.

Like the OpenShift console's backend: the page asks this app, and the app forwards the
request to the cluster's API with the kubeconfig's credentials, which never reach the page.
The API is reached through an SSH tunnel to the hypervisor, which can always reach it (it has
the cluster's names in /etc/hosts, and the lab network), whether or not this machine can.

Clusters: "mgmt" (the management cluster, with the kubeconfig fetched from Assisted
Installer) and "hc~<namespace>~<name>" (a hosted cluster, with the kubeconfig in the
secret its HostedCluster names on the management cluster).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import re
import socket
import ssl
import tempfile
import time
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import httpx
import yaml

from . import kubeconfigs, ssh
from .config import Profile


class K8sError(RuntimeError):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


# ── Kubeconfigs ──────────────────────────────────────────────────────────────


@dataclass
class Creds:
    host: str
    port: int
    ssl: ssl.SSLContext
    headers: dict[str, str] = field(default_factory=dict)
    sig: str = ""


def parse_kubeconfig(text: str) -> Creds:
    """The current context's server and credentials (client certificate or token)."""
    kc = yaml.safe_load(text) or {}
    by = lambda kind: {x["name"]: x.get(kind[:-1]) or {} for x in kc.get(kind) or []}  # noqa: E731
    ctx = by("contexts").get(kc.get("current-context")) or next(iter(by("contexts").values()), {})
    cluster = by("clusters").get(ctx.get("cluster")) or next(iter(by("clusters").values()), {})
    user = by("users").get(ctx.get("user")) or next(iter(by("users").values()), {})
    url = urlsplit(cluster.get("server") or "")
    if url.scheme != "https" or not url.hostname:
        raise K8sError("The kubeconfig has no https server")
    ctx_ssl = ssl.create_default_context()
    if cluster.get("insecure-skip-tls-verify"):
        ctx_ssl.check_hostname, ctx_ssl.verify_mode = False, ssl.CERT_NONE
    elif cluster.get("certificate-authority-data"):
        ctx_ssl.load_verify_locations(cadata=base64.b64decode(cluster["certificate-authority-data"]).decode())
    headers = {}
    if user.get("client-certificate-data") and user.get("client-key-data"):
        # The ssl module only loads certificates from files: write them privately, load, delete.
        with tempfile.TemporaryDirectory() as d:
            cert, key = os.path.join(d, "cert"), os.path.join(d, "key")
            for path, data in ((cert, user["client-certificate-data"]), (key, user["client-key-data"])):
                fd = os.open(path, os.O_WRONLY | os.O_CREAT, 0o600)
                with os.fdopen(fd, "wb") as f:
                    f.write(base64.b64decode(data))
            ctx_ssl.load_cert_chain(cert, key)
    elif user.get("token"):
        headers["Authorization"] = f"Bearer {user['token']}"
    else:
        raise K8sError("The kubeconfig has no client certificate or token")
    return Creds(url.hostname, url.port or 443, ctx_ssl, headers, hashlib.sha256(text.encode()).hexdigest())


# ── Tunnels through the hypervisor ───────────────────────────────────────────


_tunnels: dict[tuple, tuple[int, asyncio.subprocess.Process]] = {}
_tunnel_lock = asyncio.Lock()


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def _tunnel(p: Profile, host: str, port: int) -> int:
    """A local port forwarded to host:port as the hypervisor sees it (one SSH connection each)."""
    key = (p.target, host, port)
    async with _tunnel_lock:
        hit = _tunnels.get(key)
        if hit and hit[1].returncode is None:
            return hit[0]
        local = _free_port()
        argv = [a for a in ssh.ssh_argv(p) if a != "--"]
        # Its own connection (not the shared ControlMaster), so it lives and dies on its own.
        argv = [a if not a.startswith("ControlMaster=") else "ControlMaster=no" for a in argv]
        argv[1:1] = ["-N", "-o", "ExitOnForwardFailure=yes", "-L", f"127.0.0.1:{local}:{host}:{port}"]
        proc = await asyncio.create_subprocess_exec(*argv, stdin=asyncio.subprocess.DEVNULL,
                                                    stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
        deadline = time.time() + 20
        while time.time() < deadline:
            if proc.returncode is not None:
                err = (await proc.stderr.read()).decode(errors="replace").strip().splitlines()
                raise K8sError(f"Couldn't open a tunnel to {host}:{port} through {p.host}: {err[-1] if err else 'ssh exited'}")
            try:
                _, w = await asyncio.open_connection("127.0.0.1", local)
                w.close()
                break
            except OSError:
                await asyncio.sleep(0.2)
        else:
            proc.kill()
            raise K8sError(f"Timed out opening a tunnel to {host}:{port} through {p.host}")
        _tunnels[key] = (local, proc)
        return local


def close_tunnels() -> None:
    for _, proc in _tunnels.values():
        if proc.returncode is None:
            proc.kill()
    _tunnels.clear()


# ── Clients ──────────────────────────────────────────────────────────────────


@dataclass
class Client:
    creds: Creds
    http: httpx.AsyncClient
    at: float

    def build(self, path: str, params=None, headers=None) -> httpx.Request:
        # The tunnel is 127.0.0.1; TLS has to name the API server for its certificate to match.
        return self.http.build_request("GET", path, params=params, headers=headers,
                                       extensions={"sni_hostname": self.creds.host})

    async def get(self, path: str, params=None, headers=None) -> httpx.Response:
        return await self.http.send(self.build(path, params, headers))


_clients: dict[tuple[str, str], Client] = {}


def _mgmt_kubeconfig(name: str) -> str:
    for kind in ("mgmt", "mgmt-noingress"):
        f = kubeconfigs.path(name, kind)
        if f.exists():
            return f.read_text()
    raise K8sError("No kubeconfig for the management cluster yet", 409)


async def _kubeconfig(p: Profile, cluster: str) -> str:
    if cluster == "mgmt":
        return _mgmt_kubeconfig(p.name)
    parts = cluster.split("~")
    if len(parts) == 3 and parts[0] == "hc":
        ns, hc = parts[1], parts[2]
        mgmt = await client(p, "mgmt")
        r = await mgmt.get(f"/apis/hypershift.openshift.io/v1beta1/namespaces/{ns}/hostedclusters/{hc}")
        if r.status_code != 200:
            raise K8sError(f"No hosted cluster {ns}/{hc}", 404)
        st = r.json().get("status") or {}
        secret = (st.get("kubeconfig") or st.get("kubeConfig") or {}).get("name")
        if not secret:
            raise K8sError(f"{hc} has no kubeconfig yet", 409)
        r = await mgmt.get(f"/api/v1/namespaces/{ns}/secrets/{secret}")
        data = ((r.json() if r.status_code == 200 else {}).get("data") or {}).get("kubeconfig")
        if not data:
            raise K8sError(f"Couldn't read {hc}'s kubeconfig ({ns}/{secret})")
        return base64.b64decode(data).decode()
    raise K8sError(f"Unknown cluster {cluster}", 404)


_client_locks: dict[tuple[str, str], asyncio.Lock] = {}


def _usable(p: Profile, cluster: str, c: Client | None) -> bool:
    if not c:
        return False
    # Hosted clusters' kubeconfigs are looked up again every few minutes (they can be replaced).
    if cluster != "mgmt" and time.time() - c.at > 300:
        return False
    if cluster == "mgmt" and c.creds.sig != hashlib.sha256(_mgmt_kubeconfig(p.name).encode()).hexdigest():
        return False
    tunnel = _tunnels.get((p.target, c.creds.host, c.creds.port))
    return bool(tunnel and tunnel[1].returncode is None)


async def client(p: Profile, cluster: str) -> Client:
    """An HTTP client for the cluster's API, through a tunnel; rebuilt when the kubeconfig changes.
    One request builds it while the others wait (the page asks for a dozen lists at once)."""
    key = (p.name, cluster)
    if _usable(p, cluster, _clients.get(key)):
        return _clients[key]
    async with _client_locks.setdefault(key, asyncio.Lock()):
        old = _clients.get(key)
        if _usable(p, cluster, old):
            return old
        creds = parse_kubeconfig(await _kubeconfig(p, cluster))
        local = await _tunnel(p, creds.host, creds.port)
        http = httpx.AsyncClient(base_url=f"https://127.0.0.1:{local}", verify=creds.ssl, headers=creds.headers,
                                 timeout=httpx.Timeout(30, read=None))
        c = _clients[key] = Client(creds, http, time.time())
        if old:
            # Requests (and watches) may still be using it: close it once they've had time to end.
            asyncio.get_running_loop().call_later(600, lambda: asyncio.ensure_future(old.http.aclose()))
        return c


def forget(p: Profile, cluster: str) -> None:
    """Drop a client (e.g. its tunnel died); the next request builds a new one."""
    c = _clients.pop((p.name, cluster), None)
    if c:
        t = _tunnels.pop((p.target, c.creds.host, c.creds.port), None)
        if t and t[1].returncode is None:
            t[1].kill()


# ── What the browser may ask for ─────────────────────────────────────────────

# Subresources that act on the cluster (or open a shell) even though they're GETs.
BLOCKED = {"exec", "attach", "portforward", "proxy"}
META_LIST = "application/json;as=PartialObjectMetadataList;g=meta.k8s.io;v=v1"
META_ONE = "application/json;as=PartialObjectMetadata;g=meta.k8s.io;v=v1"
METADATA_ONLY = f"{META_LIST},{META_ONE}"  # no plain JSON to fall back to: metadata or nothing


def check_path(path: str, metadata_only: bool) -> dict[str, str]:
    """Headers to send for a read of `path`, or K8sError when the browser may not read it.
    Secrets come back without their data (metadata only), never with it."""
    parts = [x for x in path.split("/") if x]
    if not parts or parts[0] not in ("api", "apis", "version", "openapi"):
        raise K8sError("Not a Kubernetes API path", 400)
    if BLOCKED & set(parts):
        raise K8sError("Not allowed through this view", 403)
    if "secrets" in parts:
        # Secrets: only lists, and only their metadata (names, labels), never their data.
        if parts[-1] != "secrets":
            raise K8sError("Secrets aren't shown", 403)
        return {"Accept": META_LIST}
    return {"Accept": METADATA_ONLY} if metadata_only else {}


# ── Live lists for the page, over one WebSocket ──────────────────────────────


async def stream_list(p: Profile, cluster: str, path: str, params: dict, send) -> None:
    """List `path`, then watch it from that list's resourceVersion, sending
    {type: LIST, items} then {type: ADDED|MODIFIED|DELETED, object} until cancelled.
    Problems are sent as {type: ERROR, status, message}, then it tries again (a resource
    that doesn't exist yet, e.g. DPF's before deploy-dpf, each minute)."""
    headers = check_path(path, str((params or {}).get("_meta", "")) == "1")
    params = {k: v for k, v in (params or {}).items() if not str(k).startswith("_")}
    delay = 1
    while True:
        try:
            c = await client(p, cluster)
            r = await c.get("/" + path.lstrip("/"), params=params, headers=headers)
            if r.status_code != 200:
                raise K8sError((r.json() if "json" in r.headers.get("content-type", "") else {}).get("message") or f"HTTP {r.status_code}", r.status_code)
            body = r.json()
            rv = (body.get("metadata") or {}).get("resourceVersion")
            await send({"type": "LIST", "items": body.get("items") or []})
            delay = 1
            while True:  # watches end every few minutes; go on from the last version seen
                q = {**params, "watch": "1", "resourceVersion": rv, "allowWatchBookmarks": "true", "timeoutSeconds": "300"}
                resp = await c.http.send(c.build("/" + path.lstrip("/"), q, headers), stream=True)
                try:
                    if resp.status_code == 410:
                        break
                    if resp.status_code != 200:
                        raise K8sError(f"HTTP {resp.status_code}", resp.status_code)
                    gone = False
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        ev = json.loads(line)
                        o = ev.get("object") or {}
                        if ev.get("type") == "ERROR":
                            if o.get("code") == 410:
                                gone = True
                                break
                            raise K8sError(o.get("message") or "watch failed", o.get("code") or 502)
                        rv = (o.get("metadata") or {}).get("resourceVersion") or rv
                        if ev.get("type") != "BOOKMARK":
                            await send({"type": ev.get("type"), "object": o})
                    if gone:
                        break  # too old to resume: list again
                finally:
                    await resp.aclose()
        except asyncio.CancelledError:
            raise
        except K8sError as e:
            await send({"type": "ERROR", "status": e.status, "message": str(e)})
            await asyncio.sleep(60 if e.status == 404 else delay)
            delay = min(delay * 2, 30)
        except (httpx.HTTPError, ssh.SSHError, OSError, ValueError) as e:
            forget(p, cluster)
            await send({"type": "ERROR", "status": 502, "message": f"Couldn't reach the {cluster} API: {e}"})
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)


# ── Helm releases (their records are Secrets, so they're read and summarized here) ──

SENSITIVE = re.compile(r"pass(word|wd)?$|token|secret(key)?$|api.?key|private.?key|credential|auth$", re.I)


def _redact(v, key=""):
    if isinstance(v, dict):
        return {k: _redact(x, k) for k, x in v.items()}
    if isinstance(v, list):
        return [_redact(x, key) for x in v]
    if isinstance(v, str) and v and SENSITIVE.search(key or ""):
        return "•••"
    return v


def _decode_release(data: str) -> dict:
    import gzip
    raw = base64.b64decode(base64.b64decode(data))
    return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def _created(manifest: str) -> list[dict]:
    """Kind and name of each object a release's manifest creates."""
    out = []
    for doc in (manifest or "").split("\n---"):
        try:
            o = yaml.safe_load(doc)
        except yaml.YAMLError:
            continue
        if isinstance(o, dict) and o.get("kind"):
            out.append({"kind": o["kind"], "name": (o.get("metadata") or {}).get("name"), "namespace": (o.get("metadata") or {}).get("namespace")})
    return out


async def helm_releases(p: Profile, cluster: str = "mgmt", sources: dict[str, str] | None = None) -> list[dict]:
    """Every Helm release on the cluster (latest revision, plus its history), without its
    secrets: chart, versions, the values it was installed with (credentials masked), when,
    notes, and what it created. `sources`: settings with chart URLs, to say where a chart came from."""
    c = await client(p, cluster)
    r = await c.get("/api/v1/secrets", params={"labelSelector": "owner=helm"})
    if r.status_code != 200:
        raise K8sError(f"Couldn't list Helm releases: HTTP {r.status_code}", r.status_code)
    by: dict[tuple, list] = {}
    for sec in r.json().get("items") or []:
        lab = (sec.get("metadata") or {}).get("labels") or {}
        by.setdefault((sec["metadata"]["namespace"], lab.get("name")), []).append(sec)
    out = []
    for (ns, name), secs in sorted(by.items()):
        secs.sort(key=lambda x: int(((x["metadata"].get("labels") or {}).get("version")) or 0))
        latest = secs[-1]
        try:
            rel = _decode_release((latest.get("data") or {}).get("release", ""))
        except (ValueError, OSError):
            out.append({"namespace": ns, "name": name, "error": "Couldn't read its record"})
            continue
        meta, info = (rel.get("chart") or {}).get("metadata") or {}, rel.get("info") or {}
        chart = meta.get("name")
        src = None
        norm = name.upper().replace("-", "_")
        for key, url in (sources or {}).items():
            u = url.rstrip("/")
            # A setting that points at this chart: it ends with the chart's name, or it's named
            # after the release (DPU_WORKER_CONFIG_CHART_URL for dpu-worker-config)
            if u.endswith("/" + chart) or key.startswith(norm + "_"):
                src = {"setting": key, "url": u, "how": "chart"}
                break

        out.append({
            "namespace": ns, "name": name, "revision": rel.get("version"), "status": info.get("status"),
            "description": info.get("description"), "first_deployed": info.get("first_deployed"), "last_deployed": info.get("last_deployed"),
            "notes": info.get("notes") or "",
            "chart": {k: meta.get(k) for k in ("name", "version", "appVersion", "description", "home", "sources", "annotations", "type")},
            "dependencies": [{k: d.get(k) for k in ("name", "version", "repository", "condition", "enabled")} for d in meta.get("dependencies") or []],
            "values": _redact(rel.get("config") or {}),
            "created": _created(rel.get("manifest")),
            "source": src,
            "history": [{"revision": int((x["metadata"].get("labels") or {}).get("version") or 0), "status": (x["metadata"].get("labels") or {}).get("status"),
                         "at": x["metadata"].get("creationTimestamp")} for x in secs],
        })
    # Releases without such a setting: a repository setting named after the release's first word
    # (DPF_HELM_REPO_URL for dpf-operator, OVN_CHART_URL for ovn-kubernetes), not one that's
    # already another release's, or points at another chart.
    taken = {x["source"]["setting"] for x in out if x.get("source")}
    charts = {(x.get("chart") or {}).get("name") for x in out}
    for x in out:
        if x.get("source") or x.get("error"):
            continue
        first = x["name"].upper().replace("-", "_").split("_")[0] + "_"
        cands = sorted(((k, v.rstrip("/")) for k, v in (sources or {}).items()
                        if k.startswith(first) and k not in taken and not any(v.rstrip("/").endswith("/" + c) for c in charts if c)),
                       key=lambda kv: "REPO" not in kv[0])
        if cands:
            x["source"] = {"setting": cands[0][0], "url": cands[0][1], "how": "repository"}
            taken.add(cands[0][0])
    return out


async def helm_chart_files(p: Profile, namespace: str, name: str, cluster: str = "mgmt") -> dict:
    """A release's chart and what it installed, as files: Chart.yaml, the chart's default
    values.yaml, its templates and other files, the values it was installed with, and the
    rendered manifests, one per object (Secrets' data masked)."""
    c = await client(p, cluster)
    r = await c.get(f"/api/v1/namespaces/{namespace}/secrets", params={"labelSelector": f"owner=helm,name={name}"})
    if r.status_code != 200:
        raise K8sError(f"Couldn't read the release: HTTP {r.status_code}", r.status_code)
    secs = sorted(r.json().get("items") or [], key=lambda x: int(((x["metadata"].get("labels") or {}).get("version")) or 0))
    if not secs:
        raise K8sError(f"No Helm release {namespace}/{name}", 404)
    rel = _decode_release((secs[-1].get("data") or {}).get("release", ""))
    chart = rel.get("chart") or {}
    files: dict[str, str] = {}
    meta = {k: v for k, v in (chart.get("metadata") or {}).items() if v not in (None, "", [], {})}
    files["chart/Chart.yaml"] = yaml.safe_dump(meta, sort_keys=False, width=100000, allow_unicode=True)
    if chart.get("values"):
        files["chart/values.yaml"] = yaml.safe_dump(chart["values"], sort_keys=False, width=100000, allow_unicode=True)
    if chart.get("schema"):
        try:
            files["chart/values.schema.json"] = json.dumps(json.loads(base64.b64decode(chart["schema"])), indent=2)
        except (ValueError, TypeError):
            pass
    for group in ("templates", "files"):
        for f in chart.get(group) or []:
            try:
                files[f"chart/{f['name']}"] = base64.b64decode(f.get("data") or "").decode("utf-8", errors="replace")
            except (ValueError, TypeError):
                continue
    for dep in chart.get("dependencies") or []:  # subcharts, in the record as nested charts
        dm = (dep.get("metadata") or {}).get("name", "subchart")
        for f in dep.get("templates") or []:
            files[f"chart/charts/{dm}/{f['name']}"] = base64.b64decode(f.get("data") or "").decode("utf-8", errors="replace")
    files["installed/values.yaml"] = yaml.safe_dump(_redact(rel.get("config") or {}), sort_keys=False, width=100000, allow_unicode=True) if rel.get("config") else "# Installed with the chart's default values\n"
    if (rel.get("info") or {}).get("notes"):
        files["installed/NOTES.txt"] = rel["info"]["notes"]
    for doc in (rel.get("manifest") or "").split("\n---"):
        try:
            o = yaml.safe_load(doc)
        except yaml.YAMLError:
            continue
        if not isinstance(o, dict) or not o.get("kind"):
            continue
        if o["kind"] == "Secret":
            for k in ("data", "stringData"):
                if isinstance(o.get(k), dict):
                    o[k] = {x: "•••" for x in o[k]}
        m = o.get("metadata") or {}
        files[f"installed/manifests/{o['kind']}/{m.get('name', 'unnamed')}.yaml"] = yaml.safe_dump(o, sort_keys=False, width=100000, allow_unicode=True)
    return {"files": files, "chart": meta.get("name"), "version": meta.get("version")}
