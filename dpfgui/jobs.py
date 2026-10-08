"""Long-running actions executed on the hypervisor.

Every action (git pull, make clean-all, pushing user.env, make all) runs as a
*job*: a generated bash script started with `setsid nohup` so it survives the
browser, this server and the ssh connection going away. Files live in
~/.dpf-gui/<automation-dir-slug>/ on the hypervisor:

    <id>.json    metadata (title, stages, options)
    <id>.sh      the generated script
    <id>.log     combined stdout/stderr
    <id>.pid     pid == process group id of the job
    <id>.stages  "<stage> <exit code>" per finished stage
    <id>.rc      final exit code (written on exit, also when cancelled)

The log contains `::dpfgui::` marker lines which the UI turns into progress.
"""

from __future__ import annotations

import base64
import json
import re
import shlex
import time
from typing import AsyncIterator

from . import config, identity, schema as schema_mod, ssh
from .config import Profile

STAGES: dict[str, str] = {
    "clone": "Clone automation repo",
    "pull": "Pull automation repo",
    "pull-rebase": "Pull automation repo with rebase",
    "clean": "Clean up existing deployment",
    "clean-workers": "Power off physical workers",
    "clean-vms": "Destroy VMs",
    "clean-cluster": "Delete cluster & generated files",
    "config": "Push user.env & generate .env",
    "install": "make all",
}
STAGE_ORDER = list(STAGES)
OWNER_FILE = ".git/dpf-dev-owner.json"  # in the clone (see config.clone_conflict)
CLEAN_STAGES = [s for s in STAGES if s.startswith("clean")]


class JobError(RuntimeError):
    pass


def _state(p: Profile) -> str:
    return f'"$HOME"/{shlex.quote(p.remote_state_dir)}'


def _make_run(cmd: str) -> str:
    """Run a script command the way a Makefile recipe would (with .env included and exported)."""
    return f"make -s --no-print-directory --eval {shlex.quote('__dpfgui_run: ; @' + cmd)} __dpfgui_run"


# Appended to the stages that destroy VMs: wait for them to disappear, then report.
VERIFY_VMS = r"""
echo
echo "Verifying your VMs are gone..."
vmp=$(env_value VM_PREFIX); wp=$(env_value VM_WORKER_PREFIX)
if [ -z "$vmp" ]; then echo "VM_PREFIX is not set in .env; cannot verify."; return 1; fi
for attempt in 1 2 3 4 5 6; do
    remaining=$(virsh -c qemu:///system list --all --name | awk -v a="$vmp" -v b="$wp" \
        'NF && (index($0, a) == 1 || (b != "" && index($0, b) == 1))')
    [ -z "$remaining" ] && break
    sleep 5
done
if [ -n "$remaining" ]; then
    echo "These VMs still exist:"; echo "$remaining" | sed 's/^/  - /'
    return 1
fi
echo "No VMs matching '${vmp}'${wp:+ or '$wp'} remain."
return $rc
"""


