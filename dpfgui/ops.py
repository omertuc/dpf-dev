"""Operations shared by the web app and the command line.

Two kinds of things live here:

- Questions asked of a hypervisor (can you log in, where's the automation repo, which
  addresses are free, the deployment's status, a BMC's NICs).
- Changes to a profile's settings (picking DPU hosts, an HBN slot, a lab domain, filling in
  the bridge and the DPU host subnet). The GUI's editor asks the server to make them on its
  unsaved draft; the command line makes them on the saved settings.
"""

from __future__ import annotations

import asyncio
import base64
import ipaddress
import json
import re
import shlex
from pathlib import Path
from urllib.parse import urlparse

from . import config, identity, machines, schema as schema_mod, ssh
from .config import Profile, Settings

_HERE = Path(__file__).parent
REMOTE_STATUS = (_HERE / "remote_status.py").read_text()
REMOTE_FREEIPS = (_HERE / "remote_freeips.py").read_text()
REMOTE_BMC = (_HERE / "remote_bmc.py").read_text()

WORKER_RE = re.compile(r"^WORKER_(\d+)_([A-Z_]+)$")
# Worker fields that belong to the machine (not in the lab list), restored when you pick it again.
DPU_REMEMBERED = machines.REMEMBERED_FIELDS
DPU_FIELDS = ("NAME", "BMC_IP", "BMC_USER", "BMC_PASSWORD", "BOOT_MAC", "ROOT_DEVICE", "DPU", "REDFISH_SYSTEM_PATH")


class OpsError(RuntimeError):
    pass


# ── Hypervisor questions ─────────────────────────────────────────────────────


HOST_CHECK = r'''
echo "LOGIN=ok"
echo "HOME=$HOME"
d=$1
if [ -n "$d" ]; then
  if [ ! -d "$d" ]; then echo "DIR=missing"
  elif [ ! -f "$d/ci/env.template" ]; then echo "DIR=notrepo"
  else echo "DIR=repo"; echo "BRANCH=$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null)"; fi
  [ -f "$d/.git/dpf-dev-owner.json" ] && echo "OWNER=$(tr -d '\n' < "$d/.git/dpf-dev-owner.json")"
fi
'''


def valid_host(host: str, user: str = "", automation_dir: str = "") -> bool:
    return bool(re.fullmatch(r"[\w.\-]+", host) and re.fullmatch(r"[\w.\-]*", user) and "\n" not in automation_dir)


async def host_check(host: str, user: str, automation_dir: str = "", profile: str = "") -> dict:
    """Can you log in to a host over ssh, and is the automation repo where you say it is? With
    `profile`, whether that profile can have the clone (see config.clone_conflict).
    {login, error?, home, dir: repo|missing|notrepo, branch, owner?, conflict?}"""
    if not valid_host(host, user, automation_dir):
        raise OpsError("Not a host name")
    p = Profile(name="check", host=host, user=user, automation_dir=automation_dir or "/")
    script = HOST_CHECK.replace("d=$1", f"d={shlex.quote(automation_dir)}")
    try:
        r = await ssh.run(p, script, timeout=30)
    except ssh.SSHError as e:
        return {"login": False, "error": str(e)}
    out = {"login": "LOGIN=ok" in r.out}
    for line in r.out.splitlines():
        k, _, v = line.partition("=")
        if k == "DIR":
            out["dir"] = v
        elif k == "BRANCH":
            out["branch"] = v
        elif k == "HOME":
            out["home"] = v
        elif k == "OWNER":
            try:
                out["owner"] = json.loads(v)
            except ValueError:
                out["owner"] = {"invalid": True}
    if profile:
        with_conflict(out, profile, host, user, automation_dir)
    return out


def with_conflict(check: dict, profile: str, host: str, user: str, automation_dir: str) -> dict:
    """Add whether `profile` can have the clone a host_check looked at (config.clone_conflict)."""
    if automation_dir and check.get("login"):
        p = Profile(name=profile, host=host, user=user, automation_dir=automation_dir)
        check["conflict"] = config.clone_conflict(p, check.get("owner"))
    return check


def clone_target(home: str | None, slug: str) -> str | None:
    """Where a profile's clone goes: ~/user-envs/<your GitHub login>/<profile slug>/openshift-dpf
    on the hypervisor (one clone per profile: see config.clone_conflict)."""
    me = identity.me()
    return f"{home or '/root'}/user-envs/{me[0].lower()}/{slug}/openshift-dpf" if me else None


