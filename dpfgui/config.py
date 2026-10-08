"""Local storage for profiles.

A profile is one deployment you work on: which hypervisor it runs on (host, SSH
user, where the automation repo is checked out there) and its settings, in

    ~/.config/dpf-dev/profiles/<name>.json   {host, user, automation_dir, label, "settings": {...}}

Settings are a map of KEY -> entry, where an entry is {"value": str,
"note": str (optional), "off": bool (optional)}. The automation repo's own
defaults fill in everything a profile doesn't set. The user.env pushed to the
hypervisor is *generated* from them; nobody edits shell syntax by hand. To start
from another profile's settings, duplicate it.

Other locations (each overridable with an env var):

    ~/.kube/dpf-dev/<name>/      KUBECONFIG_DIR (DPFGUI_KUBECONFIG_DIR): mgmt/hcp.kubeconfig
    ~/.local/state/dpf-dev/      STATE_DIR (DPFGUI_STATE_DIR, honours XDG_STATE_HOME)
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import socket
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path


def _dir(env: str, xdg: str, xdg_default: str, sub: str = "dpf-dev") -> Path:
    if os.environ.get(env):
        return Path(os.environ[env]).expanduser()
    return Path(os.environ.get(xdg) or Path.home() / xdg_default) / sub


CONFIG_DIR = _dir("DPFGUI_CONFIG_DIR", "XDG_CONFIG_HOME", ".config")
STATE_DIR = _dir("DPFGUI_STATE_DIR", "XDG_STATE_HOME", ".local/state")
KUBECONFIG_DIR = Path(os.environ.get("DPFGUI_KUBECONFIG_DIR") or Path.home() / ".kube" / "dpf-dev").expanduser()

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

Settings = dict[str, dict]

# Keys surfaced on the dashboard as a quick summary of a profile's config.
SUMMARY_KEYS = [
    "CLUSTER_NAME", "VM_PREFIX", "VM_WORKER_PREFIX", "VM_COUNT", "RAM", "OPENSHIFT_VERSION", "OCP_RELEASE_IMAGE",
    "API_VIP", "INGRESS_VIP", "WORKER_COUNT", "KUBECONFIG", "VTEP_CIDR",
]


class ConfigError(ValueError):
    pass


@dataclass
class Profile:
    name: str                # id: file name, kubeconfig dir, job state on the hypervisor
    host: str = ""           # the hypervisor ("" until you pick one)
    user: str = "root"
    automation_dir: str = ""
    label: str = ""
    title: str = ""          # what the UI calls it; free text
    extra: dict = field(default_factory=dict)

    @property
    def ready(self) -> bool:
        """Has a hypervisor and an automation repo, so there's something to talk to."""
        return bool(self.host and self.automation_dir)

    @property
    def target(self) -> str:
        return f"{self.user}@{self.host}" if self.user else self.host

    @property
    def remote_state_dir(self) -> str:
        """Where job scripts/logs live on the hypervisor (outside the repo)."""
        slug = self.automation_dir.strip("/").replace("/", "_") or "default"
        return f".dpf-gui/{slug}"  # relative to the remote $HOME

    def to_json(self) -> dict:
        d = asdict(self)
        d.pop("extra", None)
        return d


# ── Settings ─────────────────────────────────────────────────────────────────


def normalize_settings(raw: dict | None) -> Settings:
    """Validate and canonicalize a settings map coming from disk or the API."""
    out: Settings = {}
    for key, entry in (raw or {}).items():
        if not KEY_RE.match(key):
            raise ConfigError(f"{key!r} is not a valid setting name (letters, digits and _ only)")
        if not isinstance(entry, dict):
            entry = {"value": entry}
        value = entry.get("value", "")
        if not isinstance(value, (str, int, float, bool)):
            raise ConfigError(f"{key}: value must be text")
        value = ("true" if value else "false") if isinstance(value, bool) else str(value)
        if "\n" in value:
            raise ConfigError(f"{key}: value can't contain line breaks")
        clean = {"value": value}
        if entry.get("note"):
            clean["note"] = str(entry["note"]).strip()
        if entry.get("off"):
            clean["off"] = True
        out[key] = clean
    return out


def active_values(settings: Settings) -> dict[str, str]:
    return {k: e["value"] for k, e in settings.items() if not e.get("off")}


def slugify(title: str, name: str) -> str:
    """The name you see ("New profile (1)" -> new-profile-1), not the file name."""
    return re.sub(r"[^a-z0-9]+", "-", (title or name).lower()).strip("-") or name


def profile_slug(profile_name: str) -> str:
    try:
        title = get_profile(profile_name).title
    except (KeyError, ConfigError):
        title = ""
    return slugify(title, profile_name)


