"""Holistic view of a profile's configuration.

A profile's settings override the repo defaults (ci/env.defaults). `analyze()`
uses the hypervisor itself to reproduce exactly what
`make generate-env` would produce, and attaches explanations plus validation
issues (format checks, cross-setting rules, and checks against live facts of
the hypervisor such as its bridge MTU).
"""

from __future__ import annotations

import asyncio
import base64
import ipaddress
import json
import re
import time
from pathlib import Path

from . import config, identity, machines, ops, schema as schema_mod, ssh, subnets
from .config import Profile

REMOTE_CONFIG = (Path(__file__).parent / "remote_config.py").read_text()
REMOTE_IMAGES = (Path(__file__).parent / "remote_images.py").read_text()

# Hardcoded in the automation repo's OVN manifests (its POD_CIDR/SERVICE_CIDR settings are ignored).
POD_NETWORK = "10.128.0.0/14"
SERVICE_NETWORK = "172.30.0.0/16"

SECRET_RE = re.compile(r"PASSWORD|TOKEN|API_KEY|_SECRET_KEY")
WORKER_RE = re.compile(r"^WORKER_(\d+)_([A-Z_]+)$")


# ── Catalog lookup ───────────────────────────────────────────────────────────


# ── Format validation ────────────────────────────────────────────────────────


