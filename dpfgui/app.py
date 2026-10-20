from __future__ import annotations

import asyncio
import codecs
import contextlib
import hashlib
import json
import re
import shlex
import time
import urllib.error
import urllib.request
from pathlib import Path

import httpx
import yaml
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, dns, github, identity, jobs, k8s, kubeconfigs, machines, ops, schema as schema_mod, settings, ssh, subnets
from .config import ConfigError, Profile

STATIC = Path(__file__).parent / "static"

app = FastAPI(title="DPF Dev GUI")
app.mount("/static", StaticFiles(directory=STATIC), name="static")

# Kubeconfig fetches started automatically after a deploy job finishes.
_auto_fetch_tasks: dict[str, asyncio.Task] = {}


@app.exception_handler(ConfigError)
async def _config_error(_: Request, exc: ConfigError):
    return JSONResponse({"detail": str(exc)}, status_code=400)


@app.exception_handler(jobs.JobError)
async def _job_error(_: Request, exc: jobs.JobError):
    return JSONResponse({"detail": str(exc)}, status_code=409)


@app.exception_handler(ops.OpsError)
async def _ops_error(_: Request, exc: ops.OpsError):
    return JSONResponse({"detail": str(exc)}, status_code=400)


@app.exception_handler(ssh.SSHError)
async def _ssh_error(_: Request, exc: ssh.SSHError):
    return JSONResponse({"detail": str(exc)}, status_code=502)


def _draft(name: str, request: Request) -> Profile:
    """The profile, with the hypervisor the editor has picked but not saved yet
    (?_host=&_user=&_dir=), so the settings can be checked against it right away."""
    p = _profile(name)
    q = request.query_params
    host, user, d = q.get("_host"), q.get("_user"), q.get("_dir")
    if host is None:
        return p
    if not re.fullmatch(r"[\w.\-]*", host) or not re.fullmatch(r"[\w.\-]*", user or "") or (d and not d.startswith("/")) or "\n" in (d or ""):
        raise HTTPException(400, "Not a host name or path")
    return Profile(name=p.name, host=host, user=user or p.user, automation_dir=d or "", label=p.label, title=p.title, extra=p.extra)


def _profile(name: str) -> Profile:
    try:
        return config.get_profile(name)
    except (KeyError, ConfigError):
        raise HTTPException(404, f"No profile named {name!r}")


@app.get("/")
async def index():
    html = (STATIC / "index.html").read_text()
    for asset in ("app.js", "cards.js", "k8s.js", "browse.js", "style.css"):
        version = int((STATIC / asset).stat().st_mtime)
        html = html.replace(f"/static/{asset}", f"/static/{asset}?v={version}")
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})


# ── Profiles & config ────────────────────────────────────────────────────────


class ProfileIn(BaseModel):
    name: str = ""           # empty: pick the next free profile-<n>
    host: str = ""
    user: str = "root"
    automation_dir: str = ""
    label: str = ""
    title: str = ""
    copy_settings_from: str | None = None


class SettingsIn(BaseModel):
    settings: dict | None = None


@app.get("/api/profiles")
async def list_profiles():
    return [p.to_json() for p in config.list_profiles()]


@app.post("/api/profiles")
async def create_profile(body: ProfileIn):
    if not body.name:
        if not body.title.strip():
            raise HTTPException(400, "Give the profile a name")
        body.title = body.title.strip()
        body.name = config.name_for(body.title)
    config.validate_name(body.name)
    try:
        config.get_profile(body.name)
        raise HTTPException(409, f"Profile {body.name!r} already exists")
    except KeyError:
        pass
    # Duplicating a profile copies its settings.
    seed = config.profile_settings(_profile(body.copy_settings_from).name) if body.copy_settings_from else {}
    p = config.save_profile(Profile(**body.model_dump(exclude={"copy_settings_from"})), seed)
    return p.to_json()


@app.put("/api/profiles/{name}")
async def update_profile(name: str, body: ProfileIn):
    old = _profile(name)
    if body.name != name:
        raise HTTPException(400, "Renaming profiles is not supported")
    return config.save_profile(Profile(**body.model_dump(exclude={"copy_settings_from"}), extra=old.extra)).to_json()