def lab_hypervisors(lab: dict) -> list[dict]:
    return [m for sec in lab.get("sections", []) for m in sec["machines"] if m["type"] == "Hypervisor"]


def resolve_hypervisor(host: str) -> str:
    """A lab hypervisor's address from its name in lab-machines.yaml; anything else as given."""
    for m in lab_hypervisors(machines.load()):
        if host in (m["id"], m["address"]) or (m["address"] or "").startswith(host + "."):
            return m["address"] or host
    return host


async def free_ips(p: Profile, bridge: str, exclude: list[str] = (), count: int = 4) -> dict:
    """A few addresses in the bridge's subnet that nothing answers on (for the VIPs).
    Addresses the lab already hands out (lab domains) and your profiles' VIPs are off limits."""
    if not re.fullmatch(r"[\w.\-]+", bridge):
        raise OpsError("Not a bridge name")
    skip = set(exclude)
    for sec in (await asyncio.to_thread(machines.load)).get("sections", []):
        for m in sec["machines"]:
            skip |= {m.get(k) for k in ("api_ip", "apps_ip") if m.get(k)}
    for other in config.list_profiles():
        vals = config.active_values(config.profile_settings(other.name))
        skip |= {vals[k] for k in ("API_VIP", "INGRESS_VIP", "HYPERSHIFT_API_IP") if vals.get(k)}
    args = json.dumps({"bridge": bridge, "exclude": sorted(skip), "count": count})
    r = (await ssh.run(p, REMOTE_FREEIPS, interp=("python3", "-"), args=(args,), timeout=90)).check("Looking for free addresses")
    return json.loads(r.out)


async def remote_status(p: Profile, fetch: bool = False) -> dict:
    """The hypervisor's side of a profile: host, VMs, repo, .env, jobs, makes running, and
    whether the clone is this profile's (claiming it if it's nobody's)."""
    alone = len(config.sharing_clone(p)) <= 1
    args = json.dumps({"automation_dir": p.automation_dir, "state_dir": p.remote_state_dir, "fetch": fetch,
                       "claim": config.owner_marker(p) if alone else None})
    res = await ssh.run(p, REMOTE_STATUS, interp=("python3", "-"), args=(args,), timeout=60)
    res.check("Collecting status")
    remote = json.loads(res.out)
    remote["conflict"] = config.clone_conflict(p, remote.get("owner"))
    if remote["conflict"]:
        # What's in the clone is another deployment's: show this profile's settings instead.
        remote.update(env={}, workers=None, jobs=[], latest_make_log=None)
    # The repo keeps using the kubeconfig its .env names even after CLUSTER_NAME changes.
    if not is_cluster_api((remote.get("kubeconfig") or {}).get("server"), values(p.name)):
        remote["kubeconfig"] = {"path": None, "mtime": None, "server": None}
    return remote


def is_cluster_api(server: str | None, vals: dict[str, str]) -> bool:
    """Is `server` the API of the management cluster these settings deploy?"""
    want = f"api.{vals.get('CLUSTER_NAME')}.{vals.get('BASE_DOMAIN')}"
    return bool(server and vals.get("CLUSTER_NAME") and vals.get("BASE_DOMAIN") and urlparse(server).hostname == want)


def my_vms(remote: dict, summary: dict | None = None) -> list[dict]:
    """The VMs of this deployment: named with VM_PREFIX / VM_WORKER_PREFIX from the hypervisor's
    .env, else from the profile's settings."""
    env = remote.get("env") or {}
    summary = summary or {}
    prefixes = [x for x in (env.get("VM_PREFIX") or summary.get("VM_PREFIX"),
                            env.get("VM_WORKER_PREFIX") or summary.get("VM_WORKER_PREFIX")) if x]
    return [v for v in remote.get("vms") or [] if any(v["name"].startswith(x) for x in prefixes)]


