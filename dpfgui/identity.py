"""Which GitHub user you are.

Lab machines and HBN slots are allocated to GitHub logins. On first start the
GUI shows every login it knows of and you pick yours; until then nothing is
treated as yours.
"""

from __future__ import annotations

import json
from pathlib import Path

from . import config, github, machines, subnets


def _prefs_path() -> Path:
    return config.CONFIG_DIR / "app.json"


def _read() -> dict:
    try:
        return json.loads(_prefs_path().read_text())
    except (OSError, ValueError):
        return {}


def chosen() -> bool:
    """Whether you've picked yet ("not listed" counts)."""
    return "me" in _read()


def me() -> list[str]:
    """Your login as a list, so it can be matched against allocations' user lists."""
    login = _read().get("me")
    return [login] if isinstance(login, str) and login else []


def set_me(login: str | None) -> None:
    data = _read()
    data["me"] = (login or "").strip() or None
    data.get("subnets", {}).pop("identities", None)
    data.get("subnets", {}).pop("me", None)
    config.CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    _prefs_path().write_text(json.dumps(data, indent=2) + "\n")
    _prefs_path().chmod(0o600)


def known() -> list[str]:
    """Every login in the lab machine list or the HBN allocations."""
    logins = {str(u) for sec in machines.load().get("sections", []) for m in sec["machines"] for u in m.get("users") or []}
    logins |= {s["owner"] for sub in subnets.load()["subnets"] for s in sub["slots"] if s["kind"] == "user"}
    return sorted(logins, key=str.lower)


def view() -> dict:
    logins = known()
    names = github.users(logins)
    return {"chosen": chosen(), "me": (me() or [None])[0],
            "known": [{"login": l, "name": names[l]["name"]} for l in logins],
            # Not on the list: ask for an HBN slot (a pull request to the allocations file)
            "request_url": subnets.load().get("request_url")}