@app.delete("/api/profiles/{name}")
async def delete_profile(name: str):
    _profile(name)
    config.delete_profile(name)
    return {"ok": True}


@app.get("/api/profiles/{name}/config")
async def get_config(name: str):
    p = _profile(name)
    rendered = config.render_user_env(name)
    return {
        "profile": p.to_json(),
        "settings": config.profile_settings(name),
        "sha256": config.sha256(rendered),
        "summary": config.config_summary(name),
    }


@app.put("/api/profiles/{name}/settings")
async def put_settings(name: str, body: SettingsIn):
    """Save a profile's settings."""
    _profile(name)
    if body.settings is not None:
        config.save_profile_settings(name, config.normalize_settings(body.settings))
        await asyncio.to_thread(ops.remember_workers, name)
    return {"ok": True}


@app.post("/api/profiles/{name}/config/analyze")
async def analyze_config(request: Request, name: str, body: SettingsIn):
    """Settings vs. repo defaults + validation. Pass an unsaved draft to validate it before saving."""
    p = _draft(name, request)
    if not p.ready:
        raise HTTPException(409, "No hypervisor picked yet")
    mine = config.normalize_settings(body.settings) if body.settings is not None else config.profile_settings(name)
    return await settings.analyze(p, mine)


# Version and tag lists for the settings editor; slow to fetch, so cached.
_lists_cache: dict[tuple, tuple[float, dict]] = {}
IMAGE_REPO_RE = re.compile(r"^[a-z0-9.\-]+(:\d+)?/[a-z0-9._\-/]+$")


async def _cached(key: tuple, ttl: float, fetch) -> dict:
    hit = _lists_cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    data = await fetch()
    if not data.get("error"):
        _lists_cache[key] = (time.time(), data)
    return data


@app.get("/api/profiles/{name}/ocp-versions")
async def ocp_versions(request: Request, name: str):
    """OpenShift versions Assisted Installer can install (asked via aicli on the hypervisor)."""
    p = _draft(name, request)

    async def fetch():
        r = await ssh.run(p, "aicli info service", timeout=60)
        m = re.search(r"supported openshift versions:\s*(\S+)", re.sub(r"\x1b\[[0-9;]*m", "", r.out))
        if not m:
            return {"error": "aicli info service didn't list any versions" + (f": {r.err.strip()[-200:]}" if r.err.strip() else "")}
        return {"versions": m.group(1).split(","), "source": "Assisted Installer"}

    return await _cached(("ocp", p.host), 3600, fetch)


@app.get("/api/profiles/{name}/image-tags")
async def image_tags(request: Request, name: str, repo: str, authfile: str = ""):
    """Tags of an image repository, read on the hypervisor with skopeo and the given pull secret."""
    p = _draft(name, request)
    if not IMAGE_REPO_RE.match(repo) or "\n" in authfile:
        raise HTTPException(400, "Not an image repository")

    async def fetch():
        auth = f"--authfile {shlex.quote(authfile)}" if authfile else ""
        script = f"cd {shlex.quote(p.automation_dir)} 2>/dev/null; timeout 40 skopeo list-tags {auth} docker://{shlex.quote(repo)}"
        r = await ssh.run(p, script, timeout=60)
        if r.rc != 0:
            msg = (r.err or r.out).strip().splitlines()
            return {"error": msg[-1][-300:] if msg else f"skopeo failed (exit {r.rc})"}
        return {"tags": json.loads(r.out).get("Tags") or []}

    return await _cached(("tags", p.host, repo, authfile), 600, fetch)


class HostCheckIn(BaseModel):
    host: str
    user: str = "root"
    automation_dir: str = ""
    profile: str = ""  # whose clone it would be


@app.post("/api/hosts/check")
async def host_check(body: HostCheckIn):
    """Can you log in to a host over ssh, and is the automation repo where you say it is?"""
    if not ops.valid_host(body.host, body.user, body.automation_dir):
        raise HTTPException(400, "Not a host name")

    async def fetch():
        return await ops.host_check(body.host, body.user, body.automation_dir)

    key = ("host", body.host, body.user, body.automation_dir)
    data = await _cached(key, 60, fetch)
    # A failed login, or a dir that isn't a clone (yet: a clone may be running), is asked again
    # next time rather than remembered.
    if data.get("login") is False or data.get("dir") in ("missing", "notrepo"):
        _lists_cache.pop(key, None)
    # Whose clone it is depends on the profiles here, which change without the hypervisor knowing.
    return ops.with_conflict(dict(data), body.profile, body.host, body.user, body.automation_dir) if body.profile else data
    return data


