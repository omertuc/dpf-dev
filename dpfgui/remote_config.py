# Runs ON THE HYPERVISOR (piped to `python3 -`); standalone, python 3.9 compatible.
#
# Given a candidate user.env, reproduces what `source user.env && make generate-env`
# would write to .env (same files, same semantics: only *exported* variables reach
# generate-env), plus the pure repo defaults, plus facts about the hypervisor that
# the settings must agree with (bridge MTU/subnet, pull secret files, disk space...).
import base64
import glob
import ipaddress
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

ARGS = json.loads(sys.argv[1])
DIR = ARGS["automation_dir"]
USER_ENV = base64.b64decode(ARGS["user_env_b64"]).decode()

GEN = r'''
cd "$DPFGUI_DIR" || exit 90
if [ -n "$1" ]; then source "$1" >/dev/null || exit 91; fi
exec bash -c 'set -a; source ci/env.defaults; set +a; if [ -z "$DPFGUI_NOREQ" ]; then source ci/env.required || exit 92; fi; envsubst < ci/env.template'
'''


def read(path, default=None):
    try:
        with open(path) as f:
            return f.read()
    except OSError:
        return default


def user_values(text):
    """KEY -> value from the generated user.env (export KEY='value' lines)."""
    out = {}
    for line in (text or "").splitlines():
        m = re.match(r"^export ([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if m:
            try:
                parts = shlex.split(m.group(2))
                out[m.group(1)] = parts[0] if parts else ""
            except ValueError:
                pass
    return out


def parse_env(text):
    out = {}
    for line in (text or "").splitlines():
        if not line or line.lstrip().startswith("#"):
            continue
        k, sep, v = line.partition("=")
        if sep and re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", k):
            out[k] = v
    return out


def generate(user_env_path, check_required=True):
    env = {k: os.environ[k] for k in ("PATH", "HOME", "USER", "LOGNAME", "LANG") if k in os.environ}
    env["DPFGUI_DIR"] = DIR
    if not check_required:
        env["DPFGUI_NOREQ"] = "1"
    try:
        p = subprocess.run(["bash", "-c", GEN, "_", user_env_path or ""], env=env, cwd=DIR,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL,
                           timeout=30, universal_newlines=True)
    except (OSError, subprocess.TimeoutExpired) as e:
        return {"ok": False, "error": str(e), "env": {}}
    err = "\n".join(l for l in p.stderr.splitlines() if l.strip())
    return {"ok": p.returncode == 0, "rc": p.returncode, "error": err[-1500:], "env": parse_env(p.stdout)}


def describe_files():
    """Section headers and per-key comments from the repo's env files."""
    meta = {}
    order = []
    for fname in ("ci/env.template", "ci/env.defaults"):
        text = read(os.path.join(DIR, fname), "")
        section, comment, blank = None, [], True
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                blank, comment = True, []
                continue
            if line.startswith("#!"):
                continue
            if line.startswith("#"):
                c = line.lstrip("#").strip()
                if blank and not comment and c and not c.startswith("-") and len(c) < 60:
                    section = c
                    comment = []
                else:
                    comment.append(c)
                blank = False
                continue
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
            if m:
                k = m.group(1)
                e = meta.setdefault(k, {})
                if fname == "ci/env.template":
                    e["in_template"] = True
                    order.append(k)
                    e.setdefault("section", section)
                else:
                    e["in_defaults"] = True
                    d = re.match(r"^\$\{%s:-(.*)\}$" % k, m.group(2))
                    e["default_expr"] = d.group(1) if d else m.group(2)
                    if section and not e.get("section"):
                        e["section"] = section
                if comment and not e.get("comment"):
                    e["comment"] = " ".join(x for x in comment if x and not x.startswith("Syntax:"))
            comment, blank = [], False
    required = re.findall(r"\$\{(\w+):\?([^}]*)\}", read(os.path.join(DIR, "ci/env.required"), ""))
    for k, msg in required:
        meta.setdefault(k, {})["required_msg"] = msg
    return meta, order


def file_fact(path):
    if not path:
        return None
    p = os.path.expanduser(path)
    if not p.startswith("/"):
        p = os.path.join(DIR, p)
    fact = {"path": p, "exists": os.path.isfile(p)}
    if fact["exists"]:
        fact["size"] = os.path.getsize(p)
        try:
            with open(p) as f:
                data = json.load(f)
            fact["json"] = True
            fact["auths"] = sorted((data.get("auths") or {}).keys()) if isinstance(data, dict) else []
        except (ValueError, OSError, UnicodeDecodeError):
            fact["json"] = False
    return fact


def bridges():
    out = {}
    for d in glob.glob("/sys/class/net/*"):
        name = os.path.basename(d)
        if not os.path.isdir(os.path.join(d, "bridge")):
            continue
        out[name] = {"mtu": int((read(os.path.join(d, "mtu"), "0") or "0").strip() or 0),
                     "state": (read(os.path.join(d, "operstate"), "") or "").strip()}
    try:
        p = subprocess.run(["ip", "-j", "-4", "addr"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                           universal_newlines=True, timeout=10)
        for link in json.loads(p.stdout or "[]"):
            if link.get("ifname") in out:
                out[link["ifname"]]["ipv4"] = [
                    "%s/%s" % (a["local"], a["prefixlen"]) for a in link.get("addr_info", []) if a.get("family") == "inet"
                ]
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return out


def disk_free(path):
    if not path:
        return None
    p = path
    while p and not os.path.exists(p):
        p = os.path.dirname(p)
    try:
        u = shutil.disk_usage(p or "/")
        return {"path": path, "free": u.free, "total": u.total}
    except OSError:
        return None


def ping_many(ips):
    procs = {}
    for ip in ips:
        try:
            ipaddress.ip_address(ip)
        except ValueError:
            continue
        try:
            procs[ip] = subprocess.Popen(["ping", "-c", "1", "-W", "1", ip],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            pass
    return {ip: p.wait(timeout=5) == 0 for ip, p in procs.items()}


def run(argv, timeout=10):
    try:
        p = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, universal_newlines=True, timeout=timeout)
        return p.stdout if p.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def all_vms():
    """Every libvirt domain: {name: {state, mem_kib, vcpus}} (one virsh call)."""
    out = run(["virsh", "-c", "qemu:///system", "domstats", "--state", "--balloon", "--vcpu"], timeout=20)
    vms, cur = {}, None
    states = {"1": "running", "3": "paused", "5": "shut off"}
    for line in (out or "").splitlines():
        line = line.strip()
        m = re.match(r"^Domain: '(.*)'$", line)
        if m:
            cur = vms.setdefault(m.group(1), {"state": "unknown", "mem_kib": 0, "vcpus": 0})
            continue
        k, _, v = line.partition("=")
        if cur is None or not v:
            continue
        if k == "state.state":
            cur["state"] = states.get(v, "other")
        elif k == "balloon.maximum":
            cur["mem_kib"] = int(v)
        elif k == "vcpu.maximum":
            cur["vcpus"] = int(v)
    return vms


def vm_ip(name):
    for source in ("lease", "arp"):
        out = run(["virsh", "-c", "qemu:///system", "domifaddr", name, "--source", source])
        m = re.search(r"ipv4\s+(\d+\.\d+\.\d+\.\d+)/", out or "")
        if m:
            return m.group(1)
    return None


def resolve(names):
    """DNS answers (ignoring /etc/hosts) and /etc/hosts entries for each name."""
    hosts = {}
    for line in (read("/etc/hosts") or "").splitlines():
        parts = line.split("#")[0].split()
        for n in parts[1:]:
            hosts.setdefault(n, []).append(parts[0])
    have_dig = shutil.which("dig") is not None
    procs = {}
    for n in names:
        if have_dig and n:
            try:
                procs[n] = subprocess.Popen(["dig", "+short", "+time=2", "+tries=1", n, "A"],
                                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, universal_newlines=True)
            except OSError:
                pass
    out = {}
    for n in names:
        dns = None
        if n in procs:
            try:
                text, _ = procs[n].communicate(timeout=6)
                dns = [l for l in text.split() if re.match(r"^\d+\.\d+\.\d+\.\d+$", l)]
            except subprocess.TimeoutExpired:
                procs[n].kill()
        out[n] = {"dns": dns, "hosts": hosts.get(n, [])}
    return out


SECRET_DIRS = ["/root/secrets", os.path.expanduser("~/secrets")]


def secret_files():
    """Candidate pull secrets: JSON files in the usual secrets directories."""
    seen, out = set(), []
    for d in SECRET_DIRS:
        for path in sorted(glob.glob(os.path.join(d, "*"))):
            real = os.path.realpath(path)
            if real in seen or not os.path.isfile(path) or os.path.getsize(path) > 1024 * 1024:
                continue
            seen.add(real)
            f = file_fact(path)
            if f.get("json"):
                out.append(f)
    return out


def ssh_keys():
    out = []
    for path in sorted(set(glob.glob(os.path.expanduser("~/.ssh/*.pub")) + glob.glob("/root/secrets/*.pub"))):
        parts = (read(path, "") or "").split()
        out.append({"path": path, "type": parts[0] if parts else "", "comment": " ".join(parts[2:])})
    return out


def main():
    # Nothing to check the settings against (yet).
    if not os.path.isfile(os.path.join(DIR, "ci", "env.template")):
        json.dump({"no_clone": True}, sys.stdout)
        return
    tmp = tempfile.mkdtemp(prefix="dpfgui-")
    try:
        path = os.path.join(tmp, "user.env")
        with open(path, "w") as f:
            f.write(USER_ENV)
        os.chmod(path, 0o600)
        preview = generate(path)
        defaults = generate(None, check_required=False)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    meta, order = describe_files()
    # When generate-env fails (e.g. a required setting is still empty) the facts should still be
    # about the user's values, not the repo defaults.
    eff = preview["env"] or {**defaults["env"], **user_values(USER_ENV)}
    vms = all_vms()
    vm_macs = {}
    try:
        machine_id = (read("/etc/machine-id") or "").strip()
        prefix, count, mac_prefix = eff.get("VM_PREFIX", ""), int(eff.get("VM_COUNT") or 0), eff.get("MAC_PREFIX", "")
        for i in range(1, count + 1):
            name = "%s%d" % (prefix, i)
            if mac_prefix:
                vm_macs[name] = "52:54:00:%s:%02x" % (mac_prefix.lower(), i)
            elif machine_id:
                h = __import__("hashlib").sha256(("%s-%s" % (machine_id, name)).encode()).hexdigest()[:10]
                vm_macs[name] = "52:54:00:%s:%s:%s" % (h[0:2], h[2:4], h[4:6])
    except ValueError:
        pass
    prefixes = [px for px in (eff.get("VM_PREFIX"), eff.get("VM_WORKER_PREFIX")) if px]
    my_running = [n for n, v in vms.items() if v["state"] == "running" and any(n.startswith(px) for px in prefixes)]
    for n in my_running:
        vms[n]["ip"] = vm_ip(n)
    # Where the control-plane VMs are (or were recently): the running VM's address, or the
    # hypervisor's neighbor table entry for its MAC.
    neigh = {}
    try:
        for e in json.loads(run(["ip", "-j", "-4", "neigh", "show"]) or "[]"):
            if e.get("lladdr") and e.get("dst"):
                neigh[e["lladdr"].lower()] = e["dst"]
    except ValueError:
        pass
    node_addrs = {}
    for n, mac in vm_macs.items():
        if (vms.get(n) or {}).get("ip"):
            node_addrs[n] = {"ip": vms[n]["ip"], "how": "running"}
        elif neigh.get(mac):
            node_addrs[n] = {"ip": neigh[mac], "how": "neighbor"}
    mem = {}
    for line in (read("/proc/meminfo") or "").splitlines():
        k, _, rest = line.partition(":")
        if rest.split():
            mem[k] = int(rest.split()[0])
    facts = {
        "hostname": os.uname()[1],
        "bridges": bridges(),
        "files": {k: file_fact(eff.get(k)) for k in ("OPENSHIFT_PULL_SECRET", "DPF_PULL_SECRET", "SSH_KEY")},
        "disk": {k: disk_free(eff.get(k)) for k in ("DISK_PATH", "ISO_FOLDER")},
        "mem_available_kib": mem.get("MemAvailable"),
        "mem_total_kib": mem.get("MemTotal"),
        "cpus": os.cpu_count(),
        "vms": vms,
        "vm_macs": vm_macs,
        "node_addrs": node_addrs,
        "my_running_vms": my_running,
        # Only the lab machines' own names: looking up the cluster's names before their records
        # exist would get NXDOMAIN cached by the DNS servers.
        "dns": resolve(list(ARGS.get("resolve") or [])),
        "secret_files": secret_files(),
        "ssh_keys": ssh_keys(),
        "vip_ping": ping_many([eff.get(k) for k in ("API_VIP", "INGRESS_VIP", "HYPERSHIFT_API_IP") if eff.get(k)])
        if not my_running else {},  # only meaningful when nothing of yours is up
        "repo_head": (read(os.path.join(DIR, ".git", "HEAD"), "") or "").strip(),
    }
    schema_text = read(os.path.join(DIR, "ci", "env.schema.yaml"))
    json.dump({"preview": preview, "defaults": defaults, "meta": meta, "order": order, "facts": facts,
               "schema_text": schema_text}, sys.stdout)


main()
