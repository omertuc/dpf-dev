# Runs ON THE HYPERVISOR (piped to `python3 -`), so it must stay standalone and
# compatible with the system python there (3.9). Prints one JSON document.
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import time

ARGS = json.loads(sys.argv[1])
DIR = ARGS["automation_dir"]
STATE = os.path.join(os.path.expanduser("~"), ARGS["state_dir"])
# Which profile, on which laptop, this clone belongs to (in .git, so git status doesn't see it).
OWNER_FILE = os.path.join(DIR, ".git", "dpf-dev-owner.json")
ENV_KEYS = ["CLUSTER_NAME", "VM_PREFIX", "VM_WORKER_PREFIX", "KUBECONFIG", "HOSTED_CLUSTER_NAME",
            "VM_COUNT", "RAM", "OPENSHIFT_VERSION", "BASE_DOMAIN"]
VIRSH = ["virsh", "-c", "qemu:///system"]
STATES = {0: "nostate", 1: "running", 2: "blocked", 3: "paused", 4: "shutdown",
          5: "shut off", 6: "crashed", 7: "suspended"}


def sh(cmd, timeout=20, cwd=None):
    try:
        p = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           stdin=subprocess.DEVNULL, timeout=timeout, universal_newlines=True)
        return p.returncode, p.stdout, p.stderr
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, "", str(e)


def read(path, default=None):
    try:
        with open(path) as f:
            return f.read()
    except OSError:
        return default


def mtime(path):
    try:
        return int(os.path.getmtime(path))
    except OSError:
        return None


def parse_env(text):
    out = {}
    for line in (text or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        k, sep, v = line.partition("=")
        if sep and re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", k):
            out[k] = v.strip().strip("'\"")
    return out


def kubeconfig_server(path):
    m = re.search(r"^\s*server:\s*['\"]?([^'\"\s]+)", read(path) or "", re.M)
    return m.group(1) if m else None


def owner():
    """The clone's owner marker; with ARGS["claim"], written first if the clone has none."""
    try:
        return json.loads(read(OWNER_FILE) or "null")
    except ValueError:
        return {"invalid": True}


def claim(marker):
    if os.path.isdir(os.path.dirname(OWNER_FILE)) and not os.path.exists(OWNER_FILE):
        tmp = OWNER_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(marker, f, indent=2)
        os.replace(tmp, OWNER_FILE)


def host_info():
    mem = {}
    for line in (read("/proc/meminfo") or "").splitlines():
        k, _, rest = line.partition(":")
        parts = rest.split()
        if parts:
            mem[k] = int(parts[0])
    return {
        "hostname": os.uname()[1],
        "cpus": os.cpu_count(),
        "load": list(os.getloadavg()),
        "mem_total_kib": mem.get("MemTotal", 0),
        "mem_available_kib": mem.get("MemAvailable", 0),
        "mem_free_kib": mem.get("MemFree", 0),
        "swap_total_kib": mem.get("SwapTotal", 0),
        "swap_free_kib": mem.get("SwapFree", 0),
    }


def vms():
    rc, out, err = sh(VIRSH + ["domstats", "--raw", "--state", "--balloon", "--vcpu"], timeout=30)
    if rc != 0:
        return None, (err or out).strip()
    result, cur = [], None
    for line in out.splitlines():
        m = re.match(r"^Domain: '(.*)'$", line)
        if m:
            cur = {"name": m.group(1)}
            result.append(cur)
            continue
        k, sep, v = line.strip().partition("=")
        if not sep or cur is None:
            continue
        if k == "state.state":
            cur["state"] = STATES.get(int(v), v)
        elif k == "balloon.current":
            cur["mem_kib"] = int(v)
        elif k == "balloon.maximum":
            cur["max_mem_kib"] = int(v)
        elif k == "balloon.rss":
            cur["rss_kib"] = int(v)
        elif k == "vcpu.current":
            cur["vcpus"] = int(v)
    return sorted(result, key=lambda d: d["name"]), None


def repo(fetch):
    if not os.path.isdir(os.path.join(DIR, ".git")):
        return {"exists": os.path.isdir(DIR), "git": False}
    info = {"exists": True, "git": True}
    if fetch:
        rc, _, err = sh(["git", "fetch", "--quiet"], timeout=25, cwd=DIR)
        info["fetch_error"] = err.strip()[-300:] if rc else None
    _, out, _ = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=DIR)
    info["branch"] = out.strip()
    _, out, _ = sh(["git", "log", "-1", "--format=%h%x00%s%x00%ct%x00%an"], cwd=DIR)
    parts = out.strip().split("\0")
    if len(parts) == 4:
        info["head"] = {"sha": parts[0], "subject": parts[1], "time": int(parts[2]), "author": parts[3]}
    rc, out, _ = sh(["git", "rev-parse", "--abbrev-ref", "@{upstream}"], cwd=DIR)
    info["upstream"] = out.strip() if rc == 0 else None
    if info["upstream"]:
        _, out, _ = sh(["git", "rev-list", "--left-right", "--count", "HEAD...@{upstream}"], cwd=DIR)
        try:
            info["ahead"], info["behind"] = [int(x) for x in out.split()]
        except ValueError:
            pass
    _, out, _ = sh(["git", "status", "--porcelain", "--untracked-files=no"], cwd=DIR)
    info["dirty"] = len([l for l in out.splitlines() if l.strip()])
    fh = os.path.join(DIR, ".git", "FETCH_HEAD")
    info["fetched_at"] = mtime(fh)
    return info