async def bmc_probe(p: Profile, bmc: str, user: str, password: str, host: str = "") -> dict:
    """A DPU host's NICs from its BMC (Redfish), which one carries the host's address, and
    whether the BMC login works. {auth, nics, arp_mac, host_ip, recommended, error?}"""
    if not re.fullmatch(r"[\w.\-:\[\]]+", bmc) or (host and not re.fullmatch(r"[\w.\-]+", host)):
        raise OpsError("Not a host name")
    args = base64.b64encode(json.dumps({"bmc": bmc, "user": user, "password": password, "host": host}).encode()).decode()
    r = (await ssh.run(p, REMOTE_BMC.replace("__ARGS__", args), interp=("python3", "-"), timeout=300)).check("Asking the BMC")
    d = json.loads(r.out)
    nics = d.get("nics") or []
    rec = next((n for n in nics if d.get("arp_mac") and n["mac"] == d["arp_mac"]), None) \
        or next((n for n in nics if n.get("link") == "LinkUp"), None)
    d["recommended"] = rec["mac"] if rec else None
    return d


# ── Editing settings ─────────────────────────────────────────────────────────


def values(name: str, settings: Settings | None = None) -> dict[str, str]:
    """A profile's values with the app's own defaults, without asking the hypervisor for the
    repo's (use settings.analyze for those)."""
    s = config.profile_settings(name) if settings is None else settings
    vals = config.active_values(s)
    return {**config.app_defaults(name, vals), **vals}


def set_values(s: Settings, vals: dict[str, str]) -> None:
    for key, value in vals.items():
        s[key] = {**s.get(key, {}), "value": str(value)}
        s[key].pop("off", None)


def reset(s: Settings, *keys: str) -> None:
    for k in keys:
        s.pop(k, None)


def move(s: Settings, pairs: list[tuple[str, str]]) -> None:
    """Move whole entries (value and note) between keys, e.g. renumbering workers."""
    moved = [s.pop(src, None) for src, _ in pairs]
    for (_, dst), entry in zip(pairs, moved):
        if entry:
            s[dst] = entry
        else:
            s.pop(dst, None)


def apply_fix(s: Settings, fix: dict) -> str:
    """Apply a fix that settings.analyze offers with an issue. Returns what it did."""
    if fix["op"] == "remove":
        reset(s, fix["key"])
        return f"removed {fix['key']}"
    if fix["op"] == "rename":
        s[fix["to"]] = s.pop(fix["key"])
        return f"renamed {fix['key']} to {fix['to']}"
    if fix["op"] == "set":
        set_values(s, {fix["key"]: fix["value"]})
        return f"{fix['key']}={fix['value']}"
    raise OpsError(f"Unknown fix {fix['op']}")


# ── DPU hosts ────────────────────────────────────────────────────────────────


def worker_slots(sch=None) -> list[int]:
    """The worker numbers the automation repo has settings for (WORKER_<n>_*)."""
    sch = sch or schema_mod.load(None)
    return sorted({int(m.group(1)) for k in sch.params if (m := WORKER_RE.match(k))})


def worker_count(vals: dict) -> int:
    try:
        return int(vals.get("WORKER_COUNT") or 0)
    except ValueError:
        return 0


def selected_workers(vals: dict, lab: dict) -> list[dict]:
    """The machines this profile deploys to: worker n for n = 1..WORKER_COUNT, {n, name, machine}."""
    return [{"n": n, "name": vals.get(f"WORKER_{n}_NAME") or "",
             "machine": machines.find_worker(lab, vals.get(f"WORKER_{n}_NAME"), vals.get(f"WORKER_{n}_BMC_IP"))}
            for n in range(1, worker_count(vals) + 1)]


def find_dpu(lab: dict, what: str) -> dict:
    ms = machines.dpus(lab)
    m = next((m for m in ms if what in (m["id"], m["address"]) or (m["address"] or "").startswith(what + ".")), None)
    if not m:
        raise OpsError(f"No DPU host called {what} in the lab machine list" + (f" ({lab['error']})" if lab.get("error") else ""))
    return m


def remember_worker(name: str, vals: dict, n: int, lab: dict) -> None:
    """Keep the machine's own values (login, boot NIC, ...) for when it's picked again."""
    m = machines.find_worker(lab, vals.get(f"WORKER_{n}_NAME"), vals.get(f"WORKER_{n}_BMC_IP"))
    own = {f: vals.get(f"WORKER_{n}_{f}") for f in DPU_REMEMBERED}
    if m:
        machines.remember(m["id"], own, config.get_profile(name).title or name)


