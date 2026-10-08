# Runs ON THE HYPERVISOR (piped to `python3 -`); standalone, python 3.9 compatible.
#
# The management cluster as Assisted Installer sees it, and its kubeconfigs, using aicli's
# library and token (~/.aicli, or AICLI_HOME from the automation repo's .env, like the repo).
# Assisted Installer has two: kubeconfig-noingress as soon as the install starts, and the full
# kubeconfig (with the ingress CA) once it's done. Also says whether the cluster's API answers.
# With "details", also the install's progress, hosts, operators and latest events (no files).
import contextlib
import io
import json
import os
import re
import socket
import ssl
import sys
import urllib.request

A = json.loads(sys.argv[1])
FILES = ("kubeconfig-noingress", "kubeconfig")


def env_value(key):
    try:
        with open(os.path.join(A["automation_dir"], ".env")) as f:
            for line in f:
                m = re.match(r"^(?:export\s+)?%s=(.*)$" % key, line.strip())
                if m:
                    return m.group(1).strip("\"'")
    except OSError:
        pass
    return None


def api_up(kubeconfig):
    m = re.search(r"^\s*server:\s*(\S+)", kubeconfig, re.M)
    if not m:
        return None
    ctx = ssl.create_default_context()
    ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
    try:
        with urllib.request.urlopen(m.group(1).rstrip("/") + "/readyz", timeout=4, context=ctx) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return e.code in (401, 403)  # answering, just not to anonymous requests
    except (urllib.error.URLError, socket.timeout, OSError):
        return False


def when(v):
    s = str(v) if v else ""
    return None if not s or s.startswith("0001-") else s


def details(ai, cid):
    from assisted_service_client import api
    c = ai.client.v2_get_cluster(cluster_id=cid).to_dict()
    pr = c.get("progress") or {}
    hosts = []
    for h in c.get("hosts") or []:
        hp = h.get("progress") or {}
        hosts.append({"name": h.get("requested_hostname"), "role": h.get("role"), "bootstrap": bool(h.get("bootstrap")),
                      "status": h.get("status"), "status_info": h.get("status_info"),
                      "stage": hp.get("current_stage"), "percent": hp.get("installation_percentage"),
                      "stage_started_at": when(hp.get("stage_started_at"))})
    ops = [{"name": o.get("name"), "status": o.get("status"), "status_info": o.get("status_info")}
           for o in c.get("monitored_operators") or [] if o.get("name")]
    try:
        evs = api.EventsApi(api_client=ai.api).v2_list_events(cluster_id=cid, limit=20, order="descending")
        events = [{"severity": e.get("severity"), "at": e.get("event_time"), "message": e.get("message")}
                  for e in (e if isinstance(e, dict) else e.to_dict() for e in evs or [])]
    except Exception as e:
        events = [{"severity": "warning", "at": None, "message": "Couldn't read the events: %s" % e}]
    return {"status": c.get("status"), "status_info": c.get("status_info"), "version": c.get("openshift_version"),
            "percent": pr.get("total_percentage"), "finalizing_stage": pr.get("finalizing_stage"),
            "stages": {"preparing": pr.get("preparing_for_installation_stage_percentage"),
                       "installing": pr.get("installing_stage_percentage"), "finalizing": pr.get("finalizing_stage_percentage")},
            "started_at": when(c.get("install_started_at")), "completed_at": when(c.get("install_completed_at")),
            "api_ips": [v.get("ip") for v in c.get("api_vips") or [] if v.get("ip")],
            "owner": c.get("user_name"),  # the Red Hat account aicli created it with
            "hosts": hosts, "operators": ops, "events": events}


def main():
    home = env_value("AICLI_HOME")
    if home:
        os.environ["HOME"] = home
    try:
        from ailib import AssistedClient
    except ImportError:
        return {"error": "aicli isn't installed on the hypervisor"}
    with contextlib.redirect_stdout(io.StringIO()):  # ailib prints as it goes
        ai = AssistedClient(os.environ.get("AI_URL") or "https://api.openshift.com", quiet=True)
        clusters = ai.list_clusters()
    # Matched by name and domain; Assisted Installer clusters are shared by everyone on the account.
    same = [c for c in clusters if c.get("name") == A["cluster"] and c.get("base_dns_domain") == A["domain"]]
    if not same:
        return {"cluster": None}
    if len(same) > 1:
        return {"cluster": None, "error": "%d clusters on Assisted Installer are called %s.%s" % (len(same), A["cluster"], A["domain"])}
    c = same[0]
    out = {"cluster": {"id": c["id"], "status": c.get("status"), "status_info": c.get("status_info")}, "files": {}}
    if A.get("details"):
        out["details"] = details(ai, c["id"])
        return out
    for name in FILES if c.get("status") in ("installing", "installing-pending-user-action", "finalizing", "installed", "adding-hosts") else ():
        try:
            r = ai.client.v2_download_cluster_credentials(cluster_id=c["id"], file_name=name, _preload_content=False)
            out["files"][name] = r.data.decode()
        except Exception as e:  # not there yet: the API answers 409 until the file exists
            out["files"][name] = None
            out.setdefault("not_yet", {})[name] = str(getattr(e, "reason", e))[:200]
    text = out["files"].get("kubeconfig") or out["files"].get("kubeconfig-noingress")
    out["api_up"] = api_up(text) if text else None
    return out


try:
    print(json.dumps(main(), default=str))
except Exception as e:  # report anything rather than a traceback the app can't read
    print(json.dumps({"error": "%s: %s" % (type(e).__name__, e)}))