def _stage_body(stage: str) -> str:
    if stage == "clone":
        repo = schema_mod.load(None).repository or "https://github.com/rh-ecosystem-edge/openshift-dpf"
        return f"""
if [ -f "$DIR/ci/env.template" ]; then echo "$DIR is already an openshift-dpf checkout"; return 0; fi
if [ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then echo "$DIR exists and isn't empty"; return 1; fi
mkdir -p "$(dirname "$DIR")" || return
git clone --progress {shlex.quote(repo)} "$DIR" || return
git -C "$DIR" log -1 --format='Now at %h  %s  (%cr)'
fork_remote
"""
    if stage == "pull-rebase":  # for when the remote branch was force-pushed and --ff-only can't
        return r"""
fork_remote
if ! git pull --rebase; then
    git rebase --abort 2>/dev/null
    echo
    echo "git pull --rebase didn't go through (see above), so the branch is as it was."
    echo "Sort it out in a shell (the Shell button copies the ssh command), or reset to the remote branch there."
    return 1
fi
git log -1 --format='Now at %h  %s  (%cr)'
"""
    if stage == "pull":
        return r"""
fork_remote
git pull --ff-only || return
git log -1 --format='Now at %h  %s  (%cr)'
"""
    # The clean-* stages are the individual steps of `make clean-all`, minus the ones not asked for.
    # They act on what .env names, so it has to be this profile's first (see build_script).
    if stage == "clean":
        return "rc=0\nmake clean-all || rc=$?\n" + VERIFY_VMS
    if stage == "clean-workers":
        return _make_run("$(WORKER_SCRIPT) shutoff-all-workers")
    if stage == "clean-vms":
        return "rc=0\nmake delete-worker-vms || rc=$?\nmake delete-vms || rc=$?\n" + VERIFY_VMS
    if stage == "clean-cluster":
        return _make_run("$(CLUSTER_SCRIPT) clean-all")
    if stage == "config":
        return "push_env"
    if stage == "install":
        return r"""
echo "::dpfgui::steps $(make -s --no-print-directory --eval '__dpfgui_steps: ; @echo $(ALL_STEPS)' __dpfgui_steps 2>/dev/null)"
make --debug=b all
"""
    raise JobError(f"unknown stage {stage}")


def _fork_remote(fork: str | None) -> str:
    """Your GitHub fork of the automation repo as a remote named after you: fetched over https
    (no credentials needed on the hypervisor), pushed over ssh."""
    if not fork:
        return "fork_remote() { :; }"
    name = shlex.quote(fork.split("/")[0])
    return f"""fork_remote() {{
if ! git -C "$DIR" remote get-url {name} >/dev/null 2>&1; then
    git -C "$DIR" remote add {name} {shlex.quote(f"https://github.com/{fork}.git")} &&
        git -C "$DIR" remote set-url --push {name} {shlex.quote(f"git@github.com:{fork}.git")} &&
        echo "Added your fork {fork} as the remote {fork.split("/")[0]}" || return 0
fi
git -C "$DIR" fetch --quiet --prune {name} && echo "Fetched your fork's branches" ||
    echo "Couldn't fetch your fork {fork} (does it exist?)"
return 0
}}"""


def _push_env(user_env: str) -> str:
    b64 = base64.b64encode(user_env.encode()).decode()
    return f"""push_env() {{
[ -f user.env ] && [ ! -e "$STATE/$ID.user.env.previous" ] && cp -p user.env "$STATE/$ID.user.env.previous"
base64 -d > user.env.dpfgui.tmp <<'__DPFGUI_EOF__' || return
{b64}
__DPFGUI_EOF__
mv user.env.dpfgui.tmp user.env || return
echo "Wrote user.env with $(grep -c '^export ' user.env) settings"
echo
( source ./user.env && make generate-env FORCE=true )
}}"""


