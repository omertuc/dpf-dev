"""HBN subnet allocations from the nvidia-lab API.

Tracks who owns which VTEP slot on the shared HBN switch so the
settings editor can pick and validate VTEP_CIDR.
"""

from __future__ import annotations

import ipaddress
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from . import config, github

DEFAULT_BASE = "https://nvidia-lab.okoyl.xyz"
SOURCE_LABEL = "nvidia-lab"
class SubnetsError(RuntimeError):
    pass


# ── Preferences ─────────────────────────────────────────────────────────────


def _prefs_path() -> Path:
    return config.CONFIG_DIR / "app.json"


def _read_prefs() -> dict:
    try:
        return json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        return {}


def _base_url() -> str:
    return (_read_prefs().get("subnets") or {}).get("base_url") or DEFAULT_BASE


def save_base_url(url: str | None) -> None:
    data = _read_prefs()
    sub = data.setdefault("subnets", {})
    sub["base_url"] = (url or "").strip() or None
    config.CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    _prefs_path().write_text(json.dumps(data, indent=2) + "\n")
    _prefs_path().chmod(0o600)


# ── Fetching from the API ──────────────────────────────────────────────────


def _fetch_api(base: str) -> list[dict]:
    url = f"{base.rstrip('/')}/api/public/subnets"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "dpf-dev-gui"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SubnetsError(f"{url}: {e.code} {e.reason}")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        raise SubnetsError(f"Can't reach {url}: {getattr(e, 'reason', e)}")


def _parse_api(raw: list[dict]) -> dict:
    """API allocations -> the internal {subnets, ci} format."""
    all_emails = [
        s.get("assignee_username")
        for a in raw for sub in a.get("subnets") or [] for s in sub.get("slots") or []
        if s.get("assignee_username") and "@" in s["assignee_username"]
    ]
    email_map = github.resolve_emails(all_emails) if all_emails else {}

    subnets = []
    for alloc in raw:
        for sub in alloc.get("subnets") or []:
            slots = []
            for slot in sub.get("slots") or []:
                raw_owner = slot.get("assignee_username") or None
                owner = email_map.get(raw_owner, raw_owner) if raw_owner else None
                slots.append({
                    "id": slot.get("index", 0),
                    "cidr": slot["cidr"],
                    "owner": owner,
                    "kind": "user" if owner else None,
                    "description": slot.get("ci_description") or None,
                })
            subnets.append({"id": sub.get("index", 0), "cidr": sub["cidr"], "slots": slots})
    return {"subnets": subnets, "ci": {}}


# ── Loading ──────────────────────────────────────────────────────────────────


def load() -> dict:
    """{source_url, source_label, subnets, ci, error, base_url}."""
    base = _base_url()
    try:
        data = {**_parse_api(_fetch_api(base)), "error": None}
    except SubnetsError as e:
        data = {"subnets": [], "ci": {}, "error": str(e)}
    data["source_url"] = f"{base.rstrip('/')}/subnets"
    data["source_label"] = SOURCE_LABEL
    data["request_url"] = f"{base.rstrip('/')}/subnets"
    data["base_url"] = base
    return data


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
        msg = "Not in the shared HBN range"
        if mine:
            msg += f"; your slot is {mine[0]['cidr']}"
        elif me:
            msg += f"; you ({', '.join('@' + m for m in me)}) have no slot yet"
        else:
            msg += "; pick which GitHub users are you to see your slot"
        return [{"level": "warn", "message": msg, **({"fix": suggestion} if suggestion else {})}]
    others = [s for s in covered if s["owner"] and s["owner"] not in me]
    if others:
        who = ", ".join(sorted({"@" + s["owner"] for s in others}))
        return [{"level": "error", "message": f"Allocated to {who}", **({"fix": suggestion} if suggestion else {})}]
    free = [s for s in covered if not s["owner"]]
    if free:
        return [{"level": "warn", "message": f"{', '.join(s['cidr'] for s in free)} isn't allocated to anyone yet"}]
    names = ", ".join(f"subnet {s['subnet']} slot {s['id']}" for s in covered)
    issues = [{"level": "ok", "message": f"Your HBN allocation ({names})"}]
    if workers > len(covered):
        issues.append({"level": "error", "message": f"Room for {len(covered)} DPU node(s), but WORKER_COUNT is {workers}"})
    return issues
