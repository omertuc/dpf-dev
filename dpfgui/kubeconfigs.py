"""Fetch the management cluster and hosted (DPU) cluster kubeconfigs locally."""

from __future__ import annotations

import json
import os
import re
import shlex
import time
from pathlib import Path

from . import config, ssh
from .config import Profile

KINDS = {
    "mgmt-noingress": "Management cluster (noingress)",
    "mgmt": "Management cluster",
    "hcp": "Hosted cluster",
}

# The management cluster's come straight from Assisted Installer (as soon as it has them):
# kubeconfig-noingress from the start of the install, the full kubeconfig later.
AI_FILES = {"mgmt-noingress": "kubeconfig-noingress", "mgmt": "kubeconfig"}
REMOTE_AI = (Path(__file__).parent / "remote_ai.py").read_text()

# Decodes the hosted cluster admin secret on the hypervisor (python3 is always
# there; jq might not be). Prefers super-admin.conf like the old just recipe.
_DECODE = (
    "import base64,json,sys\n"
    "d=json.load(sys.stdin).get('data') or {}\n"
    "k=next((k for k in ('super-admin.conf','kubeconfig','admin.conf') if k in d), None) or next(iter(d), None)\n"
    "k or sys.exit('secret has no data')\n"
    "sys.stdout.write(base64.b64decode(d[k]).decode())\n"
)


# Where the automation repo's DPF operator puts <HOSTED_CLUSTER_NAME>-admin-kubeconfig.
HCP_SECRET_NAMESPACE = "dpf-operator-system"


class KubeconfigError(RuntimeError):
    pass


def path(name: str, kind: str) -> Path:
    if kind not in KINDS:
        raise KeyError(kind)
    return config.kubeconfig_dir(name) / f"{kind}.kubeconfig"


def _meta_path(name: str) -> Path:
    d = config.state_dir() / "kubeconfigs"
    d.mkdir(exist_ok=True, mode=0o700)
    return d / f"{config.validate_name(name)}.json"


def load_meta(name: str) -> dict:
    try:
        return json.loads(_meta_path(name).read_text())
    except (OSError, ValueError):
        return {}


def save_meta(name: str, meta: dict) -> None:
    p = _meta_path(name)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(meta, indent=2))
    os.replace(tmp, p)


def server_of(text: str) -> str | None:
    m = re.search(r"^\s*server:\s*(\S+)", text, re.M)
    return m.group(1) if m else None


def local_info(name: str) -> dict:
    meta = load_meta(name)
    out = {}
    for kind, label in KINDS.items():
        f = path(name, kind)
        entry = {"label": label, "path": str(f), "exists": f.exists()}
        if f.exists():
            entry["fetched_at"] = int(f.stat().st_mtime)
            entry["server"] = server_of(f.read_text())
        entry["error"] = meta.get("errors", {}).get(kind)
        out[kind] = entry
    out["auto"] = {k: meta.get(k) for k in ("auto_job", "auto_at")}
    out["ai"] = meta.get("ai")
    return out


def forget(name: str, kind: str) -> None:
    path(name, kind).unlink(missing_ok=True)
    meta = load_meta(name)
    meta.get("errors", {}).pop(kind, None)
    save_meta(name, meta)


def forget_cluster(name: str, job: str) -> None:
    """The deployment was destroyed (by `job`): its kubeconfigs and what Assisted Installer
    said about it are history."""
    for kind in KINDS:
        path(name, kind).unlink(missing_ok=True)
    meta = load_meta(name)
    for k in ("ai", "errors", "auto_job", "auto_at"):
        meta.pop(k, None)
    meta["forgot_job"] = job
    save_meta(name, meta)


def _write(name: str, kind: str, text: str) -> None:
    if "clusters" not in text or "server:" not in text:
        raise KubeconfigError("Fetched data does not look like a kubeconfig")
    f = path(name, kind)
    tmp = f.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as fh:
        fh.write(text)
    os.replace(tmp, f)


def _remote_kubeconfig_script(p: Profile) -> str:
    d = shlex.quote(p.automation_dir)
    name, domain = cluster_of(p)
    # The file .env names may be another cluster's (other profiles use the same checkout).
    api = shlex.quote(f"https://api.{name}.{domain}:")
    return f"""
cd {d} || exit 3
kc=$(sed -n 's/^\\(export \\)\\{{0,1\\}}KUBECONFIG=//p' .env 2>/dev/null | tail -1 | tr -d "\\"'")
[ -n "$kc" ] || {{ echo "KUBECONFIG is not set in {p.automation_dir}/.env" >&2; exit 3; }}
case "$kc" in /*) ;; *) kc="$PWD/$kc" ;; esac
[ -s "$kc" ] || {{ echo "$kc does not exist yet (has the cluster been installed?)" >&2; exit 3; }}
grep -qF {api} "$kc" || {{ echo "The hypervisor has no kubeconfig for {name} yet" >&2; exit 3; }}
"""


