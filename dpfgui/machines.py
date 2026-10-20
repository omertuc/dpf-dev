"""Lab machine allocations from the nvidia-lab API.

Tracks hypervisors and DPU workers so the team can see who's using
what without digging through a spreadsheet.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from . import config, github

API_URL = "https://nvidia-lab.okoyl.xyz/api/public/machines"
SOURCE_URL = "https://nvidia-lab.okoyl.xyz/machines?q=Bluefield&view=ownership"
SOURCE_LABEL = "nvidia-lab"
_cache: dict = {"at": 0, "data": None}


class MachinesError(RuntimeError):
    pass


def _prefs_path() -> Path:
    return config.CONFIG_DIR / "app.json"


def _write(data: dict) -> None:
    config.CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    _prefs_path().write_text(json.dumps(data, indent=2) + "\n")
    _prefs_path().chmod(0o600)


REMEMBERED_FIELDS = ("BMC_USER", "BMC_PASSWORD", "BOOT_MAC", "ROOT_DEVICE", "DPU")


def remembered() -> dict[str, dict[str, str]]:
    try:
        data = json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        return {}
    return (data.get("machines") or {}).get("remembered") or {}


def remember(machine: str, values: dict[str, str], source: str = "") -> None:
    """Keep a machine's worker values; `source` is the profile they came from (shown in the UI)."""
    values = {k: str(v) for k, v in values.items() if k in REMEMBERED_FIELDS and v not in (None, "")}
    if not values:
        return
    if source:
        values["_from"] = source
    try:
        data = json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        data = {}
    mem = data.setdefault("machines", {}).setdefault("remembered", {})
    mem[machine] = {**mem.get(machine, {}), **values}
    _write(data)


# ── Machines from the API ────────────────────────────────────────────────────


def _fetch_api() -> list[dict]:
    req = urllib.request.Request(API_URL, headers={"Accept": "application/json", "User-Agent": "dpf-dev-gui"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise MachinesError(f"{API_URL}: {e.code} {e.reason}")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        raise MachinesError(f"Can't reach {API_URL}: {getattr(e, 'reason', e)}")


def _parse_api(raw: list[dict]) -> list[dict]:
    """API machines → sections (Hypervisors, DPU workers)."""
    all_emails = [u for m in raw for u in (m.get("users") or []) if "@" in u]
    email_map = github.resolve_emails(all_emails) if all_emails else {}

    sections: list[dict] = []

    hypervisors = [_machine(m, "Hypervisor", email_map) for m in raw if m.get("type") == "Hypervisor" and not m.get("archived")]
    if hypervisors:
        sections.append({"name": "Hypervisors", "machines": hypervisors})

    workers = [_machine(m, "DPU Worker", email_map) for m in raw
               if m.get("type") == "Worker" and not m.get("archived")
               and (m.get("hardware_summary") or {}).get("dpu_models")]
    if workers:
        sections.append({"name": "DPU workers", "machines": workers})

    return sections


def _machine(m: dict, typ: str, email_map: dict[str, str]) -> dict:
    fqdn = m.get("fqdn") or ""
    short = fqdn.split(".")[0] if fqdn else str(m.get("id", ""))
    hw = m.get("hardware_summary") or {}
    features = []
    for name in (hw.get("dpu_models") or {}):
        features.append(f"DPU: {name}")
    for name in (hw.get("gpu_models") or {}):
        features.append(f"GPU: {name}")
    users = [email_map.get(u, u) for u in (m.get("users") or [])]
    clusters = m.get("clusters") or []
    cluster = clusters[0].get("cluster_name") if clusters else None
    return {
        "id": short,
        "type": typ,
        "address": fqdn,
        "short": short,
        "bmc": m.get("bmc_ip"),
        "dpu_bmc": None,
        "users": users,
        "cluster": cluster,
        "hbn_cidr": None,
        "purpose": hw.get("model"),
        "features": features,
        "ports": None,
        "notes": None,
        "worker": {},
        "broken": bool(m.get("archived")),
    }


# ── Loading ──────────────────────────────────────────────────────────────────


def load(max_age: float = 120) -> dict:
    if not (time.time() - _cache["at"] < max_age and _cache["data"]):
        try:
            data = {**{"sections": _parse_api(_fetch_api())}, "error": None}
        except MachinesError as e:
            data = {"sections": [], "error": str(e)}
        data["source"] = SOURCE_URL
        data["source_label"] = SOURCE_LABEL
        _cache.update(at=time.time(), data=data)
    return _cache["data"]


def dpus(data: dict) -> list[dict]:
    return [m for sec in data.get("sections", []) for m in sec["machines"] if m["type"] == "DPU Worker"]


def find_worker(data: dict, name: str | None, bmc_ip: str | None) -> dict | None:
    """The DPU machine a WORKER_N_* block points at: by BMC address, else by name."""
    ms = dpus(data)
    if bmc_ip:
        for m in ms:
            if bmc_ip in (m["bmc"], m["dpu_bmc"]):
                return m
    if name:
        for m in ms:
            if name in (m["id"], m["address"]) or m["address"].startswith(name + "."):
                return m
    return None
