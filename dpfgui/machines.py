"""Lab machine allocations (the dpf-allocations repo's lab-machines.yaml).

Tracks hypervisors, DPU workers and shared DNS domains so the team
can see who's using what without digging through a spreadsheet.

The source is `github:owner/repo[/path]` (the team's repo by default), read from a clone
the app keeps and pulls, or a local file such as a checkout you're editing.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import yaml

from . import config, github

DEFAULT_SOURCE = f"github:{github.ALLOCATIONS}/lab-machines.yaml"
_cache: dict = {"at": 0, "key": None, "data": None}


class MachinesError(RuntimeError):
    pass


def _prefs_path() -> Path:
    return config.CONFIG_DIR / "app.json"


def prefs() -> dict:
    try:
        data = json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        data = {}
    m = data.get("machines") or {}
    return {"source": m.get("source") or DEFAULT_SOURCE}


def _write(data: dict) -> None:
    config.CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    _prefs_path().write_text(json.dumps(data, indent=2) + "\n")
    _prefs_path().chmod(0o600)


def save_prefs(source: str | None = None) -> dict:
    try:
        data = json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        data = {}
    m = data.setdefault("machines", {})
    if source is not None:
        m["source"] = source.strip() or None
    _write(data)
    _cache["at"] = 0
    return prefs()


# Per-machine worker settings the YAML doesn't carry (boot MAC, BMC credentials, ...),
# remembered when you switch a worker away from a machine so switching back restores them.
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


def _parse(source: str, fresh: bool = False) -> dict:
    try:
        raw = yaml.safe_load(github.read_source(source, "lab-machines.yaml", fresh)) or {}
    except github.GitHubError as e:
        raise MachinesError(str(e))
    except yaml.YAMLError as e:
        raise MachinesError(f"Invalid YAML: {e}")

    sections: list[dict] = []

    # Hypervisors
    hvs = raw.get("hypervisors") or {}
    if hvs:
        machines = []
        for name, m in hvs.items():
            machines.append(_machine(name, m, "Hypervisor"))
        sections.append({"name": "Hypervisors", "machines": machines})

    # DPU workers
    dpus = raw.get("dpus") or {}
    if dpus:
        machines = []
        for name, m in dpus.items():
            machines.append(_machine(name, m, "DPU Worker"))
        sections.append({"name": "DPU workers", "machines": machines})

    # Domains
    doms = raw.get("domains") or {}
    if doms:
        machines = []
        for name, m in doms.items():
            machines.append({
                "id": str(name),
                "type": "Domain",
                "address": m.get("api", ""),
                "short": str(name),
                "api": m.get("api"),
                "api_ip": m.get("api_ip"),
                "apps": m.get("apps"),
                "apps_ip": m.get("apps_ip"),
                "users": m.get("users") or [],
                "purpose": m.get("purpose"),
                "broken": False,
            })
        sections.append({"name": "Domains", "machines": machines})

    return {"sections": sections}


def _machine(name: str, m: dict, typ: str) -> dict:
    return {
        "id": str(name),
        "type": typ,
        "address": m.get("address", ""),
        "short": str(name),
        "bmc": m.get("bmc"),
        "dpu_bmc": m.get("dpu_bmc"),
        "users": m.get("users") or [],
        "cluster": m.get("cluster"),
        "hbn_cidr": m.get("hbn_cidr"),
        "purpose": m.get("purpose"),
        "features": m.get("features") or [],
        "ports": m.get("ports"),
        "notes": m.get("notes"),
        # Optional per-machine worker settings; filled in when you switch a worker to it.
        "worker": {k.upper(): str(m[k]) for k in ("boot_mac", "root_device", "bmc_user") if m.get(k)},
        "broken": bool(m.get("broken")),
    }


def load(max_age: float = 120) -> dict:
    pr = prefs()
    key = pr["source"]
    if not (_cache["key"] == key and time.time() - _cache["at"] < max_age and _cache["data"]):
        try:
            data = {**_parse(key, fresh=max_age == 0), "error": None}
        except MachinesError as e:
            data = {"sections": [], "error": str(e)}
        data["source"] = key
        _cache.update(at=time.time(), key=key, data=data)
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