def build_script(p: Profile, job_id: str, stages: list[str], user_env: str | None, claim: bool = False,
                 fork: str | None = None) -> str:
    # make clean-* needs a .env, which a fresh clone doesn't have yet.
    first_clean = next((s for s in stages if s in CLEAN_STAGES), None)

    def body(stage: str) -> str:
        b = _stage_body(stage).strip()
        return f'[ -f .env ] || {{ echo "No .env yet: pushing user.env first"; push_env || return; echo; }}\n{b}' if stage == first_clean else b

    # An unmarked clone becomes this profile's (config.clone_conflict) once there's one to mark.
    mark = f"[ -d .git ] && [ ! -e {OWNER_FILE} ] && {_write_owner(p)}" if claim else ""
    funcs = "\n".join([_fork_remote(fork)] + ([_push_env(user_env)] if user_env is not None else [])
                      + [f"stage_{s.replace('-', '_')}() {{\n{body(s)}\n}}" for s in stages])
    # A clone has to happen before there is a directory to cd into.
    first = "run_stage clone || exit $?" if "clone" in stages else ""
    calls = "\n".join(f"run_stage {s} || exit $?" for s in stages if s != "clone")
    return f"""#!/bin/bash
# Generated by dpf-dev-gui. Job {job_id}.
ID={shlex.quote(job_id)}
STATE={_state(p)}
DIR={shlex.quote(p.automation_dir)}
exec >>"$STATE/$ID.log" 2>&1 </dev/null
trap 'rc=$?; echo "$rc" > "$STATE/$ID.rc"' EXIT
trap 'echo; echo "::dpfgui::cancelled"; exit 130' TERM INT HUP
export TERM=xterm-256color

env_value() {{ sed -n "s/^\\(export \\)\\{{0,1\\}}$1=//p" .env 2>/dev/null | tail -1 | tr -d "\\"'"; }}

run_stage() {{
    echo "::dpfgui::stage-start $1 $(date +%s)"
    "stage_${{1//-/_}}"; local rc=$?
    echo "::dpfgui::stage-end $1 $rc $(date +%s)"
    echo "$1 $rc" >> "$STATE/$ID.stages"
    return $rc
}}

{funcs}

echo "::dpfgui::job-start $(date +%s) on $(hostname -s) in $DIR"
{first}
cd "$DIR" || exit 1
{mark}
{calls}
echo "::dpfgui::job-end $(date +%s)"
"""


def new_job_id(stages: list[str]) -> str:
    kind = stages[0] if len(stages) == 1 else "deploy"
    return time.strftime("%Y%m%d-%H%M%S") + f"-{kind}"


async def clone_owner(p: Profile) -> dict | None:
    r = await ssh.run(p, f"cat {shlex.quote(p.automation_dir)}/{OWNER_FILE} 2>/dev/null", timeout=20)
    try:
        return json.loads(r.out) if r.out.strip() else None
    except ValueError:
        return {"invalid": True}


def _write_owner(p: Profile) -> str:
    marker = base64.b64encode(json.dumps(config.owner_marker(p), indent=2).encode()).decode()
    return f"echo {marker} | base64 -d > {OWNER_FILE}"


async def take_over(p: Profile) -> None:
    """Mark the clone as this profile's, whoever it belonged to."""
    conflict = config.clone_conflict(p, await clone_owner(p))
    if conflict and conflict["kind"] == "shared":  # still in use by a profile here
        raise JobError(config.describe_conflict(conflict))
    script = f"cd {shlex.quote(p.automation_dir)} && [ -d .git ] && {_write_owner(p)}"
    (await ssh.run(p, script, timeout=20)).check("Marking the clone as this profile's")


def _your_fork() -> str | None:
    """<your GitHub login>/<the repo's name>: where GitHub puts your fork (not checked)."""
    me = identity.me()
    repo = (schema_mod.load(None).repository or "https://github.com/rh-ecosystem-edge/openshift-dpf").rstrip("/")
    return f"{me[0]}/{repo.rsplit('/', 1)[1].removesuffix('.git')}" if me else None


# Exits 3 (printing BUSY <job>) if a job of this clone is still running.
_BUSY = r"""
for pf in "$STATE"/*.pid; do
    [ -e "$pf" ] || continue
    j=${pf%.pid}
    [ -e "$j.rc" ] && continue
    if kill -0 "$(cat "$pf")" 2>/dev/null; then echo "BUSY ${j##*/}"; exit 3; fi
done
"""


async def _deletable(p: Profile) -> None:
    d = p.automation_dir.rstrip("/")
    if d.count("/") < 3:  # /root/x would take more than a clone with it
        raise JobError(f"Won't delete {d or '/'}: too close to /")
    conflict = config.clone_conflict(p, await clone_owner(p))
    if conflict:
        raise JobError(config.describe_conflict(conflict))