class FreeIpsIn(BaseModel):
    bridge: str
    exclude: list[str] = []


@app.post("/api/profiles/{name}/free-ips")
async def free_ips(request: Request, name: str, body: FreeIpsIn):
    """A few addresses in the bridge's subnet that nothing answers on (for the VIPs)."""
    return await ops.free_ips(_draft(name, request), body.bridge, body.exclude)


REMOTE_DHCP = (Path(__file__).parent / "remote_dhcp.py").read_text()


class DhcpLeaseIn(BaseModel):
    bridge: str
    mac: str
    want: str | None = None  # the address to ask for: what the DNS records already point at


@app.post("/api/profiles/{name}/dhcp-lease")
async def dhcp_lease(request: Request, name: str, body: DhcpLeaseIn):
    """Lease an address from the lab's DHCP for a VM's MAC (from the hypervisor, before the VM
    exists), so it's known for the DNS records and held for the VM. Asking again renews it."""
    p = _draft(name, request)
    if not re.fullmatch(r"[\w.\-]+", body.bridge) or not re.fullmatch(r"(?i)([0-9a-f]{2}:){5}[0-9a-f]{2}", body.mac):
        raise HTTPException(400, "Not a bridge name or MAC")
    if body.want and not re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", body.want):
        raise HTTPException(400, "Not an IPv4 address")

    async def fetch():
        args = json.dumps({"bridge": body.bridge, "mac": body.mac, "want": body.want})
        r = (await ssh.run(p, REMOTE_DHCP, interp=("python3", "-"), args=(args,), timeout=30)).check("Asking DHCP")
        return json.loads(r.out)

    return await _cached(("dhcp", p.host, body.bridge, body.mac.lower(), body.want), 120, fetch)


class DnsCheckIn(BaseModel):
    names: list[str]


@app.post("/api/profiles/{name}/dns-check")
async def dns_check(request: Request, name: str, body: DnsCheckIn):
    """The cluster's DNS records as the domain's own nameservers have them, asked from here
    without a resolver so no "doesn't exist" or old address gets cached (see dns.py). Lab
    domains are internal and already exist: those are looked up from the hypervisor.
    {records: {name: [ip]}, ttl: {name: s}, negative_ttl, via}"""
    p = _draft(name, request)
    names = [n.lower().rstrip(".") for n in body.names[:5] if re.fullmatch(r"[A-Za-z0-9.\-]+", n)]
    lab = await asyncio.to_thread(machines.load)
    if any(n.endswith(f".{dm['cluster']}.{dm['base']}") for dm in ops.lab_domains(lab) for n in names):
        script = "\n".join(
            f'echo "{n} $(dig +short +time=2 +tries=1 {shlex.quote(n)} A 2>/dev/null | grep -E \'^[0-9.]+$\' | tr \'\\n\' \' \')"' for n in names)
        r = (await ssh.run(p, "command -v dig >/dev/null || { echo NODIG; exit 0; }\n" + script, timeout=30)).check("Checking DNS")
        if r.out.strip() == "NODIG":
            return {"error": f"dig isn't installed on {p.host}"}
        return {"via": "hypervisor", "records": {n: ips.split() for n, _, ips in (l.partition(" ") for l in r.out.splitlines())}}
    try:
        found = await asyncio.gather(*(asyncio.to_thread(dns.lookup, n) for n in names))
    except (dns.DnsError, OSError) as e:
        return {"error": f"Couldn't ask the domain's nameservers: {e}"}
    return {"via": "authoritative", "records": {f["name"]: f["addresses"] for f in found},
            "ttl": {f["name"]: f.get("ttl") for f in found},
            "negative_ttl": next((f["negative_ttl"] for f in found if f.get("negative_ttl")), None)}


class BmcProbeIn(BaseModel):
    bmc: str
    user: str
    password: str
    host: str = ""


