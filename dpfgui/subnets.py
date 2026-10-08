"""HBN subnet allocations (the dpf-allocations repo's hbn-subnets.yaml).

The file splits the shared HBN range into /28 subnets of two /29 slots each,
and assigns slots to GitHub users or CI clusters. A deployment's VTEP_CIDR
should be one of its owner's slots.

The source is `github:owner/repo[/path]` (the team's repo by default), read from a clone
the app keeps and pulls, or a local file such as a checkout you're editing.
"""

from __future__ import annotations

import ipaddress
import json
import subprocess
import re
import time
from pathlib import Path

import yaml

from . import config, github

DEFAULT_SOURCE = f"github:{github.ALLOCATIONS}/hbn-subnets.yaml"
_cache: dict = {"at": 0, "key": None, "data": None}


class SubnetsError(RuntimeError):
    pass


# ── Preferences (where the file lives) ──────────────────────────────────────


def _prefs_path() -> Path:
    return config.CONFIG_DIR / "app.json"


def prefs() -> dict:
    try:
        data = json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        data = {}
    sub = data.get("subnets") or {}
    return {"source": sub.get("source") or DEFAULT_SOURCE}


def save_prefs(source: str | None = None) -> dict:
    try:
        data = json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        data = {}
    sub = data.setdefault("subnets", {})
    if source is not None:
        sub["source"] = source.strip() or None
    config.CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    _prefs_path().write_text(json.dumps(data, indent=2) + "\n")
    _cache["at"] = 0
    return prefs()


# ── Loading ──────────────────────────────────────────────────────────────────


def _read_source(source: str, fresh: bool = False) -> str:
    try:
        return github.read_source(source, "hbn-subnets.yaml", fresh)
    except github.GitHubError as e:
        raise SubnetsError(str(e))


def _parse(text: str) -> dict:
    try:
        raw = yaml.safe_load(text) or {}
    except yaml.YAMLError as e:
        raise SubnetsError(f"Invalid YAML: {e}")
    ci = {str(k): (v or {}).get("description", "") for k, v in (raw.get("ci") or {}).items()}
    assignments = raw.get("assignments") or {}
    subnets = []
    for sid, sub in sorted((raw.get("subnets") or {}).items(), key=lambda kv: int(kv[0])):
        owners = assignments.get(sid) or assignments.get(str(sid)) or {}
        slots = []
        for slot_id, cidr in sorted((sub.get("slots") or {}).items(), key=lambda kv: int(kv[0])):
            owner = owners.get(slot_id, owners.get(str(slot_id)))
            owner = str(owner) if owner is not None else None
            slots.append({
                "id": int(slot_id), "cidr": str(cidr), "owner": owner,
                "kind": None if not owner else "ci" if owner in ci else "user",
                "description": ci.get(owner) if owner in ci else None,
            })
        subnets.append({"id": int(sid), "cidr": str(sub.get("cidr")), "slots": slots})
    return {"subnets": subnets, "ci": ci}


def load(max_age: float = 30) -> dict:
    """{source, subnets, ci, error}; cached briefly."""
    pr = prefs()
    key = pr["source"]
    if not (_cache["key"] == key and time.time() - _cache["at"] < max_age and _cache["data"]):
        _load(key, fresh=max_age == 0)
    return _cache["data"]


def request_url(source: str) -> str | None:
    """Where to ask for a slot: the allocations file in GitHub's web editor (saving an edit
    there opens a pull request). For a local file, from its checkout's origin remote."""
    try:
        spec = github.source_spec(source, "hbn-subnets.yaml")
    except github.GitHubError:
        return None
    if spec:
        return f"https://github.com/{spec[0]}/{spec[1]}/edit/main/{spec[2]}"
    path = Path(source).expanduser()
    try:
        top = subprocess.run(["git", "-C", str(path.parent), "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=5).stdout.strip()
        origin = subprocess.run(["git", "-C", top, "remote", "get-url", "origin"], capture_output=True, text=True, timeout=5).stdout.strip()
        branch = subprocess.run(["git", "-C", top, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return None
    m = re.match(r"^(?:git@github\.com:|https://github\.com/)([^/]+)/(.+?)(?:\.git)?$", origin)
    if not m or not top:
        return None
    rel = path.resolve().relative_to(Path(top).resolve()).as_posix()
    return f"https://github.com/{m.group(1)}/{m.group(2)}/edit/{branch.split('/', 1)[-1] or 'main'}/{rel}"


def _load(key: str, fresh: bool = False) -> None:
    try:
        data = {**_parse(_read_source(key, fresh)), "error": None}
    except SubnetsError as e:
        data = {"subnets": [], "ci": {}, "error": str(e)}
    data["source"] = key
    data["request_url"] = request_url(key)
    _cache.update(at=time.time(), key=key, data=data)


# ── Checking a VTEP_CIDR against the allocations ─────────────────────────────


def slots_of(data: dict, owners: list[str]) -> list[dict]:
    return [dict(s, subnet=sub["id"]) for sub in data["subnets"] for s in sub["slots"] if s["owner"] and s["owner"] in owners]


def check_vtep(cidr: str | None, data: dict, workers: int, me: list[str]) -> list[dict]:
    """Validation issues for a VTEP_CIDR value, given the allocations and your logins."""
    if not data.get("subnets"):
        return []
    mine = slots_of(data, me)
    try:
        net = ipaddress.IPv4Network(cidr or "", strict=False)
    except ValueError:
        return []
    hbn = [ipaddress.IPv4Network(s["cidr"]) for s in data["subnets"]]
    covered = [dict(slot, subnet=sub["id"]) for sub in data["subnets"] for slot in sub["slots"]
               if ipaddress.IPv4Network(slot["cidr"]).overlaps(net)]
    suggestion = None
    if mine:
        suggestion = {"op": "set", "key": "VTEP_CIDR", "value": mine[0]["cidr"], "label": f"Use your slot {mine[0]['cidr']}"}
    if not any(net.overlaps(h) for h in hbn):
        msg = f"Not in the shared HBN range, so it's not one of the dpf-allocations slots"
        if mine:
            msg += f"; your slot is {mine[0]['cidr']}"
        elif me:
            msg += f"; you ({', '.join('@' + m for m in me)}) have no slot yet"
        else:
            msg += "; pick which GitHub users are you to see your slot"
        return [{"level": "warn", "message": msg, **({"fix": suggestion} if suggestion else {})}]
    others = [s for s in covered if s["owner"] and s["owner"] not in me]
    if others:
        who = ", ".join(sorted({("CI " if s["kind"] == "ci" else "@") + s["owner"] for s in others}))
        return [{"level": "error", "message": f"Allocated to {who}", **({"fix": suggestion} if suggestion else {})}]
    free = [s for s in covered if not s["owner"]]
    if free:
        return [{"level": "warn", "message": f"{', '.join(s['cidr'] for s in free)} isn't allocated to anyone yet; request it in dpf-allocations first"}]
    names = ", ".join(f"subnet {s['subnet']} slot {s['id']}" for s in covered)
    issues = [{"level": "ok", "message": f"Your HBN allocation ({names})"}]
    if workers > len(covered):
        issues.append({"level": "error", "message": f"Room for {len(covered)} DPU node(s), but WORKER_COUNT is {workers}"})
    return issues