async def clone_info(p: Profile) -> dict:
    """What deleting the profile's clone would lose: {dirty, unpushed, stashes, env, kubeconfigs}."""
    await _deletable(p)
    script = f"""
STATE={_state(p)}
{_BUSY}
cd {shlex.quote(p.automation_dir)} || exit 4
[ -f ci/env.template ] && [ -d .git ] || exit 5
echo "DIRTY=$(git status --porcelain 2>/dev/null | wc -l)"
echo "UNPUSHED=$(git log --branches --not --remotes --oneline 2>/dev/null | wc -l)"
echo "STASHES=$(git stash list 2>/dev/null | wc -l)"
echo "ENV=$([ -f .env ] && echo 1)"
echo "KUBECONFIGS=$(ls -d *kubeconfig* 2>/dev/null | tr '\n' ' ')"
"""
    r = await ssh.run(p, script, timeout=30)
    if r.rc == 3:
        raise JobError("A job is running in this clone")
    if r.rc in (4, 5):
        raise JobError(f"{p.automation_dir} isn't an openshift-dpf clone on {p.host}")
    r.check("Looking at the clone")
    kv = dict(line.partition("=")[::2] for line in r.out.splitlines() if "=" in line)
    return {"dir": p.automation_dir, "dirty": int(kv.get("DIRTY") or 0), "unpushed": int(kv.get("UNPUSHED") or 0),
            "stashes": int(kv.get("STASHES") or 0), "env": bool(kv.get("ENV")), "kubeconfigs": kv.get("KUBECONFIGS", "").split()}


async def delete_clone(p: Profile) -> None:
    """rm -rf the profile's clone (its job logs, kept outside it, stay)."""
    await _deletable(p)
    script = f"""
STATE={_state(p)}
{_BUSY}
cd {shlex.quote(p.automation_dir)} && [ -f ci/env.template ] && [ -d .git ] || exit 5
cd / && rm -rf -- {shlex.quote(p.automation_dir)} || exit
rmdir -- "$(dirname {shlex.quote(p.automation_dir)})" 2>/dev/null  # ~/user-envs/<you>/<profile>, if that's all it held
true
"""
    r = await ssh.run(p, script, timeout=120)
    if r.rc == 3:
        raise JobError("A job is running in this clone")
    if r.rc == 5:
        raise JobError(f"{p.automation_dir} isn't an openshift-dpf clone on {p.host}")
    r.check("Deleting the clone")


# ── Branches ─────────────────────────────────────────────────────────────────

_REF_RE = re.compile(r"^(?!-)[\w.\-/]+$")


async def branches(p: Profile, fetch: bool = False) -> dict:
    """The clone's branches and the remotes' (ones a local branch tracks are listed once, as that
    local branch), newest commit first: {current, branches: [{name, remote, local, upstream,
    time, author, subject, sha}], fetch_error?}"""
    # Fetching also adds your fork's remote to clones made before that was automatic.
    fetching = f"""{_fork_remote(_your_fork())}
fork_remote >/dev/null
err=$(timeout 40 git fetch --all --prune --quiet 2>&1) || echo "FETCH_ERROR=$(echo "$err" | tail -1)"
""" if fetch else ""
    script = f"""
DIR={shlex.quote(p.automation_dir)}
cd "$DIR" || exit 4
{fetching}
echo "HEAD=$(git symbolic-ref --short -q HEAD)"
git for-each-ref --sort=-committerdate \
    --format='REF=%(refname)%00%(committerdate:unix)%00%(authorname)%00%(subject)%00%(objectname:short)%00%(upstream:short)' \
    refs/heads refs/remotes
"""
    r = await ssh.run(p, script, timeout=60)
    if r.rc == 4:
        raise JobError(f"{p.automation_dir} doesn't exist on {p.host}")
    r.check("Listing branches")
    out: dict = {"current": None, "branches": []}
    refs = []
    for line in r.out.splitlines():
        k, _, v = line.partition("=")
        if k == "HEAD":
            out["current"] = v or None
        elif k == "FETCH_ERROR":
            out["fetch_error"] = v
        elif k == "REF":
            refs.append(v.split("\0"))
    tracked = {f[5] for f in refs if f[0].startswith("refs/heads/") and len(f) == 6 and f[5]}
    for ref, t, author, subject, sha, upstream in (f for f in refs if len(f) == 6):
        b = {"time": int(t or 0), "author": author, "subject": subject, "sha": sha}
        if ref.startswith("refs/heads/"):
            name = ref.removeprefix("refs/heads/")
            out["branches"].append({**b, "name": name, "local": True, "upstream": upstream or None,
                                    "remote": upstream.split("/", 1)[0] if upstream else None})
        else:
            remote, _, name = ref.removeprefix("refs/remotes/").partition("/")
            if name == "HEAD" or f"{remote}/{name}" in tracked:
                continue
            out["branches"].append({**b, "name": name, "local": False, "upstream": f"{remote}/{name}", "remote": remote})
    return out