@app.post("/api/profiles/{name}/bmc-probe")
async def bmc_probe(request: Request, name: str, body: BmcProbeIn):
    """A DPU host's NICs from its BMC (Redfish), plus which one carries the host's address.
    Also tells whether the BMC login works."""
    p = _draft(name, request)

    async def fetch():
        return await ops.bmc_probe(p, body.bmc, body.user, body.password, body.host)

    key = ("bmc", p.host, body.bmc, body.user, hashlib.sha256(body.password.encode()).hexdigest(), body.host)
    return await _cached(key, 600, fetch)


@app.get("/api/bfb-files")
async def bfb_files(url: str):
    """The .bfb files next to a BFB URL, when its server offers a directory listing."""
    if not re.match(r"^https?://\S+/$", url):
        raise HTTPException(400, "Not a directory URL")

    def fetch_sync():
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                html = r.read(2_000_000).decode(errors="replace")
        except (urllib.error.URLError, OSError, ValueError) as e:
            return {"error": str(getattr(e, "reason", e))}
        files, seen = [], set()
        for m in re.finditer(r'href="([^"?/]+\.bfb)"(.{0,400}?class="date">([^<]+))?', html, re.S):
            if m.group(1) not in seen:
                seen.add(m.group(1))
                files.append({"name": m.group(1), "url": url + m.group(1), "date": (m.group(3) or "").strip()})
        return {"files": files}

    async def fetch():
        return await asyncio.to_thread(fetch_sync)

    return await _cached(("bfb", url), 600, fetch)


# ── HBN subnet allocations ───────────────────────────────────────────────────


def _subnets_view() -> dict:
    data = subnets.load()
    owners = sorted({s["owner"] for sub in data["subnets"] for s in sub["slots"] if s["kind"] == "user"})
    users = {}
    for o, gh in github.users(owners).items():
        avatar = (gh["avatar"] + ("&" if "?" in gh["avatar"] else "?") + "s=96") if gh["avatar"] else f"https://avatars.githubusercontent.com/{o}?s=96"
        users[o] = {"name": gh["name"], "avatar": avatar, "url": f"https://github.com/{o}"}
    used_by: dict[str, list[str]] = {}
    for p in config.list_profiles():
        v = config.active_values(config.profile_settings(p.name)).get("VTEP_CIDR")
        if v:
            used_by.setdefault(v, []).append(p.name)
    return {**data, "users": users, "used_by": used_by, "me": identity.me(), "options": ops.slot_options(data, identity.me())}


@app.get("/api/subnets")
async def get_subnets():
    return await asyncio.to_thread(_subnets_view)


class BaseUrlIn(BaseModel):
    url: str | None = None


@app.put("/api/subnets/base-url")
async def put_subnets_base_url(body: BaseUrlIn):
    await asyncio.to_thread(subnets.save_base_url, body.url)
    return await asyncio.to_thread(_subnets_view)


# ── Who you are ──────────────────────────────────────────────────────────────


class IdentityIn(BaseModel):
    me: str | None = None


@app.get("/api/identity")
async def get_identity(full: bool = False):
    return await asyncio.to_thread(identity.view if full else identity.quick)


@app.post("/api/identity/profiles")
async def identity_profiles(body: dict):
    logins = body.get("logins") or []
    return await asyncio.to_thread(identity.profiles, logins)


@app.put("/api/identity")
async def put_identity(body: IdentityIn):
    identity.set_me(body.me)
    return await asyncio.to_thread(identity.view)


# ── Lab machines ─────────────────────────────────────────────────────────────


def _machines_view(max_age: float = 120) -> dict:
    lab = machines.load(max_age)
    return {**lab, "me": identity.me(), "remembered": machines.remembered(),
            "domains": [{**dm, "values": ops.domain_values(dm)} for dm in ops.lab_domains(lab)]}


@app.get("/api/machines")
async def get_machines(refresh: bool = False):
    return await asyncio.to_thread(_machines_view, 0 if refresh else 120)


class DpuIn(BaseModel):
    settings: dict
    add: str | None = None      # a lab machine
    remove: int | None = None   # a worker number
    force: bool = False         # a machine allocated to someone else
    slots: list[int] = []       # the worker numbers the repo has settings for