def app_defaults(profile_name: str, values: dict[str, str] | None = None) -> dict[str, str]:
    """Defaults this app uses instead of the automation repo's, where the repo's don't work on a
    shared hypervisor. VM_PREFIX: the repo's vm-<DEPLOYMENT_PROFILE> is the same for everyone
    who keeps it, and `make clean-all` deletes every VM starting with it."""
    if not profile_name:
        return {}
    from . import identity  # late: identity imports this module

    me = identity.me()
    who = f"{me[0].lower()}-" if me else ""
    slug = profile_slug(profile_name)
    # No CLUSTER_NAME: api.<CLUSTER_NAME>.<BASE_DOMAIN> has to be in DNS, so it's whatever the
    # user's records (or a lab domain) say, never made up from the profile's name.
    out = {"VM_PREFIX": f"vm-{who}{slug}"}
    # The dpf profile requires DPU_HOST_CIDR even without DPU hosts, though only the DPU hosts'
    # OVN uses it. Without any, a placeholder (the repo's own example) keeps generate-env happy
    # without saving anything; picking a DPU host fills in its real subnet.
    vals = values if values is not None else active_values(profile_settings(profile_name))
    if vals.get("DEPLOYMENT_PROFILE", "dpf") == "dpf" and vals.get("WORKER_COUNT", "0") in ("", "0"):
        out["DPU_HOST_CIDR"] = "10.0.110.0/24"
    return out


# Named after the profile's title by default; once deployed, renaming the profile mustn't rename them.
IDENTITY_KEYS = ("VM_PREFIX",)


def pin_identity(profile_name: str) -> None:
    """Save the VM prefix the profile is about to deploy with, if it's still the app's default."""
    s = profile_settings(profile_name)
    vals = active_values(s)
    defaults = app_defaults(profile_name, vals)
    pins = {k: defaults[k] for k in IDENTITY_KEYS if k not in vals}
    if pins:
        for k, v in pins.items():
            s[k] = {"value": v}
        save_profile_settings(profile_name, s)


def render_env(settings: Settings, profile_name: str = "") -> str:
    """Generate the user.env pushed to the hypervisor from a profile's settings."""
    values = {**app_defaults(profile_name, active_values(settings)), **active_values(settings)}
    notes = {k: e.get("note") for k, e in settings.items() if e.get("note")}
    lines = [
        "# Generated by dpf-dev-gui" + (f" for {profile_name}" if profile_name else "") + ".",
        "# Edit the settings in the app; changes made here are overwritten on the next push.",
        "",
    ]
    for key, value in values.items():
        if notes.get(key):
            lines.append(f"# {notes[key]}")
        lines.append(f"export {key}={shlex.quote(value)}")
    return "\n".join(lines) + "\n"


def profile_settings(name: str) -> Settings:
    _migrate()
    return normalize_settings(_read_json(_profile_path(name)).get("settings"))


def save_profile_settings(name: str, settings: Settings) -> None:
    data = _read_json(_profile_path(name))
    if not data:
        raise KeyError(name)
    data["settings"] = normalize_settings(settings)
    _atomic_write(_profile_path(name), json.dumps(data, indent=2) + "\n", private=True)


def render_user_env(name: str) -> str:
    return render_env(profile_settings(name), name)


def config_summary(name: str) -> dict:
    env = active_values(profile_settings(name))
    env = {**app_defaults(name, env), **env}
    env.setdefault("VM_WORKER_PREFIX", f"{env['VM_PREFIX']}-worker" if env.get("VM_PREFIX") else "")
    summary = {k: env[k] for k in SUMMARY_KEYS if env.get(k)}
    try:
        need_mib = int(env.get("VM_COUNT", "0")) * int(env.get("RAM", "0"))
    except ValueError:
        need_mib = 0
    return {"values": summary, "required_mem_mib": need_mib}


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ── Profiles ─────────────────────────────────────────────────────────────────


def _profiles_dir() -> Path:
    return CONFIG_DIR / "profiles"


def _profile_path(name: str) -> Path:
    return _profiles_dir() / f"{validate_name(name)}.json"


def name_for(title: str) -> str:
    """A free profile name (file name, id) for a new profile called `title`: "DPF Demo" -> dpf-demo."""
    base = slugify(title or "", "").replace("_", "-")[:28].strip("-")
    if not base:
        raise ConfigError("Give the profile a name (with some letters or digits)")
    taken = {p.name for p in list_profiles()}
    name, n = base, 2
    while name in taken:
        name, n = f"{base}-{n}", n + 1
    return name