async def switch_branch(p: Profile, name: str, remote: str | None = None) -> str:
    """Check out `name`: the local branch, or (with `remote`) a new one tracking remote/name.
    Returns the branch it's on."""
    if not _REF_RE.match(name) or (remote and not _REF_RE.match(remote)):
        raise JobError("Not a branch name")
    conflict = config.clone_conflict(p, await clone_owner(p))
    if conflict:
        raise JobError(config.describe_conflict(conflict))
    n, up = shlex.quote(name), shlex.quote(f"{remote}/{name}") if remote else ""
    # A local branch of that name tracking something else stays; the remote's gets <remote>-<name>.
    script = f"""
STATE={_state(p)}
{_BUSY}
cd {shlex.quote(p.automation_dir)} || exit 4
b={n}
if [ -n {shlex.quote(remote or "")} ]; then
    if git show-ref --verify --quiet "refs/heads/$b" && [ "$(git rev-parse --abbrev-ref "$b@{{upstream}}" 2>/dev/null)" != {up} ]; then
        b={shlex.quote(f"{remote}-{name}")}
    fi
    if git show-ref --verify --quiet "refs/heads/$b"; then git switch --quiet "$b"; else git switch --quiet -c "$b" --track {up}; fi
else
    git switch --quiet "$b"
fi || exit 6
echo "ON=$b"
"""
    r = await ssh.run(p, script, timeout=60)
    if r.rc == 3:
        raise JobError("A job is running in this clone")
    if r.rc == 6:
        msg = [l for l in r.err.strip().splitlines() if l.strip()]
        raise JobError(f"Couldn't switch to {name}: {msg[0] if msg else 'git switch failed'}"
                       + (" (commit or stash your changes first)" if any("overwritten" in l for l in msg) else ""))
    r.check("Switching branch")
    return next((l[3:] for l in r.out.splitlines() if l.startswith("ON=")), name)


async def launch(p: Profile, stages: list[str], *, fetch_kubeconfigs: bool = False) -> dict:
    stages = [s for s in STAGE_ORDER if s in stages]
    if not stages:
        raise JobError("Nothing to run")
    owner = await clone_owner(p)
    conflict = config.clone_conflict(p, owner)
    if conflict:
        raise JobError(config.describe_conflict(conflict))
    job_id = new_job_id(stages)
    pushes = "config" in stages or bool(set(stages) & set(CLEAN_STAGES))
    if pushes:
        config.pin_identity(p.name)
    user_env = config.render_user_env(p.name) if pushes else None
    if user_env is not None and not user_env.strip():
        raise JobError("The rendered user.env is empty; edit the config first")
    title = STAGES[stages[0]] if len(stages) == 1 else "Deploy: " + " → ".join(STAGES[s] for s in stages)
    meta = {
        "id": job_id,
        "title": title,
        "stages": stages,
        "created": int(time.time()),
        "fetch_kubeconfigs": fetch_kubeconfigs,
        "user_env_sha256": config.sha256(user_env) if user_env is not None else None,
    }
    fork = _your_fork() if {"clone", "pull", "pull-rebase"} & set(stages) else None
    script = build_script(p, job_id, stages, user_env, claim=not owner, fork=fork)
    enc = lambda s: base64.b64encode(s.encode()).decode()  # noqa: E731
    launcher = f"""
STATE={_state(p)}
ID={shlex.quote(job_id)}
mkdir -p "$STATE" && chmod 700 "$STATE" || exit 1
{'' if stages[0] == "clone" else f'[ -d {shlex.quote(p.automation_dir)} ] || {{ echo "NODIR"; exit 4; }}'}
{_BUSY}echo {enc(script)} | base64 -d > "$STATE/$ID.sh"
echo {enc(json.dumps(meta))} | base64 -d > "$STATE/$ID.json"
: > "$STATE/$ID.log"
setsid nohup bash "$STATE/$ID.sh" >/dev/null 2>&1 </dev/null &
echo $! > "$STATE/$ID.pid"
echo "STARTED $!"
"""
    res = await ssh.run(p, launcher, timeout=30)
    out = res.out.strip()
    if res.rc == 3:
        raise JobError(f"Another job is still running on this hypervisor ({out.split()[-1]})")
    if res.rc == 4:
        raise JobError(f"{p.automation_dir} does not exist on {p.host}")
    res.check("Starting the job")
    return {**meta, "status": "running", "pid": int(out.split()[-1])}