def _check_format(key: str, value: str, entry: dict) -> list[dict]:
    kind = entry.get("kind")
    if value == "" or kind is None:
        return []
    bad = lambda msg: [{"level": "error", "message": msg}]  # noqa: E731
    try:
        if kind == "int":
            if not re.fullmatch(r"\d+", value):
                return bad("Must be a whole number")
            v = int(value)
            if "min" in entry and v < entry["min"]:
                return [{"level": entry.get("min_level", "error"), "message": entry.get("min_msg", f"Must be at least {entry['min']}")}]
            if "max" in entry and v > entry["max"]:
                return bad(f"Must be at most {entry['max']}")
        elif kind == "bool":
            if value not in ("true", "false"):
                return bad("Must be true or false (lowercase, unquoted)")
        elif kind == "ipv4":
            ipaddress.IPv4Address(value)
        elif kind == "cidr":
            ipaddress.IPv4Network(value, strict=True)
        elif kind == "mac":
            if not re.fullmatch(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", value):
                return bad("Must be a MAC address like aa:bb:cc:dd:ee:ff")
        elif kind == "dns-label":
            if not re.fullmatch(r"[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?", value):
                return bad("Must be a DNS label: lowercase letters, digits and '-', not starting/ending with '-'")
        elif kind == "k8s-name":
            if not re.fullmatch(r"[a-z0-9]([-a-z0-9.]{0,251}[a-z0-9])?", value):
                return bad("Must be a Kubernetes name: lowercase letters, digits, '-' and '.'")
        elif kind == "domain":
            if not re.fullmatch(r"([a-z0-9]([-a-z0-9]*[a-z0-9])?\.)+[a-z]{2,}", value):
                return bad("Must be a DNS domain like example.com")
        elif kind == "enum":
            if value not in entry["choices"]:
                return bad("Must be one of: " + ", ".join(entry["choices"]))
        elif kind == "url":
            if not re.match(r"^(https?|oci)://\S+$", value):
                return bad("Must be an http(s):// or oci:// URL")
        elif kind == "image":
            if not re.fullmatch(r"[a-z0-9.\-]+(:\d+)?/[^\s:@]+(:[\w.\-]+|@sha256:[0-9a-f]{64})", value):
                return bad("Must be a container image reference like quay.io/org/name:tag")
    except ValueError as e:
        return bad(str(e).capitalize())
    return []


# ── Cross-setting and hypervisor rules ───────────────────────────────────────


def _ip(v):
    try:
        return ipaddress.IPv4Address(v)
    except (ValueError, TypeError):
        return None


def _net(v):
    try:
        return ipaddress.IPv4Network(v, strict=False)
    except (ValueError, TypeError):
        return None


def _ver(v: str | None) -> str | None:
    m = re.search(r"(\d+\.\d+\.\d+)", v or "")
    return m.group(1) if m else None


def _int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def same_cluster(p: Profile, eff: dict[str, str], issues: dict[str, list]) -> None:
    """Another of your profiles with the same cluster name and domain: Assisted Installer finds
    clusters by name, so a deploy would take the other one's cluster as its own (the repo skips
    creating a cluster whose name is already installed) and the kubeconfigs would mix up."""
    want = (eff.get("CLUSTER_NAME"), eff.get("BASE_DOMAIN"))
    if not all(want):
        return
    clash = []
    for o in config.list_profiles():
        if o.name == p.name:
            continue
        vals = config.active_values(config.profile_settings(o.name))
        vals = {**config.app_defaults(o.name, vals), **vals}
        if (vals.get("CLUSTER_NAME"), vals.get("BASE_DOMAIN")) == want:
            clash.append(o.title or o.name)
    if clash:
        issues.setdefault("CLUSTER_NAME", []).append({
            "level": "warn",
            "message": f"Your profile {', '.join(clash)} has the same cluster name. Assisted Installer finds clusters by name, "
                       "so deploying one would take the other's cluster as its own, and their kubeconfigs would mix up"})


def cross_rules(eff: dict[str, str], facts: dict, issues: dict[str, list]) -> None:
    def add(key, level, msg, fix=None):
        issues.setdefault(key, []).append({"level": level, "message": msg, **({"fix": fix} if fix else {})})

    bridges = facts.get("bridges") or {}
    bname = eff.get("BRIDGE_NAME")
    bridge = bridges.get(bname) if bname else None
    host = facts.get("hostname", "the hypervisor").split(".")[0]

    # Bridge and MTU
    if bname and eff.get("SKIP_BRIDGE_CONFIG", "true") == "true" and not bridge:
        others = ", ".join(f"{n} (MTU {b['mtu']})" for n, b in bridges.items()) or "none"
        add("BRIDGE_NAME", "error", f"No bridge named {bname} on {host}. Bridges there: {others}")
    if bridge:
        mtu = _int(eff.get("NODES_MTU"), 0)
        if mtu and mtu > bridge["mtu"]:
            add("NODES_MTU", "error",
                f"{bname} on {host} has MTU {bridge['mtu']}; nodes with MTU {mtu} will have large packets dropped")
        elif mtu and mtu < bridge["mtu"]:
            add("NODES_MTU", "warn",
                f"{bname} on {host} is a jumbo-frame bridge (MTU {bridge['mtu']}); deployments here normally use NODES_MTU={bridge['mtu']}")
        elif mtu:
            add("NODES_MTU", "ok", f"Matches {bname} on {host} (MTU {bridge['mtu']})")
        if bridge.get("state") not in ("up", "unknown"):
            add("BRIDGE_NAME", "warn", f"{bname} on {host} is {bridge.get('state') or 'not up'}")

    # VIPs
    bridge_nets = [_net(c) for c in (bridge or {}).get("ipv4", [])]
    bridge_nets = [n for n in bridge_nets if n]
    sno = _int(eff.get("VM_COUNT"), 3) == 1
    vip_keys = [k for k in ("API_VIP", "INGRESS_VIP", "HYPERSHIFT_API_IP") if _ip(eff.get(k))]
    if sno:
        # Single-node has no VIPs: it answers on its VM's own (DHCP) address
        vip_keys = [k for k in vip_keys if k == "HYPERSHIFT_API_IP"]
    elif not eff.get("HYPERSHIFT_API_IP"):
        add("HYPERSHIFT_API_IP", "info", "Empty: the hosted cluster API will be exposed via NodePort instead of a MetalLB IP")
    seen: dict[str, str] = {}
    for k in vip_keys:
        ip = _ip(eff[k])
        if eff[k] in seen:
            add(k, "error", f"Same address as {seen[eff[k]]}: Assisted Installer needs a different address for each "
                "(it only allows sharing one with a user-managed load balancer, which the automation doesn't use)")
        seen.setdefault(eff[k], k)
        if bridge_nets and not any(ip in n for n in bridge_nets):
            add(k, "error", f"Not in {bname}'s subnet ({', '.join(map(str, bridge_nets))}); the VMs can't use it")
        for label, n in (("the pod network", POD_NETWORK), ("the service network", SERVICE_NETWORK)):
            if ip in ipaddress.IPv4Network(n):
                add(k, "error", f"Inside {label} ({n})")
        pinged = (facts.get("vip_ping") or {}).get(eff[k])
        if pinged:
            add(k, "warn", "Answers ping although none of your VMs are running; another cluster is probably using it")
        elif pinged is False:
            add(k, "ok", "Free (no reply to ping)")

    # Overlapping networks
    nets = [("the pod network", _net(POD_NETWORK)), ("the service network", _net(SERVICE_NETWORK))]
    nets += [(k, _net(eff.get(k))) for k in ("FLANNEL_POD_CIDR", "VTEP_CIDR", "DPU_HOST_CIDR")]
    nets = [(k, n) for k, n in nets if n]
    for i, (k1, n1) in enumerate(nets):
        for k2, n2 in nets[i + 1:]:
            if n1.overlaps(n2):
                add(k2, "error", f"Overlaps {k1} ({n1})")
    vtep = _net(eff.get("VTEP_CIDR"))
    if vtep and vtep.prefixlen > 29:
        add("VTEP_CIDR", "error", "Too small: each DPU node gets a /29 from it")
    elif vtep and _int(eff.get("WORKER_COUNT")):  # no DPU hosts, no slot needed
        alloc = subnets.load()
        found = subnets.check_vtep(eff["VTEP_CIDR"], alloc, _int(eff.get("WORKER_COUNT")), identity.me())
        for i in found:
            issues.setdefault("VTEP_CIDR", []).append(i)
        if not found:
            add("VTEP_CIDR", "ok", f"Room for {2 ** (29 - vtep.prefixlen)} DPU node(s)")

    # Things that must be kept in sync by hand
    hcn, cns = eff.get("HOSTED_CLUSTER_NAME"), eff.get("CLUSTERS_NAMESPACE")
    if hcn and cns and eff.get("HOSTED_CONTROL_PLANE_NAMESPACE") not in (None, f"{cns}-{hcn}"):
        add("HOSTED_CONTROL_PLANE_NAMESPACE", "error", f"Must be {cns}-{hcn} (CLUSTERS_NAMESPACE-HOSTED_CLUSTER_NAME); it isn't derived automatically")
    if eff.get("SSH_KEY") and not eff["SSH_KEY"].endswith(".pub"):
        add("SSH_KEY", "error", "Must point to a public key file ending in .pub")
    if eff.get("STORAGE_TYPE") == "odf" and _int(eff.get("VM_COUNT"), 3) < 3:
        add("STORAGE_TYPE", "warn", "ODF needs VM_COUNT ≥ 3; the repo silently falls back to lvm")
    if eff.get("VM_STATIC_IP") == "true":
        add("VM_STATIC_IP", "warn", "Needs VM_EXT_IPS, VM_EXT_PL, VM_GW and VM_DNS, which the repo's config generation drops")
    if eff.get("MAC_PREFIX") and not re.fullmatch(r"[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}", eff["MAC_PREFIX"]):
        add("MAC_PREFIX", "error", "Must be two hex bytes like 1a:2b")

    # Memory & disk
    vm_count, ram = _int(eff.get("VM_COUNT"), 0), _int(eff.get("RAM"), 0)
    wcount, wram = _int(eff.get("VM_WORKER_COUNT"), 0), _int(eff.get("VM_WORKER_RAM"), ram)
    need_mib = vm_count * ram + wcount * wram
    avail_kib = facts.get("mem_available_kib")
    if need_mib and avail_kib and not facts.get("my_running_vms"):
        avail_mib = avail_kib // 1024
        if need_mib > avail_mib:
            add("RAM", "error", f"{vm_count} × {ram} MiB = {need_mib // 1024} GiB, but only {avail_mib // 1024} GiB is available on {host}")
        elif need_mib > avail_mib - 32 * 1024:
            add("RAM", "warn", f"Needs {need_mib // 1024} GiB; {host} has {avail_mib // 1024} GiB available, which leaves little headroom")
        else:
            add("RAM", "ok", f"Needs {need_mib // 1024} GiB of {avail_mib // 1024} GiB available on {host}")
    disk = (facts.get("disk") or {}).get("DISK_PATH")
    need_gb = vm_count * (_int(eff.get("DISK_SIZE1")) + _int(eff.get("DISK_SIZE2")))
    if disk and need_gb:
        free_gb = disk["free"] // 1024 ** 3
        level = "warn" if need_gb > free_gb else "ok"
        add("DISK_PATH", level, f"VM disks can grow to {need_gb} GB; {free_gb} GB free in {disk['path']}"
            + (" (disks are thin-provisioned, so this only bites once they fill up)" if level == "warn" else ""))

    # Files on the hypervisor
    files = facts.get("files") or {}
    want_auths = {"OPENSHIFT_PULL_SECRET": ("registry.redhat.io", "quay.io"), "DPF_PULL_SECRET": ("nvcr.io",)}
    for k in ("OPENSHIFT_PULL_SECRET", "DPF_PULL_SECRET", "SSH_KEY"):
        f = files.get(k)
        if not f or (k == "DPF_PULL_SECRET" and eff.get("DEPLOYMENT_PROFILE") == "nno"):
            continue
        if not f["exists"]:
            add(k, "error", f"{f['path']} does not exist on {host}")
            continue
        if k in want_auths:
            if not f.get("json"):
                add(k, "error", f"{f['path']} is not valid JSON")
                continue
            missing = [r for r in want_auths[k] if r not in f.get("auths", [])]
            if missing:
                add(k, "warn", f"No credentials for {', '.join(missing)} in {f['path']}")
            else:
                add(k, "ok", f"Found on {host} with credentials for {len(f.get('auths', []))} registries")
        else:
            add(k, "ok", f"Found on {host}")

    # Versions that have to line up
    hosted = _ver(eff.get("OCP_RELEASE_IMAGE"))
    bf = _ver(eff.get("BLUEFIELD_OCP_IMAGE"))
    if hosted and bf and hosted != bf:
        add("BLUEFIELD_OCP_IMAGE", "warn", f"Built for OpenShift {bf}, but the hosted cluster (OCP_RELEASE_IMAGE) is {hosted}")
    mgmt = _ver(eff.get("OPENSHIFT_VERSION"))
    if mgmt and hosted and mgmt.rsplit(".", 1)[0] != hosted.rsplit(".", 1)[0]:
        add("OCP_RELEASE_IMAGE", "info", f"Hosted cluster {hosted} vs management cluster {mgmt}: different minor versions")

    # Kata
    if eff.get("KATA_ENABLED") == "true" and _int(eff.get("KATA_NUM_VFS")) >= _int(eff.get("NUM_VFS")):
        add("KATA_NUM_VFS", "error", "Must be smaller than NUM_VFS (the rest of PF1's VFs form the regular pool)")

    # Physical workers
    wc = _int(eff.get("WORKER_COUNT"))
    for i in range(1, wc + 1):
        for field in ("NAME", "BMC_IP", "BMC_USER", "BMC_PASSWORD", "BOOT_MAC"):
            k = f"WORKER_{i}_{field}"
            if not eff.get(k):
                if k in eff:
                    add(k, "todo", "Required")
                else:
                    add("WORKER_COUNT", "error", f"WORKER_COUNT={wc} but the repo template has no slot for {k}")
    lab_machines(eff, wc, facts, add)


def lab_machines(eff: dict, wc: int, facts: dict, add) -> None:
    """Check each worker against lab-machines.yaml: is the machine usable, and is it yours?"""
    lab = machines.load()
    if not machines.dpus(lab):
        return
    me = identity.me()
    used: dict[str, int] = {}
    for i in range(1, wc + 1):
        name, bmc = eff.get(f"WORKER_{i}_NAME"), eff.get(f"WORKER_{i}_BMC_IP")
        m = machines.find_worker(lab, name, bmc)
        if not m:
            continue
        key = f"WORKER_{i}_NAME"
        by_name = machines.find_worker(lab, name, None) if name else None
        if by_name and bmc and by_name["id"] != m["id"]:
            add(key, "error", f"Named {name}, but WORKER_{i}_BMC_IP {bmc} is the BMC of {m['id']}")
            continue
        if m["id"] in used:
            add(key, "error", f"{m['id']} is also worker {used[m['id']]}")
        used[m["id"]] = i
        if m["broken"]:
            add(key, "error", f"{m['id']} is marked broken in the lab machine list" + (f": {m['notes']}" if m.get("notes") else ""))
            continue
        others = [u for u in m["users"] if u not in me]
        if m["users"] and len(others) == len(m["users"]):
            add(key, "warn", f"{m['id']} is allocated to {', '.join('@' + u for u in others)}")
        elif m.get("cluster") == "pending validation":
            add(key, "info", f"{m['id']} is pending validation")
        elif not m["users"]:
            add(key, "info", f"{m['id']} isn't allocated to anyone in the lab machine list; claim it there")
        ip = ((facts.get("dns") or {}).get(m["address"]) or {})
        ip = (ip.get("dns") or ip.get("hosts") or [None])[0]
        host_net = _net(eff.get("DPU_HOST_CIDR"))
        if ip and host_net and _ip(ip) not in host_net:
            add("DPU_HOST_CIDR", "error", f"Worker {i} ({m['id']}, {ip}) is outside {host_net}")


def _holds(cond, eff: dict) -> bool:
    """A schema condition (e.g. "VM_COUNT > 1", "DEPLOYMENT_PROFILE == dpf", several joined with
    `and`) against the values. True for no condition, or one it can't read."""
    if cond is None or cond is True:
        return True
    if cond is False:
        return False
    for part in re.split(r"\s+and\s+", str(cond)):
        m = re.fullmatch(r"\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(\S+)\s*", part)
        if not m:
            continue
        have, op, want = eff.get(m.group(1), ""), m.group(2), m.group(3)
        if op in ("==", "!="):
            if (have == want) != (op == "=="):
                return False
            continue
        try:
            a, b = float(have or 0), float(want)
        except ValueError:
            continue
        if not {">": a > b, "<": a < b, ">=": a >= b, "<=": a <= b}[op]:
            return False
    return True


def _required_now(param: dict, eff: dict) -> bool:
    """A setting's `required_when` against the values."""
    return _holds(param.get("required_when"), eff)


# Image checks: (host, image, pull secrets) -> (checked at, results). Readable/denied/missing
# answers are kept 10 minutes; "couldn't tell" ones a minute.
_image_cache: dict[tuple, tuple[float, list]] = {}
SECRET_NAMES = {"OPENSHIFT_PULL_SECRET": "OpenShift pull secret", "DPF_PULL_SECRET": "NVIDIA NGC pull secret"}


async def image_access(p: Profile, sch, eff: dict, facts: dict, issues: dict[str, list]) -> None:
    """Can your pull secrets read every image the deployment pulls (the schema's `pulled`
    settings that apply)? Asks each image's registry, from the hypervisor."""
    secrets = [{"key": k, "path": f["path"]} for k in SECRET_NAMES
               if (f := (facts.get("files") or {}).get(k)) and f.get("exists") and f.get("json")]
    if not secrets:
        return  # the pull secret checks already say what's wrong
    images: dict[str, str] = {}
    for key, param in sch.params.items():
        if not param.get("pulled") or not eff.get(key) or not _holds(param["pulled"], eff):
            continue
        image = eff[key]
        if param.get("tag"):
            tag = eff.get(param["tag"])
            if not tag:
                continue
            image = f"{image}:{tag}"
        images[key] = image
    sig = tuple((s["key"], s["path"], (facts["files"][s["key"]] or {}).get("size")) for s in secrets)
    now = time.time()
    fresh = lambda hit: hit and now - hit[0] < (600 if all(r["state"] in ("ok", "denied", "missing") for r in hit[1]) else 60)
    todo = sorted({img for img in images.values() if not fresh(_image_cache.get((p.host, img, sig)))})
    if todo:
        args = json.dumps({"images": todo, "authfiles": secrets})
        try:
            res = await ssh.run(p, REMOTE_IMAGES, interp=("python3", "-"), args=(args,), timeout=120)
            out = json.loads(res.out)
        except (ssh.SSHError, ValueError):
            return
        if out.get("error"):
            issues.setdefault(next(iter(images)), []).append({"level": "info", "message": f"Couldn't check the images: {out['error']}"})
            return
        for img, results in (out.get("images") or {}).items():
            _image_cache[(p.host, img, sig)] = (now, results)
    for key, img in images.items():
        results = (_image_cache.get((p.host, img, sig)) or (0, []))[1]
        states = [r["state"] for r in results]
        if not results or "ok" in states:
            continue
        if "missing" in states:
            said = next(r['error'] for r in results if r['state'] == 'missing').split(": ")[-1]
            msg, level = f"{img} doesn't exist (the registry says: {said})", "error"
        elif all(s == "denied" for s in states):
            names = [SECRET_NAMES[r["secret"]] for r in results]
            who = f"Your {names[0]} can't" if len(names) == 1 else f"Neither your {names[0]} nor your {names[1]} can"
            msg, level = f"{who} read {img}, so the deployment can't pull it", "error"
        else:
            msg, level = f"Couldn't check {img}: {results[-1]['error']}", "info"
        issues.setdefault(key, []).append({"level": level, "message": msg})


def worker_addresses(values: dict) -> list[str]:
    """Host names of the lab machines the WORKER_<n>_* settings point at (resolved on the hypervisor)."""
    lab = machines.load()
    out = []
    for n in sorted({int(m.group(1)) for k in values if (m := WORKER_RE.match(k))}):
        m = machines.find_worker(lab, values.get(f"WORKER_{n}_NAME"), values.get(f"WORKER_{n}_BMC_IP"))
        if m and m["address"]:
            out.append(m["address"])
    return out


# ── Main entry point ─────────────────────────────────────────────────────────


async def analyze(p: Profile, layer: config.Settings) -> dict:
    mine = {k: e for k, e in layer.items() if not e.get("off")}
    # Loading the allocations may pull their clone; do it off the event loop, the checks below hit the cache.
    await asyncio.to_thread(lambda: (machines.load(), subnets.load()))
    user_env = config.render_env(layer, p.name)
    args = json.dumps({"automation_dir": p.automation_dir, "user_env_b64": base64.b64encode(user_env.encode()).decode(),
                       "resolve": worker_addresses(config.active_values(layer))})
    res = (await ssh.run(p, REMOTE_CONFIG, interp=("python3", "-"), args=(args,), timeout=60)).check("Analyzing config")
    remote = json.loads(res.out)
    if remote.get("no_clone"):
        # Every setting would be "not in the repo": say the one thing that's wrong instead.
        return {"no_clone": True, "rows": [], "facts": {}, "global_issues": [], "schema": None, "autofill": {},
                "dpu_host_cidr": None, "counts": {"error": 0, "warn": 0, "info": 0, "todo": 0}}
    meta, order = remote["meta"], remote["order"]
    sch = schema_mod.load(remote.get("schema_text"))
    preview, defaults, facts = remote["preview"], remote["defaults"]["env"], remote["facts"]
    # Remember the control-plane VMs' DHCP addresses, so they're known while the VMs are gone
    addrs = facts.setdefault("node_addrs", {})
    for vm, mac in (facts.get("vm_macs") or {}).items():
        if vm in addrs:
            config.node_address(p.host, mac, addrs[vm]["ip"])
        elif (known := config.node_address(p.host, mac)):
            addrs[vm] = {**known, "how": "remembered"}
    eff = preview["env"] if preview["ok"] else {**defaults, **config.app_defaults(p.name, config.active_values(layer)), **config.active_values(layer)}

    app_defs = config.app_defaults(p.name, config.active_values(layer))  # shown as the default where the app has its own
    issues: dict[str, list] = {}
    cross_rules(eff, facts, issues)
    same_cluster(p, eff, issues)
    await image_access(p, sch, eff, facts, issues)

    keys = list(dict.fromkeys(order + [k for k in layer if k not in order]))
    rows = []
    for key in keys:
        m = meta.get(key, {})
        entry = sch.entry(key)
        o = mine.get(key)
        known = bool(m.get("in_template"))
        top_layer = "set"
        row_issues = list(issues.get(key, []))
        if o and not known:
            source = "ignored"
            gone, gap = sch.removed.get(key), sch.not_templated.get(key)
            if gone:
                sha = str(gone.get("removed_in") or "") or None
                when = " ".join(x for x in (f"on {gone['date']}" if gone.get("date") else "", f"in {sha}" if sha else "") if x)
                msg = f"Removed from the automation repo{' ' + when if when else ''}: {str(gone.get('reason', '')).strip()}".rstrip(": ")
                if gone.get("replaced_by"):
                    fix = {"op": "rename", "layer": top_layer, "key": key, "to": gone["replaced_by"], "label": f"Rename to {gone['replaced_by']}"}
                else:
                    fix = {"op": "remove", "layer": top_layer, "key": key, "label": "Remove"}
                issue = {"level": "error" if gone.get("replaced_by") else "warn", "message": msg, "fix": fix}
                if sch.commit_url(sha):
                    issue["link"] = {"text": sha, "url": sch.commit_url(sha)}
                row_issues.insert(0, issue)
            elif gap:
                row_issues.insert(0, {"level": "warn", "message": "The automation reads this, but its config generation can't pass it through yet, so setting it here has no effect"
                                      + (f". {gap['notes']}" if gap.get("notes") else "")})
            else:
                row_issues.insert(0, {"level": "warn", "message": "Not a setting of this version of the automation repo, so it has no effect",
                                      "fix": {"op": "remove", "layer": top_layer, "key": key, "label": "Remove"}})
        elif o and entry.get("unused"):
            source = "ignored"
            row_issues.insert(0, {"level": "warn", "message": entry.get("unused_reason") or "Has no effect: this version of the automation repo never reads it",
                                  "fix": {"op": "remove", "layer": top_layer, "key": key, "label": "Remove"}})
        elif o:
            source = "set"
        else:
            source = "default"
        effective = eff.get(key) if known else None
        if source == "set" and effective is not None:
            row_issues = _check_format(key, effective, entry) + row_issues
        if m.get("required_msg") and not effective and source != "ignored" and _required_now(sch.params.get(key) or {}, eff):
            row_issues.append({"level": "todo", "message": "Required"})
        rows.append({
            "key": key,
            "section": entry.get("section") or m.get("section") or ("Not used by the repo" if not known else "Other"),
            "label": entry.get("label"),
            "description": entry.get("desc") or m.get("comment") or "",
            "unit": entry.get("unit"),
            "secret": bool(SECRET_RE.search(key)),
            "known": known,
            "source": source,
            "effective": effective,
            "default": (app_defs.get(key, defaults.get(key))) if known else None,
            "set": layer.get(key),
            "kind": entry.get("kind"),
            "choices": entry.get("choices"),
            "issues": row_issues,
            "important": bool(entry.get("important")),
            "unused": bool(entry.get("unused")),
        })

    global_issues = []
    if not preview["ok"]:
        # Missing required settings already show on their rows; anything else is worth a banner.
        todo = {r["key"] for r in rows if any(i["level"] == "todo" for i in r["issues"])}
        rest = []
        for line in (preview.get("error") or "unknown error").splitlines():
            m = re.match(r"^\S*: line \d+: (\w+): (.*)$", line)  # bash's "file: line N: VAR: message"
            if m and m.group(1) in todo:
                continue
            rest.append(m.group(2) if m else line)
        if rest:
            global_issues.append({"level": "error", "message": "make generate-env would fail: " + " ".join(rest)})
    counts = {lvl: sum(1 for r in rows for i in r["issues"] if i["level"] == lvl) for lvl in ("error", "warn", "info", "todo")}
    counts["error"] += len(global_issues)
    lab = machines.load()
    return {
        "rows": rows,
        "facts": facts,
        "global_issues": global_issues,
        "counts": counts,
        "schema": sch.source,
        # What follows from the hypervisor and the DPU hosts (the bridge, the DPU host subnet),
        # for the editor to fill in.
        "autofill": ops.autofill(p.name, json.loads(json.dumps(layer)), eff, facts, lab),
        "dpu_host_cidr": ops.host_subnet({**eff, **config.active_values(layer)}, lab, facts),
    }
