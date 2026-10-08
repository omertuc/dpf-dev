"""Machine-readable description of the automation repo's settings.

The schema lives in this repo (env_schema.yaml next to this file) for now. If the
automation repo starts shipping its own ci/env.schema.yaml, that one wins, since
it always matches the checkout on the hypervisor. DPFGUI_ENV_SCHEMA=<path>
overrides both (handy while editing the schema).
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import yaml

BUNDLED = Path(__file__).with_name("env_schema.yaml")

# schema type -> the validation kinds settings.py understands
_KINDS = {"integer": "int", "boolean": "bool", "enum": "enum", "ipv4": "ipv4", "cidr": "cidr", "mac": "mac",
          "url": "url", "image": "image", "dns-label": "dns-label", "domain": "domain",
          "namespace": "dns-label", "k8s-name": "k8s-name"}


class Schema:
    def __init__(self, data: dict | None, source: str):
        self.source = source  # "repo" (automation repo), "bundled" (this app) or "override"
        data = data or {}
        self.groups: dict[str, str] = {str(k): str(v) for k, v in (data.get("groups") or {}).items()}
        self.removed: dict[str, dict] = data.get("removed") or {}
        self.repository: str | None = (data.get("repository") or "").rstrip("/") or None
        self.not_templated: dict[str, dict] = data.get("not_templated") or {}
        self.params: dict[str, dict] = {}
        for key, p in (data.get("parameters") or {}).items():
            p = p or {}
            if "{N}" in key:
                for n in p.get("instances") or []:
                    self.params[key.replace("{N}", str(n))] = p
            else:
                self.params[key] = p

    def entry(self, key: str) -> dict:
        """Normalized description of one setting: desc, kind, choices, unit, min, max,
        important, unused, section, per_environment."""
        p = self.params.get(key)
        if p is None:
            return {}
        kind = _KINDS.get(p.get("type"))
        if p.get("values") and kind in (None, "int", "enum"):
            kind = "enum"
        out = {
            "desc": " ".join(x for x in (p.get("description") or p.get("deprecated"), p.get("notes")) if x),
            "kind": kind,
            "choices": [str(v) for v in p.get("values") or []] or None,
            "unit": p.get("unit"),
            "important": bool(p.get("common")),
            "section": self.groups.get(p.get("group"), p.get("group")),
            "per_environment": bool(p.get("per_environment")),
        }
        for k in ("min", "max"):
            if p.get(k) is not None:
                out[k] = p[k]
        if p.get("deprecated"):
            out["unused"] = True
            out["unused_reason"] = str(p["deprecated"])
        return {k: v for k, v in out.items() if v not in (None, "")}

    def commit_url(self, sha: str | None) -> str | None:
        return f"{self.repository}/commit/{sha}" if self.repository and sha else None

    def per_environment(self, key: str) -> bool:
        return bool((self.params.get(key) or {}).get("per_environment"))


def load(schema_text: str | None) -> Schema:
    override = os.environ.get("DPFGUI_ENV_SCHEMA")
    if override:
        return Schema(yaml.safe_load(Path(override).expanduser().read_text()), "override")
    if schema_text:
        try:
            return Schema(yaml.safe_load(schema_text), "repo")
        except yaml.YAMLError:
            pass
    return Schema(yaml.safe_load(BUNDLED.read_text()), "bundled")