async def cancel(p: Profile, job_id: str) -> None:
    _check_id(job_id)
    script = f"""
STATE={_state(p)}; ID={shlex.quote(job_id)}
pid=$(cat "$STATE/$ID.pid" 2>/dev/null) || exit 0
kill -TERM -- "-$pid" 2>/dev/null
for i in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
kill -KILL -- "-$pid" 2>/dev/null
if [ ! -e "$STATE/$ID.rc" ]; then echo "::dpfgui::cancelled" >> "$STATE/$ID.log"; echo 130 > "$STATE/$ID.rc"; fi
"""
    (await ssh.run(p, script, timeout=40)).check("Cancelling the job")


async def job_status(p: Profile, job_id: str) -> dict:
    _check_id(job_id)
    script = f"""
STATE={_state(p)}; ID={shlex.quote(job_id)}
rc=$(cat "$STATE/$ID.rc" 2>/dev/null)
pid=$(cat "$STATE/$ID.pid" 2>/dev/null)
alive=0; [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && alive=1
echo "${{rc:-none}} $alive $(stat -c %s "$STATE/$ID.log" 2>/dev/null || echo 0)"
"""
    out = (await ssh.run(p, script, timeout=20)).check("Reading job status").out.split()
    rc = None if out[0] == "none" else int(out[0])
    if rc is not None:
        status = "succeeded" if rc == 0 else ("cancelled" if rc in (130, 143) else "failed")
    else:
        status = "running" if out[1] == "1" else "lost"
    return {"id": job_id, "status": status, "rc": rc, "log_size": int(out[2])}


async def stream_log(p: Profile, job_id: str, offset: int) -> AsyncIterator[bytes]:
    """Yield raw log bytes from `offset` until the job's process exits."""
    _check_id(job_id)
    script = f"""
STATE={_state(p)}; ID={shlex.quote(job_id)}; OFF={int(offset)}
LOG="$STATE/$ID.log"
[ -e "$LOG" ] || exit 2
pid=$(cat "$STATE/$ID.pid" 2>/dev/null)
if [ -e "$STATE/$ID.rc" ] || [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    exec tail -c +$((OFF + 1)) "$LOG"
fi
exec tail -c +$((OFF + 1)) -F -s 0.5 --pid="$pid" "$LOG" 2>/dev/null
"""
    proc = await ssh.spawn(p, script)
    assert proc.stdout
    try:
        while True:
            chunk = await proc.stdout.read(65536)
            if not chunk:
                break
            yield chunk
    finally:
        if proc.returncode is None:
            proc.kill()
        await proc.wait()


def _check_id(job_id: str) -> None:
    if not job_id or not all(c.isalnum() or c in "-_" for c in job_id):
        raise JobError("bad job id")