@app.post("/api/profiles/{name}/dpus")
async def change_dpus(name: str, body: DpuIn):
    """Add or remove a DPU host on an (unsaved) draft of the settings; returns the new draft."""
    _profile(name)
    s = config.normalize_settings(body.settings)
    lab = await asyncio.to_thread(machines.load)
    if body.add:
        ops.add_dpu(name, s, lab, body.add, force=body.force, slots=body.slots or None)
    elif body.remove:
        ops.remove_dpu(name, s, lab, str(body.remove))
    return {"settings": s, "remembered": machines.remembered()}


# ── Status ───────────────────────────────────────────────────────────────────


@app.get("/api/profiles/{name}/status")
async def status(name: str, fetch: bool = False):
    p = _profile(name)
    rendered = config.render_user_env(name)
    local = {
        "summary": config.config_summary(name),
        "user_env_sha256": config.sha256(rendered),
        "kubeconfigs": kubeconfigs.local_info(name),
        "auto_fetch_running": name in _auto_fetch_tasks,
    }
    if not p.ready:
        return {"ok": False, "incomplete": True, "error": "Pick a hypervisor and the automation repo for this profile",
                "local": local, "profile": p.to_json()}
    t0 = time.time()
    try:
        remote = await ops.remote_status(p, fetch)
    except (ssh.SSHError, ValueError) as e:
        return {"ok": False, "error": str(e), "local": local, "profile": p.to_json()}
    remote["latency_ms"] = int((time.time() - t0) * 1000)
    _maybe_forget_cluster(p, remote.get("jobs") or [])
    _maybe_auto_fetch(p, remote.get("jobs") or [])
    _maybe_early_fetch(p, remote.get("jobs") or [])
    local["auto_fetch_running"] = name in _auto_fetch_tasks
    return {"ok": True, "remote": remote, "local": local, "profile": p.to_json()}


_ai_polled: dict[str, float] = {}


def _maybe_early_fetch(p: Profile, job_list: list[dict]) -> None:
    """While a deploy installs the management cluster, get its kubeconfigs from Assisted
    Installer as soon as it has them (once a minute), and keep checking until its API answers."""
    job = next((j for j in job_list if j.get("status") == "running" and j.get("fetch_kubeconfigs")
                and "install" in (j.get("stages") or [])), None)
    if not job or p.name in _auto_fetch_tasks or time.time() - _ai_polled.get(p.name, 0) < 60:
        return
    ai = kubeconfigs.load_meta(p.name).get("ai") or {}
    have = all(kubeconfigs.path(p.name, k).exists() for k in kubeconfigs.AI_FILES)
    if ai.get("job") == job["id"] and have and ai.get("api_up") and ai.get("status") == "installed":
        return  # done for this deploy
    _ai_polled[p.name] = time.time()

    async def run():
        try:
            await kubeconfigs.fetch(p, list(kubeconfigs.AI_FILES), job=job["id"])
        finally:
            _auto_fetch_tasks.pop(p.name, None)

    _auto_fetch_tasks[p.name] = asyncio.create_task(run())


def _maybe_forget_cluster(p: Profile, job_list: list[dict]) -> None:
    """After a clean-up that destroyed the VMs, the kubeconfigs fetched before point at nothing."""
    done = [j for j in job_list if j.get("status") not in ("running",)]
    if not done or done[0].get("status") != "succeeded":
        return
    job = done[0]  # newest first
    results = job.get("stage_results") or {}
    if not any(results.get(s) == 0 for s in ("clean", "clean-vms")) or "install" in results:
        return
    if kubeconfigs.load_meta(p.name).get("forgot_job") != job["id"]:
        kubeconfigs.forget_cluster(p.name, job["id"])


def _maybe_auto_fetch(p: Profile, job_list: list[dict]) -> None:
    """After a deploy that ran `make all` finishes, fetch kubeconfigs once."""
    if p.name in _auto_fetch_tasks:
        return
    done = [j for j in job_list if j.get("fetch_kubeconfigs") and j.get("status") not in ("running",)]
    if not done:
        return
    job = done[0]  # newest first
    if "install" not in (job.get("stage_results") or {}):
        return
    meta = kubeconfigs.load_meta(p.name)
    if meta.get("auto_job") == job["id"]:
        return

    async def run():
        try:
            await kubeconfigs.fetch_after_deploy(p, job["id"])
        finally:
            _auto_fetch_tasks.pop(p.name, None)

    _auto_fetch_tasks[p.name] = asyncio.create_task(run())