def remember_workers(name: str) -> None:
    """After saving: keep each DPU host's login and boot NIC for when it's picked again."""
    vals, lab = values(name), machines.load()
    for n in range(1, worker_count(vals) + 1):
        remember_worker(name, vals, n, lab)


def add_dpu(name: str, s: Settings, lab: dict, machine: str, *, force: bool = False, slots: list[int] | None = None) -> int:
    """Give a lab DPU host the next worker slot. Returns its worker number. `slots`: the worker
    numbers the repo has settings for (default: as the bundled schema says)."""
    m = find_dpu(lab, machine)
    vals = values(name, s)
    me = identity.me()
    if any(w["machine"] and w["machine"]["id"] == m["id"] for w in selected_workers(vals, lab)):
        raise OpsError(f"{m['id']} is already one of this profile's DPU hosts")
    if m["broken"]:
        raise OpsError(f"{m['id']} is marked broken in the lab machine list" + (f": {m['notes']}" if m.get("notes") else ""))
    if not m["bmc"]:
        raise OpsError(f"{m['id']} has no BMC address in the lab machine list")
    if m["users"] and not any(u in me for u in m["users"]) and not force:
        raise OpsError(f"{m['id']} is allocated to {', '.join('@' + u for u in m['users'])} (--force to use it anyway)")
    n = worker_count(vals) + 1
    slots = slots or worker_slots()
    if n not in slots:
        raise OpsError(f"The automation repo only has slots for {len(slots)} DPU hosts")
    k = lambda f: f"WORKER_{n}_{f}"  # noqa: E731
    known = {**(machines.remembered().get(m["id"]) or {}), **(m.get("worker") or {})}
    # What we don't know about this machine starts at the repo default.
    reset(s, *(k(f) for f in DPU_REMEMBERED if not known.get(f)))
    new = {k("NAME"): m["id"], k("BMC_IP"): m["bmc"], "WORKER_COUNT": str(n)}
    new.update({k(f): known[f] for f in DPU_REMEMBERED if known.get(f)})
    # No guessed passwords: the user starts as root, the password is yours to give.
    new.setdefault(k("BMC_USER"), "root")
    set_values(s, new)
    return n


def remove_dpu(name: str, s: Settings, lab: dict, which: str) -> tuple[int, str]:
    """Free a worker slot (by worker number, machine or node name); later workers move up so
    the slots stay 1..WORKER_COUNT. Returns the number and name it had."""
    vals = values(name, s)
    sel = selected_workers(vals, lab)
    w = next((w for w in sel if which == str(w["n"]) or which == w["name"]
              or (w["machine"] and which in (w["machine"]["id"], w["machine"]["address"]))), None)
    if not w:
        raise OpsError(f"{which} isn't one of this profile's DPU hosts")
    n, count = w["n"], len(sel)
    remember_worker(name, vals, n, lab)
    move(s, [(f"WORKER_{i + 1}_{f}", f"WORKER_{i}_{f}") for i in range(n, count + 1) for f in DPU_FIELDS])
    if count - 1:
        set_values(s, {"WORKER_COUNT": str(count - 1)})
    else:
        reset(s, "WORKER_COUNT")  # the repo's default is none
    return n, w["name"]


def _ip_in(ip: str | None, cidr: str | None) -> bool | None:
    try:
        return ipaddress.IPv4Address(ip) in ipaddress.IPv4Network(cidr, strict=False)
    except (ValueError, TypeError):
        return None


def host_ip(facts: dict, address: str) -> str | None:
    r = (facts.get("dns") or {}).get(address) or {}
    return (r.get("dns") or r.get("hosts") or [None])[0]


def lan_bridges(facts: dict) -> dict[str, dict]:
    """The hypervisor's LAN bridges: the ones with an address that aren't libvirt's or a container runtime's."""
    return {n: b for n, b in (facts.get("bridges") or {}).items()
            if b.get("ipv4") and not re.match(r"^(virbr|podman|docker|cni|cali|flannel)", n)}


