# Runs ON THE HYPERVISOR (piped to `python3 -`); standalone, python 3.9 compatible.
#
# Whose Red Hat accounts a deployment uses: the one aicli is logged in as (its cached access
# token's identity claims; the token itself is never printed) and the one the OpenShift pull
# secret belongs to (its entries' email and user names, never the credentials).
import base64
import json
import os
import re
import sys

A = json.loads(sys.argv[1])
DIR = A["automation_dir"]


def env_value(key):
    try:
        with open(os.path.join(DIR, ".env")) as f:
            for line in f:
                m = re.match(r"^(?:export\s+)?%s=(.*)$" % key, line.strip())
                if m:
                    return m.group(1).strip("\"'")
    except OSError:
        pass
    return None


def claims(path):
    try:
        with open(path) as f:
            part = f.read().strip().split(".")[1]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    except (OSError, IndexError, ValueError):
        return None


def aicli():
    # Like the repo: aicli finds ~/.aicli in AICLI_HOME when set, else $HOME.
    home = env_value("AICLI_HOME") or os.path.expanduser("~")
    d = os.path.join(home, ".aicli")
    offline = claims(os.path.join(d, "offlinetoken.txt"))
    if not offline:
        return {"dir": d, "error": "No aicli token in %s" % d}
    token = claims(os.path.join(d, "token.txt"))
    if not token or token.get("sub") != offline.get("sub"):
        # The cached access token is from another login (or missing); aicli replaces it on its next run.
        return {"dir": d, "unknown": True}
    name = " ".join(x for x in (token.get("given_name") or token.get("first_name"), token.get("family_name") or token.get("last_name")) if x)
    return {"dir": d, "name": name, "email": token.get("email"), "username": token.get("preferred_username") or token.get("username"),
            "org_id": token.get("org_id"), "account_number": token.get("account_number")}


def pull_secret():
    path = A.get("pull_secret")
    if not path:
        return {"error": "No OpenShift pull secret is set"}
    path = os.path.expanduser(path)
    if not path.startswith("/"):
        path = os.path.join(DIR, path)
    try:
        with open(path) as f:
            auths = (json.load(f) or {}).get("auths") or {}
    except (OSError, ValueError) as e:
        return {"path": path, "default": A.get("default"), "error": "Can't read it: %s" % (getattr(e, "strerror", None) or e)}
    entries = []
    for reg, v in sorted(auths.items()):
        user = ""
        try:
            user = base64.b64decode(v.get("auth") or "").decode().split(":", 1)[0]
        except (ValueError, UnicodeDecodeError):
            pass
        entries.append({"registry": reg, "email": v.get("email"), "user": user if user and not user.startswith("ey") else ""})
    # The Red Hat account is the email on the Red Hat registries' entries (cloud.openshift.com first).
    rh = [e for e in entries if e["email"] and (e["registry"] in ("cloud.openshift.com", "registry.redhat.io", "registry.connect.redhat.com", "quay.io"))]
    rh.sort(key=lambda e: e["registry"] != "cloud.openshift.com")
    return {"path": path, "default": A.get("default"), "email": rh[0]["email"] if rh else None}


print(json.dumps({"aicli": aicli(), "pull_secret": pull_secret()}))
