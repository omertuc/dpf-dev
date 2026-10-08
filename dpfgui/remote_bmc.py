# Runs ON THE HYPERVISOR (piped to `python3 -`); standalone, python 3.9 compatible.
#
# Asks a host's BMC (Redfish) for its NICs, which doubles as a check of the BMC login,
# and finds which NIC carries the host's address (its MAC as seen on the local L2).
# The JSON arguments (base64) are substituted below rather than passed on the command line,
# so the BMC password never shows up in `ps`.
import base64
import json
import re
import socket
import ssl
import subprocess
import urllib.error
import urllib.request

A = json.loads(base64.b64decode("__ARGS__").decode())
CTX = ssl._create_unverified_context()
AUTH = "Basic " + base64.b64encode(("%s:%s" % (A["user"], A["password"])).encode()).decode()


def get(path, tries=2):
    # BMCs answer logged-in requests slowly now and then: wait a while, and try twice.
    req = urllib.request.Request("https://%s%s" % (A["bmc"], path), headers={"Authorization": AUTH, "Accept": "application/json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
                return json.load(r)
        except (socket.timeout, urllib.error.URLError) as e:
            if isinstance(e, urllib.error.HTTPError) or attempt == tries - 1:
                raise


out = {"nics": [], "auth": None, "error": None}
try:
    system = get(get("/redfish/v1/Systems")["Members"][0]["@odata.id"])
    out["model"] = system.get("Model")
    out["power"] = system.get("PowerState")
    for m in get(system["EthernetInterfaces"]["@odata.id"]).get("Members", []):
        d = get(m["@odata.id"])
        out["nics"].append({"id": d.get("Id"), "mac": (d.get("MACAddress") or d.get("PermanentMACAddress") or "").upper(),
                            "link": d.get("LinkStatus"), "speed": d.get("SpeedMbps"), "name": d.get("Description") or d.get("Name")})
    out["auth"] = True
except urllib.error.HTTPError as e:
    out["auth"] = False if e.code in (401, 403) else None
    out["error"] = "The BMC refused the login" if e.code in (401, 403) else "BMC answered HTTP %d" % e.code
except Exception as e:  # unreachable BMC, not Redfish, ...
    out["error"] = str(getattr(e, "reason", e))

if A.get("host"):
    try:
        ip = socket.gethostbyname(A["host"])
        out["host_ip"] = ip
        subprocess.run(["ping", "-c", "1", "-W", "1", ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
        neigh = subprocess.run(["ip", "neigh", "show", ip], stdout=subprocess.PIPE, universal_newlines=True, timeout=5).stdout
        m = re.search(r"lladdr ([0-9a-f:]{17})", neigh)
        out["arp_mac"] = m.group(1).upper() if m else None
    except (OSError, subprocess.TimeoutExpired):
        pass

print(json.dumps(out))