# ── Jobs ─────────────────────────────────────────────────────────────────────


class JobIn(BaseModel):
    stages: list[str]
    fetch_kubeconfigs: bool = False


@app.post("/api/profiles/{name}/jobs")
async def start_job(name: str, body: JobIn):
    p = _profile(name)
    unknown = set(body.stages) - set(jobs.STAGES)
    if unknown:
        raise HTTPException(400, f"Unknown stages: {', '.join(sorted(unknown))}")
    return await jobs.launch(p, body.stages, fetch_kubeconfigs=body.fetch_kubeconfigs)


@app.get("/api/profiles/{name}/branches")
async def branches(name: str, fetch: bool = False):
    """The clone's branches, newest first; with fetch, after fetching every remote."""
    return await jobs.branches(_profile(name), fetch)


class BranchIn(BaseModel):
    name: str
    remote: str | None = None


@app.post("/api/profiles/{name}/branch")
async def switch_branch(name: str, body: BranchIn):
    return {"branch": await jobs.switch_branch(_profile(name), body.name, body.remote)}


@app.get("/api/profiles/{name}/clone")
async def clone_info(name: str):
    """What deleting the profile's automation repo clone would lose."""
    return await jobs.clone_info(_profile(name))


@app.delete("/api/profiles/{name}/clone")
async def delete_clone(name: str):
    p = _profile(name)
    await jobs.delete_clone(p)
    # host_check remembers that it was a clone
    for key in [k for k in _lists_cache if k[:2] == ("host", p.host) and k[3:4] == (p.automation_dir,)]:
        _lists_cache.pop(key, None)
    return {"ok": True}


@app.post("/api/profiles/{name}/take-over")
async def take_over(name: str):
    """Make the automation repo clone this profile's, whichever profile or laptop it was marked for."""
    await jobs.take_over(_profile(name))
    return {"ok": True}


@app.post("/api/profiles/{name}/jobs/{job_id}/cancel")
async def cancel_job(name: str, job_id: str):
    await jobs.cancel(_profile(name), job_id)
    return {"ok": True}


