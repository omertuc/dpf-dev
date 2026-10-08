# Runs ON THE HYPERVISOR (piped to `python3 -`); standalone, python 3.9 compatible.
#
# Suggests addresses for the cluster's VIPs: in the bridge's subnet, not in the neighbour
# table, not excluded by the caller, and not answering ping. "Free" is a best guess: an
# address can be reserved or handed out by DHCP later without anything answering now.
import ipaddress
import json
import re
import subprocess
import sys

A = json.loads(sys.argv[1])


def run(argv):
    try:
        return subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, universal_newlines=True, timeout=10).stdout
    except (OSError, subprocess.TimeoutExpired):
        return ""


addrs = re.findall(r"inet (\d+\.\d+\.\d+\.\d+/\d+)", run(["ip", "-4", "addr", "show", "dev", A["bridge"]]))
if not addrs:
    print(json.dumps({"error": "%s has no IPv4 address" % A["bridge"]}))
    sys.exit(0)
iface = ipaddress.IPv4Interface(addrs[0])
net = iface.network
taken = {str(iface.ip)} | set(A.get("exclude") or [])
taken |= set(re.findall(r"^(\d+\.\d+\.\d+\.\d+) ", run(["ip", "-4", "neigh", "show"]), re.M))
hosts = [h for h in net.hosts() if str(h) not in taken]
# Skip the first and last few (gateways, switches) and go from the top down.
cands = [str(h) for h in reversed(hosts[10:-5] if len(hosts) > 30 else hosts)]
free = []
for i in range(0, len(cands), 32):
    batch = cands[i:i + 32]
    procs = {ip: subprocess.Popen(["ping", "-c", "1", "-W", "1", ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) for ip in batch}
    answered = set(re.findall(r"^(\d+\.\d+\.\d+\.\d+) .*lladdr", run(["ip", "-4", "neigh", "show"]), re.M))
    for ip, p in procs.items():
        if p.wait(timeout=5) != 0 and ip not in answered:
            free.append(ip)
    if len(free) >= A.get("count", 4):
        break
print(json.dumps({"subnet": str(net), "bridge": A["bridge"], "free": sorted(free[:A.get("count", 4)], key=ipaddress.IPv4Address)}))