def cluster_of(p: Profile) -> tuple[str | None, str | None]:
    vals = config.active_values(config.profile_settings(p.name))
    vals = {**config.app_defaults(p.name, vals), **vals}
    return vals.get("CLUSTER_NAME"), vals.get("BASE_DOMAIN")


async def ask_ai(p: Profile, details: bool = False) -> dict:
    """The management cluster on Assisted Installer, its kubeconfigs and whether its API answers
    (or with details: its install's progress, hosts, operators and events)."""
    name, domain = cluster_of(p)
    if not name or not domain:
        raise KubeconfigError("CLUSTER_NAME and BASE_DOMAIN aren't set")
    args = json.dumps({"automation_dir": p.automation_dir, "cluster": name, "domain": domain, "details": details})
    res = await ssh.run(p, REMOTE_AI, interp=("python3", "-"), args=(args,), timeout=90)
    try:
        out = json.loads(res.out)
    except ValueError:
        raise KubeconfigError((res.err or res.out).strip().splitlines()[-1] if (res.err or res.out).strip() else f"exit {res.rc}")
    if out.get("error"):
        raise KubeconfigError(out["error"])
    out["name"] = f"{name}.{domain}"
    return out


async def fetch(p: Profile, kinds: list[str], job: str | None = None) -> dict:
    """Fetch the requested kubeconfigs. Returns per-kind {ok, error}."""
    meta = load_meta(p.name)
    errors = meta.setdefault("errors", {})
    results: dict[str, dict] = {}
    ai, ai_error = None, None
    if any(k in AI_FILES for k in kinds):
        try:
            ai = await ask_ai(p)
            meta["ai"] = {**(ai.get("cluster") or {}), "name": ai["name"], "api_up": ai.get("api_up"),
                          "at": int(time.time()), "job": job or (meta.get("ai") or {}).get("job")}
        except (KubeconfigError, ssh.SSHError) as e:
            ai_error = str(e)
    for kind in [k for k in KINDS if k in kinds]:
        try:
            if kind in AI_FILES:
                if ai_error:
                    raise KubeconfigError(f"Couldn't ask Assisted Installer: {ai_error}")
                text = (ai.get("files") or {}).get(AI_FILES[kind])
                if text:
                    _write(p.name, kind, text)
                    errors.pop(kind, None)
                    results[kind] = {"ok": True}
                    continue
                if not ai.get("cluster") and kind == "mgmt-noingress":
                    # Not on Assisted Installer (any more): the repo keeps a copy of this one
                    script = _remote_kubeconfig_script(p) + 'cat "$kc"\n'
                elif not ai.get("cluster"):
                    raise KubeconfigError(f"Assisted Installer has no cluster called {ai['name']}")
                else:
                    raise KubeconfigError(f"Assisted Installer doesn't have it yet (the cluster is {ai['cluster'].get('status')})")
            else:
                hosted = (
                    "hcn=$(sed -n 's/^\\(export \\)\\{0,1\\}HOSTED_CLUSTER_NAME=//p' .env | tail -1 | tr -d \"\\\"'\")\n"
                    'hcn=${hcn:-doca}\n'
                )
                script = _remote_kubeconfig_script(p) + hosted + (
                    f'secret=$(oc --kubeconfig "$kc" --request-timeout=20s -n {HCP_SECRET_NAMESPACE} '
                    f'get secret "$hcn-admin-kubeconfig" -o json 2>&1) || '
                    '{ echo "$secret" | grep -v "^\\s*$" | tail -1 >&2; exit 1; }\n'
                    f'printf "%s" "$secret" | python3 -c {shlex.quote(_DECODE)}\n'
                )
            res = await ssh.run(p, script, timeout=60)
            if res.rc != 0:
                msg = (res.err or res.out).strip().splitlines()
                raise KubeconfigError(msg[-1] if msg else f"exit {res.rc}")
            _write(p.name, kind, res.out)
            errors.pop(kind, None)
            results[kind] = {"ok": True}
        except (KubeconfigError, ssh.SSHError) as e:
            errors[kind] = {"message": str(e), "at": int(time.time())}
            results[kind] = {"ok": False, "error": str(e)}
    save_meta(p.name, meta)
    return results


async def fetch_after_deploy(p: Profile, job_id: str) -> dict:
    """Fetch every kubeconfig once a deploy that ran `make all` has finished, and mark the job
    done, so whoever notices it next (the app's status poll or the command line) doesn't again."""
    try:
        return await fetch(p, list(KINDS))
    finally:
        m = load_meta(p.name)
        m.update(auto_job=job_id, auto_at=int(time.time()))
        save_meta(p.name, m)
