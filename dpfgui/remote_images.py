# Runs ON THE HYPERVISOR (piped to `python3 -`); standalone, python 3.9 compatible.
#
# Can these pull secrets read these images? For each image, asks its registry for the manifest
# (skopeo inspect --raw: no layers are downloaded) with each pull secret in turn, until one works.
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

A = json.loads(sys.argv[1])


def inspect(image, authfile):
    try:
        p = subprocess.run(["skopeo", "inspect", "--raw", "--retry-times", "1", "--authfile", authfile, "docker://" + image],
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, universal_newlines=True, timeout=45)
    except subprocess.TimeoutExpired:
        return "timeout", "the registry didn't answer"
    if p.returncode == 0:
        return "ok", ""
    err = (p.stderr or "").strip().splitlines()[-1] if (p.stderr or "").strip() else "exit %d" % p.returncode
    err = re.sub(r'^.*msg="?', "", err).rstrip('"')
    if re.search(r"unauthori[sz]ed|denied|authentication required|forbidden", err, re.I):
        return "denied", err
    if re.search(r"manifest unknown|not found|name unknown|no such", err, re.I):
        return "missing", err
    return "error", err


def check(image):
    results = []
    for f in A["authfiles"]:
        state, err = inspect(image, f["path"])
        results.append({"secret": f["key"], "state": state, "error": err})
        if state in ("ok", "missing"):  # readable, or doesn't exist for anyone
            break
    return image, results


if not shutil.which("skopeo"):
    print(json.dumps({"error": "skopeo isn't installed on the hypervisor"}))
else:
    with ThreadPoolExecutor(max_workers=6) as pool:
        print(json.dumps({"images": dict(pool.map(check, A["images"]))}))