def pid_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def jobs(limit=12):
    out = []
    metas = sorted(glob.glob(os.path.join(STATE, "*.json")), reverse=True)[:limit]
    for path in metas:
        base = path[:-5]
        try:
            meta = json.loads(read(path) or "{}")
        except ValueError:
            continue
        rc = read(base + ".rc")
        pid = read(base + ".pid")
        pid = int(pid) if pid and pid.strip().isdigit() else None
        if rc is not None and rc.strip().lstrip("-").isdigit():
            meta["status"] = "succeeded" if int(rc) == 0 else ("cancelled" if int(rc) in (130, 143) else "failed")
            meta["rc"] = int(rc)
        elif pid and pid_alive(pid):
            meta["status"] = "running"
        else:
            meta["status"] = "lost"
        meta["pid"] = pid
        meta["ended"] = mtime(base + ".rc")
        stages = {}
        for line in (read(base + ".stages") or "").splitlines():
            name, _, code = line.partition(" ")
            if code.strip().lstrip("-").isdigit():
                stages[name] = int(code)
        meta["stage_results"] = stages
        meta["log_size"] = os.path.getsize(base + ".log") if os.path.exists(base + ".log") else 0
        out.append(meta)
    return out


def our_pgids(job_list):
    return {j["pid"] for j in job_list if j.get("status") == "running" and j.get("pid")}


def external_makes(ours):
    """`make` processes running inside the automation dir that we did not start."""
    found = []
    real_dir = os.path.realpath(DIR)
    for p in glob.glob("/proc/[0-9]*"):
        try:
            if read(p + "/comm", "").strip() != "make":
                continue
            if os.path.realpath(os.readlink(p + "/cwd")) != real_dir:
                continue
            stat = read(p + "/stat", "")
            pgid = int(stat.rsplit(")", 1)[1].split()[2])
            if pgid in ours:
                continue
            cmd = (read(p + "/cmdline", "") or "").replace("\0", " ").strip()
            started = None
            try:
                started = int(os.stat(p).st_mtime)
            except OSError:
                pass
            found.append({"pid": int(p.rsplit("/", 1)[1]), "cmd": cmd, "started": started})
        except (OSError, ValueError, IndexError):
            continue
    # `make all` re-invokes make, so one run shows up as several processes;
    # the lowest pid is the outermost one.
    return sorted(found, key=lambda d: d["pid"])[:5]


def workers(env):
    """The physical workers `make clean-all` / `make all` act on (no credentials)."""
    try:
        n = int(env.get("WORKER_COUNT") or 0)
    except ValueError:
        n = 0
    return [{"n": i, "name": env.get("WORKER_%d_NAME" % i) or "", "bmc_ip": env.get("WORKER_%d_BMC_IP" % i) or ""}
            for i in range(1, n + 1)]


def main():
    t0 = time.time()
    if ARGS.get("claim"):
        try:
            claim(ARGS["claim"])
        except OSError:
            pass  # unclaimed; the jobs claim it too
    env_text = read(os.path.join(DIR, ".env"))
    user_env = read(os.path.join(DIR, "user.env"))
    env = parse_env(env_text)
    kc = env.get("KUBECONFIG")
    kc_path = (kc if kc.startswith("/") else os.path.join(DIR, kc)) if kc else None
    vm_list, vm_error = vms()
    job_list = jobs()
    latest_make_logs = sorted(glob.glob(os.path.join(DIR, "logs", "make_all_*.log")))[-1:]
    result = {
        "host": host_info(),
        "vms": vm_list,
        "vm_error": vm_error,
        "repo": repo(ARGS.get("fetch")),
        "env": {k: env[k] for k in ENV_KEYS if k in env},
        "workers": workers(env),
        "env_exists": env_text is not None,
        "env_mtime": mtime(os.path.join(DIR, ".env")),
        "user_env": {
            "exists": user_env is not None,
            "sha256": hashlib.sha256(user_env.encode()).hexdigest() if user_env is not None else None,
            "mtime": mtime(os.path.join(DIR, "user.env")),
        },
        "kubeconfig": {"path": kc_path, "mtime": mtime(kc_path) if kc_path else None,
                       "server": kubeconfig_server(kc_path) if kc_path else None},
        "owner": owner(),
        "jobs": job_list,
        "external_makes": external_makes(our_pgids(job_list)),
        "latest_make_log": (
            {"path": latest_make_logs[0], "mtime": mtime(latest_make_logs[0])} if latest_make_logs else None
        ),
        "now": int(time.time()),
    }
    result["elapsed_ms"] = int((time.time() - t0) * 1000)
    json.dump(result, sys.stdout)


main()