def host_subnet(vals: dict, lab: dict, facts: dict) -> str | None:
    """The DPU hosts' subnet, from their addresses: the hypervisor bridge's subnet when they're
    on it (they usually are), else their /24."""
    ips = [host_ip(facts, w["machine"]["address"]) for w in selected_workers(vals, lab) if w["machine"]]
    ips = [ip for ip in ips if ip]
    if not ips:
        return None
    for b in lan_bridges(facts).values():
        net = str(ipaddress.IPv4Network(b["ipv4"][0], strict=False))
        if all(_ip_in(ip, net) for ip in ips):
            return net
    own = {ip.rsplit(".", 1)[0] + ".0/24" for ip in ips}
    return own.pop() if len(own) == 1 else None


def autofill(name: str, s: Settings, eff: dict, facts: dict, lab: dict) -> dict[str, str]:
    """Settings that follow from the hypervisor and the DPU hosts, as the GUI fills them in:
    the bridge (when the repo default doesn't exist and there's exactly one LAN bridge) and the
    DPU host subnet. Changes `s`; returns what it set."""
    mine = config.active_values(s)
    out = {}
    bridges = facts.get("bridges")
    if bridges and "BRIDGE_NAME" not in mine and eff.get("BRIDGE_NAME") not in bridges:
        lan = lan_bridges(facts)
        if len(lan) == 1:
            (bname, b), = lan.items()
            out["BRIDGE_NAME"] = bname
            if "NODES_MTU" not in mine and b.get("mtu") in (1500, 9000):
                out["NODES_MTU"] = str(b["mtu"])
    cidr = host_subnet({**eff, **mine}, lab, facts)
    cur = eff.get("DPU_HOST_CIDR")
    if cidr and cidr != cur:
        ips = [host_ip(facts, w["machine"]["address"]) for w in selected_workers({**eff, **mine}, lab) if w["machine"]]
        if not (cur and all(_ip_in(ip, cur) for ip in ips if ip)):  # what's there already fits
            out["DPU_HOST_CIDR"] = cidr
    set_values(s, out)
    return out


# ── HBN slot (VTEP_CIDR) ─────────────────────────────────────────────────────


def slot_options(data: dict, me: list[str]) -> list[dict]:
    """The VTEP_CIDR values you can use: each of your /29 slots (room for one DPU host), and
    adjacent ones together as one bigger range. [{cidr, room, what, owners}]"""
    mine = [dict(s, subnet=sub["id"]) for sub in data.get("subnets", []) for s in sub["slots"] if s["owner"] and s["owner"] in me]
    by_cidr = {s["cidr"]: s for s in mine}
    options = [{"cidr": s["cidr"], "room": 1, "what": f"subnet {s['subnet']} slot {s['id']}", "owners": [s["owner"]]} for s in mine]
    for prefix in (28, 27):
        seen = set()
        for s in mine:
            net = ipaddress.IPv4Network(s["cidr"]).supernet(new_prefix=prefix)
            if net in seen:
                continue
            seen.add(net)
            parts = [str(x) for x in net.subnets(new_prefix=29)]
            if all(c in by_cidr for c in parts):
                options.append({"cidr": str(net), "room": len(parts), "what": f"{len(parts)} of your slots together",
                                "owners": sorted({by_cidr[c]["owner"] for c in parts})})
    return options


def pick_slot(options: list[dict], hosts: int) -> dict | None:
    """The smallest of your options with room for this many DPU hosts."""
    fit = sorted((o for o in options if o["room"] >= max(hosts, 1)), key=lambda o: o["room"])
    return fit[0] if fit else None


# ── Lab domains ──────────────────────────────────────────────────────────────


def lab_domains(lab: dict) -> list[dict]:
    """The lab's DNS domains with their records already in place: {id, cluster, base, api_ip, apps_ip, users, purpose}."""
    out = []
    for sec in lab.get("sections", []):
        for m in sec["machines"]:
            if m["type"] != "Domain":
                continue
            fqdn = re.sub(r"^api\.", "", m.get("api") or "")
            cluster, _, base = fqdn.partition(".")
            if cluster and base:
                out.append({**m, "cluster": cluster, "base": base})
    return out


def domain_values(dm: dict) -> dict[str, str]:
    vals = {"CLUSTER_NAME": dm["cluster"], "BASE_DOMAIN": dm["base"]}
    if dm.get("api_ip"):
        vals["API_VIP"] = dm["api_ip"]
    if dm.get("apps_ip"):
        vals["INGRESS_VIP"] = dm["apps_ip"]
    return vals