def validate_name(name: str) -> str:
    if not NAME_RE.match(name or ""):
        raise ConfigError("Profile names must be lowercase letters, digits, '-' or '_' (max 32 chars)")
    return name


def list_profiles() -> list[Profile]:
    _migrate()
    d = _profiles_dir()
    if not d.is_dir():
        return []
    return [get_profile(p.stem) for p in sorted(d.glob("*.json"))]


def get_profile(name: str) -> Profile:
    path = _profile_path(name)
    if not path.exists():
        raise KeyError(name)
    raw = json.loads(path.read_text())
    raw.pop("settings", None)
    raw.pop("hcp_namespace", None)  # used to be configurable; it's fixed by the automation repo
    known = {k: raw.pop(k) for k in list(raw) if k in Profile.__dataclass_fields__ and k != "extra"}
    known["name"] = name
    return Profile(**known, extra=raw)


def save_profile(p: Profile, settings: Settings | None = None) -> Profile:
    validate_name(p.name)
    if p.automation_dir and not p.automation_dir.startswith("/"):
        raise ConfigError("Automation dir must be an absolute path on the hypervisor")
    try:
        before = get_profile(p.name)
    except KeyError:
        before = None
        # Names come back after a profile is deleted; a clone's owner marker must not.
        p.extra.setdefault("uid", uuid.uuid4().hex)
    if not before or (before.host, before.automation_dir) != (p.host, p.automation_dir):
        other = next((o for o in sharing_clone(p) if o.name != p.name), None)
        if other:
            raise ConfigError(f"{other.title or other.name} already uses {p.automation_dir} on {p.host}; "
                              "each profile needs its own clone")
    _profiles_dir().mkdir(parents=True, exist_ok=True, mode=0o700)
    existing = _read_json(_profile_path(p.name)).get("settings", {})
    data = {**p.extra, **p.to_json(), "settings": normalize_settings(settings if settings is not None else existing)}
    data.pop("name", None)
    _atomic_write(_profile_path(p.name), json.dumps(data, indent=2) + "\n", private=True)
    return get_profile(p.name)


# ── Clone ownership ──────────────────────────────────────────────────────────
# Each profile has its own clone of the automation repo: a clone holds one deployment's
# kubeconfigs, .env and generated files, and the repo reuses them. A marker in the clone's .git
# says which profile, on which laptop, it belongs to.


def _same_dir(a: str, b: str) -> bool:
    return bool(a) and a.rstrip("/") == b.rstrip("/")


def sharing_clone(p: Profile) -> list[Profile]:
    """This laptop's profiles that use p's clone, p included."""
    if not p.host or not p.automation_dir:
        return []
    return [o for o in list_profiles() if o.host == p.host and _same_dir(o.automation_dir, p.automation_dir)]


def laptop() -> dict:
    """This laptop: a random id made on first use (hostnames repeat), and its name for people."""
    path = CONFIG_DIR / "app.json"
    data = _read_json(path)
    if not data.get("laptop_id"):
        data["laptop_id"] = uuid.uuid4().hex
        CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
        _atomic_write(path, json.dumps(data, indent=2) + "\n", private=True)
    return {"id": data["laptop_id"], "name": socket.gethostname().split(".")[0], "user": os.environ.get("USER", "")}


def profile_uid(name: str) -> str | None:
    """The profile's random id (given to profiles made before it existed on first ask)."""
    try:
        p = get_profile(name)
    except (KeyError, ConfigError):
        return None
    if not p.extra.get("uid"):
        p.extra["uid"] = uuid.uuid4().hex
        save_profile(p)
    return p.extra["uid"]


def owner_marker(p: Profile) -> dict:
    lt = laptop()
    return {"profile": p.name, "uid": profile_uid(p.name), "title": p.title or p.name, "laptop_id": lt["id"],
            "laptop": lt["name"], "user": lt["user"], "since": int(time.time())}


def clone_conflict(p: Profile, marker: dict | None) -> dict | None:
    """Why p can't use its clone, or None. `marker` is the one in the clone (None: unmarked).
    kind: "shared" (another profile here uses it too), "profile" (marked for another profile
    here), "laptop" (marked for a profile on another laptop)."""
    if marker and marker.get("laptop_id") and marker.get("profile"):
        if marker["laptop_id"] != laptop()["id"]:
            return {"kind": "laptop", **{k: marker.get(k) for k in ("profile", "title", "laptop", "user", "since")}}
        # Markers from before profiles had ids go by name.
        mine = marker["uid"] == profile_uid(p.name) if marker.get("uid") else marker["profile"] == p.name
        if not mine:
            o = next((o for o in list_profiles() if (o.extra.get("uid") == marker["uid"] if marker.get("uid") else o.name == marker["profile"])), None)
            exists = bool(o) and _same_dir(o.automation_dir, p.automation_dir) and o.host == p.host
            return {"kind": "profile", "profile": marker["profile"], "title": marker.get("title"), "gone": not exists}
        return None
    others = [o for o in sharing_clone(p) if o.name != p.name]
    if others:
        return {"kind": "shared", "profile": others[0].name, "title": others[0].title or others[0].name}
    return None