@app.get("/api/profiles/{name}/jobs/{job_id}/stream")
async def stream_job(name: str, job_id: str, request: Request, offset: int = 0):
    """Server-sent events: `log` chunks (with byte offsets), then `done`."""
    p = _profile(name)
    try:
        offset = max(offset, int(request.headers.get("last-event-id", "0")))
    except ValueError:
        pass

    async def events():
        pos = offset
        decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        yield f"retry: 3000\nevent: hello\ndata: {json.dumps({'offset': pos})}\n\n"
        agen = jobs.stream_log(p, job_id, pos)
        pending = None
        try:
            pending = asyncio.ensure_future(agen.__anext__())
            while True:
                done, _ = await asyncio.wait({pending}, timeout=15)
                if not done:
                    yield ": keepalive\n\n"
                    continue
                try:
                    chunk = pending.result()
                except StopAsyncIteration:
                    break
                pos += len(chunk)
                text = decoder.decode(chunk)
                if text:
                    yield f"id: {pos}\nevent: log\ndata: {json.dumps({'t': text, 'o': pos})}\n\n"
                pending = asyncio.ensure_future(agen.__anext__())
            st = await jobs.job_status(p, job_id)
            if st["status"] == "running":
                # tail exited early (e.g. the connection dropped); let the client resume.
                yield f"event: reconnect\ndata: {json.dumps({'offset': pos})}\n\n"
            else:
                yield f"event: done\ndata: {json.dumps(st)}\n\n"
        except ssh.SSHError as e:
            yield f"event: failure\ndata: {json.dumps({'error': str(e), 'offset': pos})}\n\n"
        finally:
            if pending is not None and not pending.done():
                pending.cancel()
                with contextlib.suppress(BaseException):
                    await pending
            await agen.aclose()

    return StreamingResponse(
        events(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Kubeconfigs ──────────────────────────────────────────────────────────────


class FetchIn(BaseModel):
    kinds: list[str] = list(kubeconfigs.KINDS)


REMOTE_ACCOUNTS = (Path(__file__).parent / "remote_accounts.py").read_text()


@app.get("/api/profiles/{name}/accounts")
async def accounts(request: Request, name: str):
    """The Red Hat accounts the profile uses: aicli's login on the hypervisor and the
    OpenShift pull secret's owner (identities only, never credentials)."""
    p = _draft(name, request)
    if not p.ready:
        raise HTTPException(409, "No hypervisor picked yet")
    # The profile's pull secret, else the repo's default (what a deploy would use)
    pull = config.active_values(config.profile_settings(name)).get("OPENSHIFT_PULL_SECRET")
    default = not pull
    pull = pull or (schema_mod.load(None).params.get("OPENSHIFT_PULL_SECRET") or {}).get("default")

    async def fetch():
        args = json.dumps({"automation_dir": p.automation_dir, "pull_secret": pull, "default": default})
        r = await ssh.run(p, REMOTE_ACCOUNTS, interp=("python3", "-"), args=(args,), timeout=30)
        try:
            return json.loads(r.out)
        except ValueError:
            return {"error": (r.err or r.out).strip()[-300:] or f"exit {r.rc}"}

    return await _cached(("accounts", p.host, p.user, p.automation_dir, pull), 60, fetch)


# ── Kubernetes API, read-only, for the page (see k8s.py) ─────────────────────


@app.get("/api/profiles/{name}/k8s/{cluster}/{path:path}")
async def k8s_proxy(request: Request, name: str, cluster: str, path: str):
    """GET a cluster's API with the profile's kubeconfig. `watch=1` streams the watch events;
    `_meta=1` asks for metadata only; `_yaml=1` returns one object as YAML."""
    p = _profile(name)
    q = request.query_params
    params = [(k, v) for k, v in q.multi_items() if not k.startswith("_")]
    try:
        headers = k8s.check_path(path, q.get("_meta") == "1")
        c = await k8s.client(p, cluster)
    except k8s.K8sError as e:
        return JSONResponse({"message": str(e)}, status_code=e.status)
    except (ssh.SSHError, ValueError, OSError) as e:
        return JSONResponse({"message": str(e)}, status_code=502)
    watch = q.get("watch") in ("1", "true")
    if watch and not q.get("timeoutSeconds"):
        params.append(("timeoutSeconds", "300"))
    try:
        resp = await c.http.send(c.build("/" + path, params, headers), stream=watch)
    except httpx.HTTPError as e:
        k8s.forget(p, cluster)  # the tunnel may be gone; the next request opens a new one
        return JSONResponse({"message": f"Couldn't reach the {cluster} API: {e}"}, status_code=502)
    if not watch:
        if q.get("_yaml") == "1" and resp.status_code == 200:
            obj = resp.json()
            (obj.get("metadata") or {}).pop("managedFields", None)
            return {"yaml": yaml.safe_dump(obj, sort_keys=False, width=100000, allow_unicode=True)}
        return Response(resp.content, status_code=resp.status_code, media_type=resp.headers.get("content-type", "application/json"))

    async def events():
        try:
            async for chunk in resp.aiter_raw():
                yield chunk
        except httpx.HTTPError:
            pass  # the page re-watches from the last version it saw
        finally:
            await resp.aclose()

    return StreamingResponse(events(), status_code=resp.status_code, media_type="application/json")


@app.get("/api/profiles/{name}/helm-releases")
async def helm_releases(name: str, cluster: str = "mgmt"):
    """The cluster's Helm releases, summarized (their records are Secrets; nothing secret is sent)."""
    p = _profile(name)

    async def fetch():
        # The deployment's chart URLs (from the repo's .env on the hypervisor), to say where charts came from.
        sources = {}
        try:
            r = await ssh.run(p, f"cd {shlex.quote(p.automation_dir)} && grep -E '^(export )?[A-Z0-9_]*(CHART|HELM)[A-Z0-9_]*(URL|REPO)[A-Z0-9_]*=' .env || true", timeout=20)
            for line in r.out.splitlines():
                k, _, v = line.removeprefix("export ").partition("=")
                v = v.strip().strip("\"'")
                if v:
                    sources[k] = v
        except ssh.SSHError:
            pass
        try:
            return {"releases": await k8s.helm_releases(p, cluster, sources)}
        except k8s.K8sError as e:
            return {"error": str(e)}
        except (httpx.HTTPError, OSError) as e:
            k8s.forget(p, cluster)
            return {"error": f"Couldn't reach the {cluster} API: {e}"}

    return await _cached(("helm", name, cluster), 15, fetch)


@app.get("/api/profiles/{name}/helm-releases/{namespace}/{release}/files")
async def helm_release_files(name: str, namespace: str, release: str, cluster: str = "mgmt"):
    """A release's chart and what it installed, as files to browse (nothing secret is sent)."""
    p = _profile(name)
    try:
        return await k8s.helm_chart_files(p, namespace, release, cluster)
    except k8s.K8sError as e:
        raise HTTPException(e.status, str(e))
    except (httpx.HTTPError, OSError) as e:
        k8s.forget(p, cluster)
        raise HTTPException(502, f"Couldn't reach the {cluster} API: {e}")


@app.websocket("/api/profiles/{name}/k8s-live")
async def k8s_live(ws: WebSocket, name: str):
    """Every live list the page shows, over one connection (browsers allow only a few open
    HTTP connections per site, and each watch would hold one). The page sends
    {op: watch, id, cluster, path, params} and {op: cancel, id}; it gets {id, type, ...} back."""
    await ws.accept()
    try:
        p = _profile(name)
    except HTTPException as e:
        await ws.close(code=4404, reason=str(e.detail))
        return
    tasks: dict[int, asyncio.Task] = {}
    lock = asyncio.Lock()

    def sender(i: int):
        async def send(msg: dict) -> None:
            async with lock:
                await ws.send_json({"id": i, **msg})
        return send

    async def run(i: int, m: dict) -> None:
        try:
            await k8s.stream_list(p, m.get("cluster", "mgmt"), m.get("path", ""), m.get("params") or {}, sender(i))
        except k8s.K8sError as e:
            await sender(i)({"type": "ERROR", "status": e.status, "message": str(e), "final": True})

    try:
        while True:
            m = await ws.receive_json()
            i = m.get("id")
            if m.get("op") == "watch" and isinstance(i, int) and i not in tasks:
                tasks[i] = asyncio.create_task(run(i, m))
            elif m.get("op") == "cancel" and i in tasks:
                tasks.pop(i).cancel()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        for t in tasks.values():
            t.cancel()


@app.on_event("startup")
async def _warm_caches() -> None:
    asyncio.get_event_loop().run_in_executor(None, machines.load)
    asyncio.get_event_loop().run_in_executor(None, subnets.load)


@app.on_event("shutdown")
def _close_tunnels() -> None:
    k8s.close_tunnels()


@app.get("/api/profiles/{name}/cluster-install")
async def cluster_install(name: str):
    """The management cluster's install as Assisted Installer sees it (cached briefly)."""
    p = _profile(name)
    if not p.ready:
        raise HTTPException(409, "No hypervisor picked yet")

    async def fetch():
        try:
            return await kubeconfigs.ask_ai(p, details=True)
        except (kubeconfigs.KubeconfigError, ssh.SSHError) as e:
            return {"error": str(e)}

    return await _cached(("ai-install", name), 15, fetch)


@app.post("/api/profiles/{name}/kubeconfigs/fetch")
async def fetch_kubeconfigs(name: str, body: FetchIn):
    p = _profile(name)
    results = await kubeconfigs.fetch(p, body.kinds)
    return {"results": results, "kubeconfigs": kubeconfigs.local_info(name)}


@app.delete("/api/profiles/{name}/kubeconfigs/{kind}")
async def forget_kubeconfig(name: str, kind: str):
    """Remove a local copy (e.g. from a cluster that has since been destroyed)."""
    _profile(name)
    try:
        kubeconfigs.forget(name, kind)
    except KeyError:
        raise HTTPException(404)
    return {"kubeconfigs": kubeconfigs.local_info(name)}


@app.get("/api/profiles/{name}/kubeconfigs/{kind}")
async def download_kubeconfig(name: str, kind: str):
    _profile(name)
    try:
        f = kubeconfigs.path(name, kind)
    except KeyError:
        raise HTTPException(404)
    if not f.exists():
        raise HTTPException(404, "Not fetched yet")
    return FileResponse(f, filename=f"{name}-{kind}.kubeconfig", media_type="application/yaml")