def describe_conflict(c: dict) -> str:
    who = c.get("title") or c.get("profile") or "another profile"
    if c["kind"] == "shared":
        return f"{who} uses this automation repo clone too. Each profile needs its own: pick or clone another one in Settings → Hypervisor."
    if c["kind"] == "laptop":
        return f"This automation repo clone belongs to {who} on {c.get('laptop') or 'another laptop'}" + (f" ({c['user']})" if c.get("user") else "") + "."
    return f"This automation repo clone belongs to {who}" + (", which isn't a profile here any more." if c.get("gone") else ".")


def delete_profile(name: str) -> None:
    _profile_path(name).unlink(missing_ok=True)


# ── Misc locations ───────────────────────────────────────────────────────────


def kubeconfig_dir(name: str) -> Path:
    d = KUBECONFIG_DIR / validate_name(name)
    d.mkdir(parents=True, exist_ok=True, mode=0o700)
    return d


def state_dir() -> Path:
    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    return STATE_DIR


def node_address(host: str, mac: str, ip: str | None = None) -> dict | None:
    """The address the lab's DHCP gives a VM MAC on a hypervisor, as last seen ({ip, seen}).
    With ip, records it as seen now."""
    import time
    path = state_dir() / "node-addresses.json"
    data, key = _read_json(path), f"{host} {mac.lower()}"
    if ip:
        data[key] = {"ip": ip, "seen": int(time.time())}
        _atomic_write(path, json.dumps(data, indent=2) + "\n")
    return data.get(key)


# ── One-time migration from the old shell-script env files ───────────────────

_ASSIGN_RE = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


def settings_from_shell(text: str) -> Settings:
    """Convert an old `export KEY=value` file: comments become notes,
    commented-out assignments become switched-off settings."""
    out: Settings = {}
    pending: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            pending = []
            continue
        off = False
        if line.startswith("#"):
            body = line.lstrip("#").strip()
            if not _ASSIGN_RE.match(body):
                if body and not body.startswith("!"):
                    pending.append(body)
                continue
            line, off = body, True
        m = _ASSIGN_RE.match(line)
        if not m:
            continue
        try:
            parts = shlex.split(m.group(2), comments=True)
            value = parts[0] if parts else ""
        except ValueError:
            value = m.group(2).strip().strip("'\"")
        entry = {"value": value}
        if pending:
            entry["note"] = " ".join(pending)
        if off:
            entry["off"] = True
        if off and m.group(1) in out and not out[m.group(1)].get("off"):
            continue  # an active value wins over a commented-out alternative
        out[m.group(1)] = entry
        pending = []
    return out


_migrated = False


def _migrate() -> None:
    global _migrated
    if _migrated:
        return
    _migrated = True
    d = _profiles_dir()
    for env_file in d.glob("*.env") if d.is_dir() else []:
        path = env_file.with_suffix(".json")
        data = _read_json(path)
        if data and "settings" not in data:
            data["settings"] = settings_from_shell(env_file.read_text())
            _atomic_write(path, json.dumps(data, indent=2) + "\n", private=True)
            env_file.rename(env_file.with_name(env_file.name + ".migrated"))
    # There used to be a shared base under every hypervisor's settings: fold it into each
    # profile (the profile's own values win) so nothing changes for existing deployments.
    old_base = CONFIG_DIR / "base.json"
    base_env = CONFIG_DIR / "base.env"
    if base_env.exists() and not old_base.exists():
        base = settings_from_shell(base_env.read_text())
        base_env.rename(base_env.with_name("base.env.migrated"))
    elif old_base.exists():
        base = normalize_settings(_read_json(old_base).get("settings"))
    else:
        return
    for path in sorted(d.glob("*.json")) if d.is_dir() else []:
        data = _read_json(path)
        if data:
            data["settings"] = {**base, **(data.get("settings") or {})}
            _atomic_write(path, json.dumps(data, indent=2) + "\n", private=True)
    if old_base.exists():
        old_base.rename(old_base.with_name("base.json.migrated"))


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def _atomic_write(path: Path, text: str, private: bool = False) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text)
    if private:
        os.chmod(tmp, 0o600)
    os.replace(tmp, path)
