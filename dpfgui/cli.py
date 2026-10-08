"""dpf-dev: the GUI's deployment loop on the command line.

Same profiles (~/.config/dpf-dev), same checks and the same jobs on the hypervisor as the
web app, so the two can be used side by side: a deploy started here shows up in the GUI and
the other way round.
"""

from __future__ import annotations

import argparse
import asyncio
import codecs
import getpass
import json
import logging
import os
import re
import sys
import time
from pathlib import Path

from . import config, identity, jobs, kubeconfigs, machines, ops, schema as schema_mod, settings, ssh, subnets
from .config import ConfigError, Profile


class Fail(Exception):
    """A problem to tell the user about (exit 1), no traceback."""


# ── Output ───────────────────────────────────────────────────────────────────

_COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")


def _style(code: str):
    return lambda s: f"\x1b[{code}m{s}\x1b[0m" if _COLOR else str(s)


bold, dim, red, yellow, green, cyan = (_style(c) for c in ("1", "2", "31", "33", "32", "36"))
LEVELS = {"error": (red, "✗"), "warn": (yellow, "!"), "todo": (cyan, "…"), "info": (dim, "i"), "ok": (green, "✓")}
ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


def issue_line(i: dict) -> str:
    color, mark = LEVELS.get(i["level"], (str, "·"))
    fix = f"  {dim('[--fix: ' + i['fix']['label'] + ']')}" if i.get("fix") else ""
    return f"{color(mark)} {i['message']}{fix}"


def print_json(obj) -> None:
    print(json.dumps(obj, indent=2))


def confirm(question: str, yes: bool) -> bool:
    if yes:
        return True
    if not sys.stdin.isatty():
        raise Fail(f"{question} Pass --yes to go ahead without asking.")
    return input(f"{question} [y/N] ").strip().lower() in ("y", "yes")


def gib(mib: float) -> str:
    return f"{mib / 1024:.0f} GiB"


def ago(ts: float | None) -> str:
    if not ts:
        return "never"
    s = int(time.time() - ts)
    for unit, n in (("d", 86400), ("h", 3600), ("m", 60)):
        if s >= n:
            return f"{s // n}{unit} ago"
    return f"{s}s ago"


def table(rows: list[list[str]], head: list[str] | None = None) -> None:
    rows = ([head] if head else []) + rows
    if not rows:
        return
    widths = [max(len(ANSI_RE.sub("", r[i])) for r in rows) for i in range(len(rows[0]))]
    for j, r in enumerate(rows):
        cells = [c + " " * (widths[i] - len(ANSI_RE.sub("", c))) for i, c in enumerate(r)]
        line = "  ".join(cells).rstrip()
        print(bold(line) if head and j == 0 else line)


# ── Profiles ─────────────────────────────────────────────────────────────────


def ptitle(p: Profile) -> str:
    return p.title or p.name


def short(host: str) -> str:
    return (host or "").split(".")[0]


def profile(args) -> Profile:
    """The profile to act on: -p NAME|TITLE, $DPF_DEV_PROFILE, or the only one there is."""
    want = getattr(args, "profile", None) or os.environ.get("DPF_DEV_PROFILE")
    ps = config.list_profiles()
    if not want:
        if len(ps) == 1:
            return ps[0]
        if not ps:
            raise Fail("No profiles yet. Create one: dpf-dev profile create --host <hypervisor>")
        raise Fail("Which profile? Pass -p NAME or set DPF_DEV_PROFILE. Profiles: " + ", ".join(p.name for p in ps))
    for p in ps:
        if p.name == want:
            return p
    by_title = [p for p in ps if (p.title or "").lower() == want.lower()]
    if len(by_title) == 1:
        return by_title[0]
    raise Fail(f"No profile called {want!r}. Profiles: " + (", ".join(p.name for p in ps) or "none"))


def ready(p: Profile) -> Profile:
    if not p.ready:
        raise Fail(f"{ptitle(p)} has no hypervisor or automation repo yet: dpf-dev -p {p.name} profile edit --host <hypervisor> [--dir <path>]")
    return p


def need_identity() -> list[str]:
    me = identity.me()
    if not me:
        raise Fail("Lab machines and HBN slots are allocated to GitHub logins; say which is yours first: dpf-dev whoami <login>")
    return me


async def settle_dir(host: str, user: str, d: str, clone: bool, name: str, title: str) -> tuple[str, bool]:
    """Check the hypervisor login and profile `name`'s automation repo clone. Returns (dir, needs a clone)."""
    print(dim(f"Checking {short(host)}…"), file=sys.stderr)
    hc = await ops.host_check(host, user, d, name)
    if not hc["login"]:
        raise Fail(f"You can't log in to {host} as {user}: {hc.get('error', '')}")
    if d:
        if hc.get("conflict"):
            raise Fail(config.describe_conflict(hc["conflict"]) + (" (dpf-dev profile take-over)" if hc["conflict"]["kind"] != "shared" else ""))
        if hc.get("dir") == "repo":
            print(f"{green('✓')} {d} is an openshift-dpf checkout" + (f" on {hc['branch']}" if hc.get("branch") else ""))
            return d, False
        if hc.get("dir") == "missing" and clone:
            return d, True
        if hc.get("dir") == "missing":
            raise Fail(f"{d} doesn't exist on {short(host)} (--clone to clone the automation repo there)")
        raise Fail(f"{d} exists on {short(host)}, but isn't an openshift-dpf checkout")
    target = ops.clone_target(hc.get("home"), config.slugify(title, name))
    if target:
        t = await ops.host_check(host, user, target, name)
        if t.get("dir") == "repo" and not t.get("conflict"):
            print(f"{green('✓')} Using your checkout {target}")
            return target, False
        if t.get("dir") == "missing" and clone:
            return target, True
    elif clone:
        need_identity()
    print(f"{yellow('!')} No automation repo picked yet." + (f" --clone to clone this profile's own to {target}," if target else "")
          + " or --dir to use one that's already there.")
    return "", False


async def clone_and_follow(p: Profile) -> None:
    job = await jobs.launch(p, ["clone"])
    print(f"Cloning into {p.automation_dir} on {short(p.host)}…")
    st = await follow(p, job["id"], LogView())
    if st["status"] != "succeeded":
        raise Fail(f"The clone {st['status']}")


def cmd_profile_list(a) -> None:
    ps = config.list_profiles()
    if a.json:
        return print_json([p.to_json() for p in ps])
    rows = []
    for p in ps:
        v = ops.values(p.name)
        cluster = f"{v.get('CLUSTER_NAME')}.{v['BASE_DOMAIN']}" if v.get("BASE_DOMAIN") else v.get("CLUSTER_NAME", "")
        dpus = [v.get(f"WORKER_{n}_NAME") or f"worker {n}" for n in range(1, ops.worker_count(v) + 1)]
        rows.append([p.name, p.title, short(p.host) or dim("no hypervisor"), cluster, ", ".join(dpus) or dim("none")])
    if not rows:
        return print("No profiles yet. Create one: dpf-dev profile create --host <hypervisor>")
    table(rows, ["NAME", "TITLE", "HYPERVISOR", "CLUSTER", "DPU HOSTS"])


def cmd_profile_show(a) -> None:
    p = profile(a)
    s = config.profile_settings(p.name)
    if a.json:
        return print_json({"profile": p.to_json(), "settings": s, "kubeconfigs": kubeconfigs.local_info(p.name)})
    print(f"{bold(ptitle(p))} ({p.name})")
    print(f"  Hypervisor   {p.host or dim('not picked')}" + (f" as {p.user}" if p.host else ""))
    print(f"  Repo         {p.automation_dir or dim('not picked')}")
    kc = kubeconfigs.local_info(p.name)
    have = [k for k in kubeconfigs.KINDS if kc[k]["exists"]]
    for j, k in enumerate(have):
        print(f"  {'Kubeconfigs' if j == 0 else '':<13}{kc[k]['path']} {dim('(' + ago(kc[k].get('fetched_at')) + ')')}")
    print_settings(s)


def print_settings(s: config.Settings) -> None:
    if not s:
        return print(dim("  No settings of its own: the automation repo's defaults apply."))
    print()
    for k, e in s.items():
        v = "••••••" if settings.SECRET_RE.search(k) and e["value"] else e["value"]
        line = f"  {k}={v}"
        if e.get("off"):
            line = dim(line + "  (switched off)")
        print(line + (f"  {dim('# ' + e['note'])}" if e.get("note") else ""))


async def cmd_profile_create(a) -> None:
    # NAME is what you call it; the profile's id comes from it ("DPF Demo" -> dpf-demo).
    title = a.title or a.name
    name = config.name_for(a.name)
    seed, host, user, d = {}, a.host or "", a.user, a.dir or ""
    if a.from_profile:
        src = profile(argparse.Namespace(profile=a.from_profile))
        seed = config.profile_settings(src.name)
        host, user = host or src.host, a.user if a.user != "root" else src.user  # but its own clone
        title = a.title or f"{ptitle(src)} (copy)"
    clone = False
    if host:
        host = ops.resolve_hypervisor(host)
        if not a.no_check:
            d, clone = await settle_dir(host, user, d, a.clone, name, title)
    p = config.save_profile(Profile(name=name, host=host, user=user, automation_dir=d, title=title), seed)
    print(f"{green('✓')} Created {bold(ptitle(p))} ({p.name})")
    if clone:
        await clone_and_follow(p)
    if not host:
        print(f"  Next: pick a hypervisor (dpf-dev hypervisors), then dpf-dev -p {p.name} profile edit --host <hypervisor>")


async def cmd_profile_edit(a) -> None:
    p = profile(a)
    host = ops.resolve_hypervisor(a.host) if a.host else p.host
    user = a.user or p.user
    # Another hypervisor: find the repo there again, unless you say where it is.
    d = a.dir if a.dir is not None else p.automation_dir if host == p.host else ""
    clone = False
    if a.clone and not host:
        raise Fail("Pick a hypervisor to clone to: --host")
    changed = (host, user, d) != (p.host, p.user, p.automation_dir)
    if host and (changed or a.clone) and not a.no_check:
        d, clone = await settle_dir(host, user, d, a.clone, p.name, a.title if a.title is not None else p.title)
    new = Profile(name=p.name, host=host, user=user, automation_dir=d,
                  label=p.label, title=a.title if a.title is not None else p.title, extra=p.extra)
    config.save_profile(new)
    print(f"{green('✓')} Saved {ptitle(new)}: {short(new.host) or 'no hypervisor'}" + (f" {new.automation_dir}" if new.automation_dir else ""))
    if clone:
        await clone_and_follow(new)


async def cmd_profile_take_over(a) -> None:
    p = ready(profile(a))
    c = config.clone_conflict(p, await jobs.clone_owner(p))
    if not c:
        return print(f"{p.automation_dir} is already {ptitle(p)}'s")
    if not confirm(f"{config.describe_conflict(c)} Make it {ptitle(p)}'s?", a.yes):
        return
    await jobs.take_over(p)
    print(f"{green('✓')} {p.automation_dir} is {ptitle(p)}'s now")


async def cmd_profile_delete(a) -> None:
    p = profile(argparse.Namespace(profile=a.name))
    if a.clone:
        ready(p)
        info = await jobs.clone_info(p)
        lost = [f"{info[k]} {what}" for k, what in (("dirty", "uncommitted changes"), ("unpushed", "commits on no remote"), ("stashes", "stashes")) if info[k]]
        lost += [f"the deployment's {', '.join(['.env'] * info['env'] + info['kubeconfigs'])} (clean up first if it's still deployed)"] if info["env"] or info["kubeconfigs"] else []
        question = (f"Delete the profile {ptitle(p)} ({p.name}) and its automation repo clone {p.automation_dir} on "
                    f"{short(p.host)}" + (f", losing {'; '.join(lost)}?" if lost else "?"))
    else:
        question = f"Delete the profile {ptitle(p)} ({p.name}) and its settings? Nothing on the hypervisor is touched (--clone to delete its clone too)."
    if not confirm(question, a.yes):
        return
    if a.clone:
        await jobs.delete_clone(p)
        print(f"Deleted {p.automation_dir} on {short(p.host)}")
    config.delete_profile(p.name)
    print(f"Deleted {p.name}")


# ── Who you are, hypervisors ─────────────────────────────────────────────────


def cmd_whoami(a) -> None:
    if a.login is not None:
        known = identity.known()
        if a.login and a.login not in known and not a.force:
            raise Fail(f"{a.login} isn't in the lab machine list or the HBN allocations (--force to use it anyway)")
        identity.set_me(a.login)
    if a.list:
        me = identity.me()
        for login in identity.known():
            print(("* " if login in me else "  ") + login)
        return
    me = identity.me()
    print(me[0] if me else "Not set. Pick your GitHub login: dpf-dev whoami <login> (see --list)")


async def cmd_hypervisors(a) -> None:
    lab = await asyncio.to_thread(machines.load, 0 if a.refresh else 120)
    hvs = ops.lab_hypervisors(lab)
    if not hvs:
        raise Fail("No hypervisors in the lab machine list" + (f": {lab['error']}" if lab.get("error") else ""))
    checks = await asyncio.gather(*(ops.host_check(m["address"], a.user, "") for m in hvs)) if not a.no_check else [{}] * len(hvs)
    me = identity.me()
    used = {}
    for p in config.list_profiles():
        used.setdefault(p.host, []).append(p.name)
    if a.json:
        return print_json([{**m, "login": c.get("login"), "profiles": used.get(m["address"], [])} for m, c in zip(hvs, checks)])
    rows = []
    for m, c in zip(hvs, checks):
        access = "" if a.no_check else green("you can log in") if c.get("login") else red("no access")
        users = ", ".join(("@" + u) + (" (you)" if u in me else "") for u in m["users"]) or dim("free")
        rows.append([m["id"], access, users, ", ".join(used.get(m["address"], [])), m.get("purpose") or ""])
    table(rows, ["HYPERVISOR", f"AS {a.user.upper()}", "USERS", "YOUR PROFILES", "PURPOSE"])


# ── Settings ─────────────────────────────────────────────────────────────────


def _save(p: Profile, s: config.Settings) -> None:
    config.save_profile_settings(p.name, config.normalize_settings(s))
    ops.remember_workers(p.name)


def _format_issues(key: str, value: str) -> list[dict]:
    sch = schema_mod.load(None)
    if key not in sch.params and not ops.WORKER_RE.match(key) and key not in sch.not_templated:
        return [{"level": "warn", "message": "Not a setting the automation repo knows (as far as the bundled schema goes)"}]
    return settings._check_format(key, value, sch.entry(key))


async def effective(p: Profile) -> dict:
    """The settings check, with the values a deploy would use (repo defaults included)."""
    a = await settings.analyze(ready(p), config.profile_settings(p.name))
    a["eff"] = {r["key"]: r["effective"] for r in a["rows"] if r["effective"] is not None}
    return a


async def cmd_get(a) -> None:
    p = profile(a)
    if not a.keys and not a.all:
        s = config.profile_settings(p.name)
        return print_json(s) if a.json else print_settings(s)
    vals = ops.values(p.name)
    if a.all or any(k not in vals for k in a.keys):
        vals = (await effective(p))["eff"] if p.ready else vals
    if a.all and not a.keys:
        if a.json:
            return print_json(vals)
        for k, v in vals.items():
            print(f"{k}={v}")
        return
    if a.json:
        return print_json({k: vals.get(k) for k in a.keys})
    for k in a.keys:
        print(vals.get(k, "") if len(a.keys) == 1 else f"{k}={vals.get(k, '')}")


def cmd_set(a) -> None:
    p = profile(a)
    s = config.profile_settings(p.name)
    new = {}
    if a.from_env:
        new.update(config.settings_from_shell(Path(a.from_env).expanduser().read_text()))
    for kv in a.assignments:
        k, eq, v = kv.partition("=")
        if not eq:
            raise Fail(f"{kv}: expected KEY=VALUE")
        new[k] = {**s.get(k, {}), "value": v}
        new[k].pop("off", None)
        if a.note is not None:
            new[k]["note"] = a.note
    if not new:
        raise Fail("Nothing to set: give KEY=VALUE pairs or --from-env FILE")
    s.update(config.normalize_settings(new))
    _save(p, s)
    for k, e in config.normalize_settings(new).items():
        print(f"{k}={'••••••' if settings.SECRET_RE.search(k) else e['value']}" + (dim("  (switched off)") if e.get("off") else ""))
        for i in _format_issues(k, e["value"]):
            print("  " + issue_line(i))


def cmd_unset(a) -> None:
    p = profile(a)
    s = config.profile_settings(p.name)
    missing = [k for k in a.keys if k not in s]
    ops.reset(s, *a.keys)
    _save(p, s)
    for k in a.keys:
        print(f"{k}: {'not set anyway' if k in missing else 'back to the default'}")


def cmd_toggle(a, off: bool) -> None:
    p = profile(a)
    s = config.profile_settings(p.name)
    for k in a.keys:
        if k not in s:
            raise Fail(f"{k} isn't set in {ptitle(p)}")
        if off:
            s[k]["off"] = True
        else:
            s[k].pop("off", None)
    _save(p, s)
    print(f"{'Switched off' if off else 'Switched on'}: {', '.join(a.keys)}")


def cmd_env(a) -> None:
    sys.stdout.write(config.render_user_env(profile(a).name))


def print_check(a: dict, show_ok: bool = False) -> None:
    for i in a["global_issues"]:
        print(issue_line(i))
    section = None
    for r in a["rows"]:
        issues = [i for i in r["issues"] if show_ok or i["level"] != "ok"]
        if not issues:
            continue
        if r["section"] != section:
            section = r["section"]
            print(f"\n{bold(section)}")
        v = r["effective"] if r["effective"] is not None else (r["set"] or {}).get("value", "")
        v = "••••••" if r["secret"] and v else v
        print(f"  {r['key']}" + (f" = {v}" if v else "") + (dim(f"  ({r['source']})") if r["source"] != "set" else ""))
        for i in issues:
            print("      " + issue_line(i))
    c = a["counts"]
    parts = [red(f"{c['error']} error(s)") if c["error"] else "", yellow(f"{c['warn']} warning(s)") if c["warn"] else "",
             cyan(f"{c['todo']} to fill in") if c["todo"] else ""]
    print("\n" + (", ".join(x for x in parts if x) or green("✓ No problems found")))


async def cmd_check(a) -> None:
    p = ready(profile(a))
    res = await effective(p)
    if a.fix:
        s = config.profile_settings(p.name)
        lab = machines.load()
        changes = [f"{k}={v}" for k, v in ops.autofill(p.name, s, res["eff"], res["facts"], lab).items()]
        fixes = {(r["key"], i["fix"]["op"]): i["fix"] for r in res["rows"] for i in r["issues"] if i.get("fix")}
        for fix in fixes.values():
            changes.append(ops.apply_fix(s, fix))
        if not changes:
            print("Nothing to fix automatically.")
        else:
            print("Changes:\n" + "\n".join(f"  {c}" for c in changes))
            if confirm("Save them?", a.yes):
                _save(p, s)
                res = await effective(p)
    if a.json:
        return print_json({k: res[k] for k in ("rows", "global_issues", "counts", "facts")})
    print_check(res, a.all)
    if res["counts"]["error"] or res["counts"]["todo"]:
        sys.exit(1)


# ── DPU hosts, HBN slot, cluster address ─────────────────────────────────────


def cmd_dpu_list(a) -> None:
    p = profile(a)
    lab = machines.load(0 if a.refresh else 120)
    if lab.get("error"):
        raise Fail(f"Couldn't load the lab machine list: {lab['error']}")
    vals = ops.values(p.name)
    sel = ops.selected_workers(vals, lab)
    by_id = {w["machine"]["id"]: w for w in sel if w["machine"]}
    me = identity.me()
    rank = lambda m: 0 if m["id"] in by_id else 4 if m["broken"] else 1 if any(u in me for u in m["users"]) else 2 if not m["users"] else 3  # noqa: E731
    dpus = sorted(machines.dpus(lab), key=rank)
    if a.json:
        return print_json({"selected": [{"n": w["n"], "name": w["name"], "machine": (w["machine"] or {}).get("id")} for w in sel],
                           "machines": dpus, "slots": len(ops.worker_slots())})
    rows = [[f"[{w['n']}]", w["name"] or f"worker {w['n']}", "", dim("not in the lab list"), ""] for w in sel if not w["machine"]]
    for m in dpus:
        w = by_id.get(m["id"])
        state = red("broken") if m["broken"] else (m.get("cluster") or "")
        users = ", ".join("@" + u + (" (you)" if u in me else "") for u in m["users"]) or green("free")
        feats = ", ".join(f for f in m.get("features") or [] if f != "x86")
        rows.append([bold(f"[{w['n']}]") if w else "", bold(m["id"]) if w else m["id"], state, users, feats])
    table(rows, ["", "DPU HOST", "STATE", "USERS", "FEATURES"])
    print(dim(f"\n{len(sel)} of {len(ops.worker_slots())} slots used · from {lab.get('source')}"))


async def _after_dpu_change(p: Profile, probe: list[int]) -> None:
    """What the GUI does once DPU hosts change: fill in their subnet (and the bridge), find each
    new host's boot NIC from its BMC, then show what's still wrong with them."""
    res = await effective(p)
    lab = machines.load()
    s = config.profile_settings(p.name)
    filled = ops.autofill(p.name, s, res["eff"], res["facts"], lab)
    vals = {**res["eff"], **config.active_values(s)}
    for n in probe:
        k = lambda f: vals.get(f"WORKER_{n}_{f}")  # noqa: E731
        if not (k("BMC_IP") and k("BMC_USER") and k("BMC_PASSWORD")):
            continue
        m = machines.find_worker(lab, k("NAME"), k("BMC_IP"))
        print(dim(f"Asking {k('NAME')}'s BMC for its NICs…"), file=sys.stderr)
        try:
            d = await ops.bmc_probe(p, k("BMC_IP"), k("BMC_USER"), k("BMC_PASSWORD"), (m or {}).get("address", ""))
        except (ssh.SSHError, ops.OpsError) as e:
            print(f"  {yellow('!')} {e}")
            continue
        if d.get("auth") is False:
            print(f"  {red('✗')} The BMC refused {k('BMC_USER')}'s password")
        elif d.get("error"):
            print(f"  {yellow('!')} Couldn't ask the BMC: {d['error']}")
        elif not k("BOOT_MAC") and d.get("recommended"):
            filled[f"WORKER_{n}_BOOT_MAC"] = d["recommended"]
            ops.set_values(s, {f"WORKER_{n}_BOOT_MAC": d["recommended"]})
    if filled:
        _save(p, s)
        for k, v in filled.items():
            print(f"  {green('✓')} {k}={v}")
        res = await effective(p)
    keys = re.compile(r"^(WORKER_|VTEP_CIDR$|DPU_HOST_CIDR$)")
    left = [(r["key"], i) for r in res["rows"] if keys.match(r["key"]) for i in r["issues"] if i["level"] not in ("ok", "info")]
    for k, i in left:
        print(f"  {k}: {issue_line(i)}")
    if any(k == "VTEP_CIDR" for k, _ in left):
        print(dim("  Pick an HBN slot for them: dpf-dev slot auto"))


async def cmd_dpu_add(a) -> None:
    p = profile(a)
    lab = machines.load()
    s = config.profile_settings(p.name)
    added = []
    for m in a.machines:
        n = ops.add_dpu(p.name, s, lab, m, force=a.force)
        k = lambda f: f"WORKER_{n}_{f}"  # noqa: E731
        given = {k("BMC_USER"): a.bmc_user, k("BOOT_MAC"): a.boot_mac, k("ROOT_DEVICE"): a.root_device,
                 k("BMC_PASSWORD"): a.bmc_password}
        ops.set_values(s, {key: v for key, v in given.items() if v})
        if not config.active_values(s).get(k("BMC_PASSWORD")) and sys.stdin.isatty():
            pw = getpass.getpass(f"BMC password for {m} as {config.active_values(s)[k('BMC_USER')]} (empty to set it later): ")
            if pw:
                ops.set_values(s, {k("BMC_PASSWORD"): pw})
        _save(p, s)
        added.append(n)
        print(f"{green('✓')} {m} is worker {n}")
    if p.ready and not a.no_check:
        await _after_dpu_change(p, added)


async def cmd_dpu_remove(a) -> None:
    p = profile(a)
    lab = machines.load()
    s = config.profile_settings(p.name)
    # Highest first, so the numbers given still mean the same hosts.
    for which in sorted(a.hosts, key=lambda w: -int(w) if w.isdigit() else 0):
        n, name = ops.remove_dpu(p.name, s, lab, which)
        _save(p, s)
        print(f"{green('✓')} Removed {name or 'worker ' + str(n)}" + ("; workers after it moved up" if n <= ops.worker_count(ops.values(p.name, s)) else ""))
    if p.ready and not a.no_check:
        await _after_dpu_change(p, [])


def cmd_slot(a) -> None:
    p = profile(a)
    me = need_identity()
    data = subnets.load(0 if a.refresh else 30)
    if data.get("error"):
        raise Fail(f"Couldn't load the HBN allocations: {data['error']}")
    options = ops.slot_options(data, me)
    vals = ops.values(p.name)
    hosts = ops.worker_count(vals)
    cur = config.active_values(config.profile_settings(p.name)).get("VTEP_CIDR")
    if a.cidr is None:
        if a.json:
            return print_json({"current": cur, "options": options})
        if not options:
            print(f"You (@{me[0]}) have no HBN slot yet." + (f" Ask for one: {data['request_url']}" if data.get("request_url") else ""))
        rows = [[green("✓") if o["cidr"] == cur else "", o["cidr"], f"{o['room']} DPU host(s)", o["what"]] for o in options]
        table(rows, ["", "VTEP_CIDR", "ROOM", ""])
        print()
        if not cur:
            print("No slot picked." + (" Your DPU hosts need one." if hosts else " You don't need one without DPU hosts."))
        else:
            for i in subnets.check_vtep(cur, data, hosts, me) or [{"level": "info", "message": f"{cur}"}]:
                print(f"{cur}: {issue_line(i)}")
        return
    s = config.profile_settings(p.name)
    if a.cidr == "none":
        ops.reset(s, "VTEP_CIDR")
        _save(p, s)
        return print("No HBN slot (VTEP_CIDR back to the repo default)")
    if a.cidr == "auto":
        o = ops.pick_slot(options, hosts)
        if not o:
            raise Fail(f"None of your slots has room for {hosts} DPU hosts" if options else "You have no HBN slot yet"
                       + (f". Ask for one: {data['request_url']}" if data.get("request_url") else ""))
        cidr = o["cidr"]
    else:
        cidr = a.cidr
        problems = [i for i in subnets.check_vtep(cidr, data, hosts, me) if i["level"] in ("error", "warn")]
        if problems and not a.force:
            raise Fail(f"{cidr}: " + "; ".join(i["message"] for i in problems) + " (--force to use it anyway)")
    ops.set_values(s, {"VTEP_CIDR": cidr})
    _save(p, s)
    print(f"{green('✓')} VTEP_CIDR={cidr}")


def cmd_domain(a) -> None:
    p = profile(a)
    lab = machines.load(0 if a.refresh else 120)
    doms = ops.lab_domains(lab)
    me = identity.me()
    vals = ops.values(p.name)
    if a.name is None:
        if a.json:
            return print_json(doms)
        rows = [[green("✓") if (d["cluster"], d["base"]) == (vals.get("CLUSTER_NAME"), vals.get("BASE_DOMAIN")) else "",
                 d["id"], f"api.{d['cluster']}.{d['base']}", d.get("api_ip") or "", d.get("apps_ip") or "",
                 ", ".join("@" + u + (" (you)" if u in me else "") for u in d["users"]) or green("free"), d.get("purpose") or ""]
                for d in doms]
        table(rows, ["", "DOMAIN", "API", "API VIP", "APPS VIP", "USERS", "PURPOSE"])
        return
    dm = next((d for d in doms if a.name in (d["id"], d["cluster"], f"{d['cluster']}.{d['base']}")), None)
    if not dm:
        raise Fail(f"No lab domain called {a.name}. See: dpf-dev domain")
    if dm["users"] and not any(u in me for u in dm["users"]) and not a.force:
        raise Fail(f"{dm['id']} is used by {', '.join('@' + u for u in dm['users'])} (--force to use it anyway)")
    s = config.profile_settings(p.name)
    new = ops.domain_values(dm)
    ops.set_values(s, new)
    _save(p, s)
    print(f"{green('✓')} Using {dm['id']}: " + ", ".join(f"{k}={v}" for k, v in new.items()))


async def cmd_vips(a) -> None:
    p = ready(profile(a))
    vals = ops.values(p.name)
    if (vals.get("VM_COUNT") or "3") == "1":
        raise Fail("A single-node cluster has no VIPs: it answers on its VM's own address")
    bridge = vals.get("BRIDGE_NAME") or (schema_mod.load(None).params.get("BRIDGE_NAME") or {}).get("default") or "br0"
    print(dim(f"Looking for free addresses on {bridge} from {short(p.host)}…"), file=sys.stderr)
    d = await ops.free_ips(p, str(bridge))
    if d.get("error"):
        raise Fail(d["error"])
    free = [ip for ip in d.get("free") or [] if ip not in (vals.get("API_VIP"), vals.get("INGRESS_VIP"))]
    if a.json:
        return print_json(d)
    if not free:
        raise Fail("Nothing free found; ask in the lab channel")
    print("\n".join(free))
    print(dim("These don't answer ping and aren't in the hypervisor's neighbour table, and no lab domain or profile of "
              "yours uses them. A good sign, not a guarantee: check they're not in a DHCP range."), file=sys.stderr)
    if a.use:
        if len(free) < 2:
            raise Fail("Need two free addresses")
        s = config.profile_settings(p.name)
        ops.set_values(s, {"API_VIP": free[0], "INGRESS_VIP": free[1]})
        _save(p, s)
        print(f"{green('✓')} API_VIP={free[0]} INGRESS_VIP={free[1]}")


# ── Status and jobs ──────────────────────────────────────────────────────────


async def cmd_status(a) -> None:
    p = ready(profile(a))
    r = await ops.remote_status(p, a.fetch)
    summary = config.config_summary(p.name)
    if a.json:
        return print_json({"remote": r, "summary": summary, "kubeconfigs": kubeconfigs.local_info(p.name)})
    h = r.get("host") or {}
    print(f"{bold(ptitle(p))} on {r.get('host', {}).get('hostname') or p.host} as {p.user}, {p.automation_dir}")
    print(f"  Memory       {gib(h.get('mem_available_kib', 0) / 1024)} of {gib(h.get('mem_total_kib', 0) / 1024)} available"
          + (f", this profile needs {gib(summary['required_mem_mib'])}" if summary["required_mem_mib"] else ""))
    repo = r.get("repo") or {}
    if not repo.get("exists"):
        print(f"  Repo         {red('missing')}")
    elif repo.get("git"):
        bits = [repo.get("branch", "?") + (f" → {repo['upstream']}" if repo.get("upstream") else "")]
        if repo.get("behind"):
            bits.append(yellow(f"{repo['behind']} behind"))
        if repo.get("ahead"):
            bits.append(f"{repo['ahead']} ahead")
        if repo.get("dirty"):
            bits.append(yellow(f"{repo['dirty']} modified"))
        print(f"  Repo         {', '.join(bits)}" + (f"  {dim(repo['head']['sha'] + ' ' + repo['head']['subject'])}" if repo.get("head") else ""))
    mine = ops.my_vms(r, summary["values"])
    print(f"  Your VMs     " + (", ".join(f"{v['name']} ({v.get('state')})" for v in mine) or dim("none")))
    if r.get("workers"):
        print(f"  DPU hosts    " + ", ".join(w["name"] or f"worker {w['n']}" for w in r["workers"]) + dim("  (from the hypervisor's .env)"))
    for m in r.get("external_makes") or []:
        print(f"  {yellow('!')} make is running there (pid {m['pid']}): {m['cmd']}")
    kc = kubeconfigs.local_info(p.name)
    have = [k for k in kubeconfigs.KINDS if kc[k]["exists"]]
    where = str(config.KUBECONFIG_DIR / p.name).replace(str(Path.home()), "~")
    print(f"  Kubeconfigs  " + (f"{', '.join(have)} in {where}" if have else dim("none fetched")))
    js = r.get("jobs") or []
    if js:
        print()
        print_jobs(js[:5])


def print_jobs(js: list[dict]) -> None:
    color = {"succeeded": green, "failed": red, "running": cyan, "cancelled": yellow, "lost": yellow}
    rows = []
    for j in js:
        dur = f"{(j['ended'] - j['created']) // 60}m" if j.get("ended") and j.get("created") else ""
        st = color.get(j["status"], str)(j["status"]) + (f" (exit {j['rc']})" if j["status"] == "failed" else "")
        rows.append([j["id"], st, time.strftime("%a %H:%M", time.localtime(j.get("created", 0))), dur, j.get("title", "")])
    table(rows, ["JOB", "STATUS", "STARTED", "TOOK", ""])


async def cmd_jobs(a) -> None:
    p = ready(profile(a))
    js = (await ops.remote_status(p)).get("jobs") or []
    if a.json:
        return print_json(js)
    if not js:
        return print("No jobs yet")
    print_jobs(js)


class LogView:
    """Prints a job log the way the GUI's log viewer shows it: stage markers, `make all`'s
    steps, and without make's --debug trace."""

    TRACE = [re.compile(x) for x in (
        r"^GNU Make \d", r"^Built for ", r"^Copyright \(C\) \d", r"^License GPLv3\+", r"^This is free software",
        r"^There is NO WARRANTY", r"^Reading makefiles\.\.\.$", r"^Updating makefiles\.\.\.\.$", r"^Updating goal targets\.\.\.\.$",
        r"^\s*File '.*' does not exist\.$", r"^\s*Must remake target '.*'\.$", r"^\s*Successfully remade target file '.*'\.$",
        r"^\s*Prerequisite '.*' is (newer|older) than target '.*'\.$", r"^\s*No need to remake target '.*'\.$",
        r"^\s*Target '.*' not remade because of errors\.$", r"^\s*Finished prerequisites of target file '.*'\.$",
        r"^\s*Considering target file '.*'\.$", r"^\s*Pruning file '.*'\.$")]
    FAIL_RE = re.compile(r"make(?:\[\d+\])?: \*\*\* \[[^\]]*?:\d+: ([^\]]+)\] Error")

    def __init__(self, trace: bool = False):
        self.trace = trace
        self.steps: list[str] = []
        self.failed: str | None = None
        self.started: dict[str, int] = {}
        self.results: dict[str, int] = {}  # stage -> exit code
        self.partial = ""
        self.decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")

    def feed(self, chunk: bytes) -> None:
        parts = (self.partial + self.decoder.decode(chunk)).split("\n")
        self.partial = parts.pop()
        for raw in parts:
            self.line(raw)
        sys.stdout.flush()

    def flush(self) -> None:
        if self.partial:
            self.line(self.partial)
            self.partial = ""

    def line(self, raw: str) -> None:
        if "\r" in raw:  # progress output: what's visible last
            segs = [x for x in raw.split("\r") if ANSI_RE.sub("", x).strip()]
            raw = segs[-1] if segs else ""
        plain = ANSI_RE.sub("", raw)
        m = re.match(r"^::dpfgui::(\S+)\s*(.*)$", plain)
        if m:
            return self.marker(m.group(1), m.group(2).split())
        mk = re.match(r"^\s*Must remake target '(.+)'\.$", plain)
        if mk and mk.group(1) in self.steps:
            n = self.steps.index(mk.group(1)) + 1
            return print(bold(cyan(f"▸ make {mk.group(1)}")) + dim(f"  (step {n} of {len(self.steps)})"))
        if any(r.match(plain) for r in self.TRACE):
            if self.trace:
                print(dim(plain))
            return
        f = self.FAIL_RE.search(plain)
        if f and f.group(1) in self.steps:
            self.failed = f.group(1)
        print(raw if _COLOR else plain)

    def marker(self, kind: str, a: list[str]) -> None:
        title = lambda s: jobs.STAGES.get(s, s)  # noqa: E731
        if kind == "stage-start":
            self.started[a[0]] = int(a[1])
            print(bold(f"▶ {title(a[0])}"))
        elif kind == "stage-end":
            rc, took = int(a[1]), int(a[2]) - self.started.get(a[0], int(a[2]))
            self.results[a[0]] = rc
            dur = f" in {took // 60}m{took % 60:02d}s" if a[0] in self.started else ""
            print(green(f"✓ {title(a[0])} finished{dur}") if rc == 0 else red(f"✗ {title(a[0])} failed (exit {rc}){dur}"))
        elif kind == "steps":
            self.steps = [x for x in a if x]
        elif kind == "cancelled":
            print(yellow("■ Cancelled"))


_watching = False  # following a job's log, which keeps running when we stop


async def follow(p: Profile, job_id: str, view: LogView, offset: int = 0, keep_following: bool = True) -> dict:
    """Print a job's log until it ends (reconnecting when ssh drops). Returns its status."""
    global _watching
    _watching = True
    failures = 0
    while True:
        try:
            async for chunk in jobs.stream_log(p, job_id, offset):
                offset += len(chunk)
                view.feed(chunk)
            st = await jobs.job_status(p, job_id)
            failures = 0
        except ssh.SSHError as e:
            failures += 1
            if failures > 20:
                raise
            print(yellow(f"Lost the connection ({e}); reconnecting…"), file=sys.stderr)
            await asyncio.sleep(3)
            continue
        if st["status"] != "running" or not keep_following:
            view.flush()
            return st
        await asyncio.sleep(2)  # tail stopped early; pick up where it left off


async def _job_id(p: Profile, given: str | None, running_only: bool = False) -> dict:
    js = (await ops.remote_status(p)).get("jobs") or []
    if given:
        j = next((j for j in js if j["id"] == given or j["id"].startswith(given)), None)
        if not j:
            raise Fail(f"No job {given} on {short(p.host)}")
        return j
    j = next((j for j in js if j["status"] == "running"), None) or (None if running_only else (js or [None])[0])
    if not j:
        raise Fail("No job is running" if running_only else "No jobs yet")
    return j


async def cmd_logs(a) -> None:
    p = ready(profile(a))
    j = await _job_id(p, a.job)
    view = LogView(a.trace)
    st = await follow(p, j["id"], view, keep_following=a.follow)
    finish_line(j, st, view)


def finish_line(j: dict, st: dict, view: LogView) -> None:
    if st["status"] == "running":
        return
    msg = {"succeeded": green(f"✓ {j.get('title', j['id'])} succeeded"),
           "failed": red("✗ Failed" + (f" in make {view.failed}" if view.failed else "") + f" (exit {st['rc']})"),
           "cancelled": yellow("■ Cancelled"), "lost": yellow("Stopped unexpectedly (no exit code recorded)")}
    print(msg.get(st["status"], st["status"]))


async def cmd_cancel(a) -> None:
    p = ready(profile(a))
    j = await _job_id(p, a.job, running_only=not a.job)
    if j["status"] != "running":
        raise Fail(f"{j['id']} isn't running ({j['status']})")
    if not confirm(f"Stop {j['title']} ({j['id']}) and everything it started on {short(p.host)}? "
                   "A half-finished make all usually needs a make clean-all afterwards.", a.yes):
        return
    await jobs.cancel(p, j["id"])
    print("Stopped")


# ── Deploying ────────────────────────────────────────────────────────────────


def clean_effects(stage: str, remote: dict, mine: list[dict], cluster: str) -> list[str]:
    """What a clean stage will do, from the .env on the hypervisor (which is what it uses)."""
    parts = {"clean": "wvc", "clean-workers": "w", "clean-vms": "v", "clean-cluster": "c"}[stage]
    me = [u.lower() for u in identity.me()]
    lab = machines.load()
    out = []
    if "w" in parts:
        ws = remote.get("workers") or []
        for w in ws:
            m = machines.find_worker(lab, w["name"], w["bmc_ip"])
            others = [u for u in (m or {}).get("users", []) if u.lower() not in me]
            out.append(f"power off {w['name'] or 'worker ' + str(w['n'])} (BMC {w['bmc_ip'] or '?'}) over IPMI"
                       + (yellow(f"  allocated to {', '.join('@' + u for u in others)}") if others else ""))
    if "v" in parts:
        out += [f"destroy VM {v['name']} ({v.get('state')}) and its disks" for v in mine] or ["destroy no VMs (none with your prefix)"]
    if "c" in parts:
        out += [f"delete the Assisted Installer cluster {cluster}", "delete the generated files and kubeconfigs in the automation dir"]
    return out


async def run_stages(a, p: Profile, stages: list[str], *, fetch_kube: bool, fetch_now: bool = False) -> None:
    """Check, confirm, start and follow a job; the shared end of `deploy` and `run`."""
    print(dim(f"Checking {short(p.host)}…"), file=sys.stderr)
    remote = await ops.remote_status(p, fetch="pull" in stages)
    summary = config.config_summary(p.name)
    if (running := next((j for j in remote.get("jobs") or [] if j["status"] == "running"), None)):
        raise Fail(f"A job is already running there: {running['title']} ({running['id']}). Follow it with dpf-dev logs -f")
    if remote.get("external_makes"):
        m = remote["external_makes"][0]
        raise Fail(f"make is already running on {short(p.host)} (pid {m['pid']}): {m['cmd']}")
    if "install" in stages and not a.force:
        res = await effective(p)
        c = res["counts"]
        if c["error"] or c["todo"]:
            print_check(res)
            raise Fail("Fix the settings first (dpf-dev check), or --force to deploy anyway")
    mine = ops.my_vms(remote, summary["values"])
    cluster = (remote.get("env") or {}).get("CLUSTER_NAME") or summary["values"].get("CLUSTER_NAME") or ptitle(p)

    print(f"\n{bold(ptitle(p))} on {short(p.host)}:")
    destructive = False
    step = 0
    for s in stages:
        step += 1
        extra = ""
        if s == "pull":
            r = remote.get("repo") or {}
            extra = f" ({r['behind']} new commits on {r['upstream']})" if r.get("behind") else " (already up to date)" if r.get("upstream") else ""
        print(f"  {step}. {jobs.STAGES[s]}{extra}")
        if s.startswith("clean"):
            destructive = True
            for e in clean_effects(s, remote, mine, cluster):
                print(f"       - {e}")
    if fetch_kube or fetch_now:
        print(f"  {step + 1}. Fetch kubeconfigs")
    if "install" in stages:
        h = remote.get("host") or {}
        running = sum(v.get("rss_kib") or v.get("mem_kib") or 0 for v in mine if v.get("state") == "running")
        avail = (h.get("mem_available_kib", 0) + running) / 1024
        need = summary["required_mem_mib"]
        if need and need > avail:
            print(f"\n{yellow('!')} Needs {gib(need)}, but only about {gib(avail)} would be free on {short(p.host)}")
            destructive = True  # worth asking
    print()
    if destructive and not confirm("Go ahead?", a.yes):
        return
    job = await jobs.launch(p, stages, fetch_kubeconfigs=fetch_kube)
    print(f"Started {job['id']}. It keeps running on {short(p.host)} if you stop watching (Ctrl-C).")
    if fetch_now:
        await fetch_kubeconfigs(p, list(kubeconfigs.KINDS))
    if a.detach:
        print(f"Follow it: dpf-dev -p {p.name} logs -f")
        return
    view = LogView(a.trace)
    st = await follow(p, job["id"], view)
    finish_line(job, st, view)
    if fetch_kube and "install" in view.results:
        print(dim("Fetching kubeconfigs…"), file=sys.stderr)
        await print_fetch(p, await kubeconfigs.fetch_after_deploy(p, job["id"]))
    if st["status"] != "succeeded":
        sys.exit(1)


async def print_fetch(p: Profile, results: dict) -> None:
    info = kubeconfigs.local_info(p.name)
    for k, r in results.items():
        print(f"  {green('✓')} {info[k]['path']}" if r["ok"] else f"  {red('✗')} {kubeconfigs.KINDS[k]}: {r['error']}")


async def fetch_kubeconfigs(p: Profile, kinds: list[str]) -> None:
    await print_fetch(p, await kubeconfigs.fetch(p, kinds))


async def cmd_deploy(a) -> None:
    p = ready(profile(a))
    stages = []
    if a.pull:
        stages.append("pull")
    if a.clean is None:
        remote = await ops.remote_status(p)
        a.clean = bool(ops.my_vms(remote, config.config_summary(p.name)["values"]))
    if a.clean:
        stages.append("clean")
    if a.install:
        stages += ["config", "install"]
    if not stages:
        if not a.kubeconfigs:
            raise Fail("Nothing to do")
        return await fetch_kubeconfigs(p, list(kubeconfigs.KINDS))
    await run_stages(a, p, stages, fetch_kube=a.kubeconfigs and a.install, fetch_now=a.kubeconfigs and not a.install)


async def cmd_run(a) -> None:
    p = ready(profile(a))
    await run_stages(a, p, [s for s in jobs.STAGE_ORDER if s in a.stages], fetch_kube=False)


async def cmd_kubeconfigs(a) -> None:
    p = profile(a)
    if a.fetch:
        return await fetch_kubeconfigs(ready(p), a.kinds or list(kubeconfigs.KINDS))
    info = kubeconfigs.local_info(p.name)
    if a.json:
        return print_json(info)
    for k in kubeconfigs.KINDS:
        e = info[k]
        state = f"{e['server']}  {dim(ago(e.get('fetched_at')))}" if e["exists"] else dim("not fetched")
        print(f"{k:<15}{e['path']}  {state}" + (f"  {red(e['error']['message'])}" if e.get("error") else ""))


class _NotCancelled(logging.Filter):
    """Requests cancelled because the server is stopping aren't errors worth a traceback."""

    def filter(self, record: logging.LogRecord) -> bool:
        return not (record.exc_info and isinstance(record.exc_info[1], asyncio.CancelledError))


def cmd_gui(a) -> None:
    import webbrowser

    import uvicorn

    url = f"http://{a.host}:{a.port}/"
    print(f"DPF Dev GUI on {url}")
    if a.open:
        webbrowser.open(url)
    logging.getLogger("uvicorn.error").addFilter(_NotCancelled())
    try:
        # The page keeps requests open (job logs, cluster watches); on Ctrl+C give them a moment, then
        # cancel them instead of waiting for them to end.
        uvicorn.run("dpfgui.app:app", host=a.host, port=a.port, reload=a.reload, log_level="warning",
                    timeout_graceful_shutdown=2)
    except KeyboardInterrupt:  # a second Ctrl+C while stopping
        pass


# ── Arguments ────────────────────────────────────────────────────────────────


EPILOG = """\
The profile is picked with -p NAME (or its title), $DPF_DEV_PROFILE, or is the only one.
Profiles are shared with the web GUI (dpf-dev gui).

A typical first deploy:
  dpf-dev whoami <your-github-login>
  dpf-dev hypervisors
  dpf-dev profile create mine --host <hypervisor>
  dpf-dev -p mine domain                # or: set CLUSTER_NAME=... BASE_DOMAIN=...; vips --use
  dpf-dev -p mine dpu list
  dpf-dev -p mine dpu add <dpu-host>
  dpf-dev -p mine slot auto
  dpf-dev -p mine check
  dpf-dev -p mine deploy
"""


def parser() -> argparse.ArgumentParser:
    top = argparse.ArgumentParser(prog="dpf-dev", description="Deploy DPF dev clusters on lab hypervisors.",
                                  epilog=EPILOG, formatter_class=argparse.RawDescriptionHelpFormatter)
    top.add_argument("-p", "--profile", help="the profile to act on")
    # -p also works after the command
    pp = argparse.ArgumentParser(add_help=False)
    pp.add_argument("-p", "--profile", default=argparse.SUPPRESS, help="the profile to act on")
    js = argparse.ArgumentParser(add_help=False)
    js.add_argument("--json", action="store_true", help="machine-readable output")
    yes = argparse.ArgumentParser(add_help=False)
    yes.add_argument("-y", "--yes", action="store_true", help="don't ask for confirmation")
    sub = top.add_subparsers(dest="cmd", metavar="COMMAND", required=True)

    def cmd(name, fn, help, parents=(), **kw):
        sp = sub.add_parser(name, help=help, description=help, parents=[pp, *parents], **kw)
        sp.set_defaults(fn=fn)
        return sp

    # profiles
    prof = sub.add_parser("profile", help="create, show, edit and delete profiles", description="Profiles: one deployment each.")
    psub = prof.add_subparsers(dest="pcmd", metavar="ACTION", required=True)

    def pcmd(name, fn, help, parents=(), **kw):
        sp = psub.add_parser(name, help=help, description=help, parents=[pp, *parents], **kw)
        sp.set_defaults(fn=fn)
        return sp

    pcmd("list", cmd_profile_list, "list profiles", [js], aliases=["ls"])
    pcmd("show", cmd_profile_show, "a profile's hypervisor, repo and settings", [js])
    sp = pcmd("create", cmd_profile_create, "create a profile")
    sp.add_argument("name", help="what to call it (its id is made from this: \"DPF Demo\" -> dpf-demo)")
    sp.add_argument("--title", help="a different name to show than NAME")
    sp.add_argument("--host", help="the hypervisor (its name in the lab list, or any host)")
    sp.add_argument("--user", default="root", help="the SSH user there (default: root)")
    sp.add_argument("--dir", help="the profile's own openshift-dpf clone there (default: ~/user-envs/<you>/<profile>/openshift-dpf if it exists)")
    sp.add_argument("--clone", action="store_true", help="clone the automation repo there if it isn't")
    sp.add_argument("--from", dest="from_profile", metavar="PROFILE", help="copy another profile's hypervisor and settings (not its clone)")
    sp.add_argument("--no-check", action="store_true", help="don't log in to the hypervisor to check")
    sp = pcmd("edit", cmd_profile_edit, "change a profile's title, hypervisor or repo")
    sp.add_argument("--title")
    sp.add_argument("--host")
    sp.add_argument("--user")
    sp.add_argument("--dir")
    sp.add_argument("--clone", action="store_true", help="clone the automation repo there if it isn't")
    sp.add_argument("--no-check", action="store_true", help="don't log in to the hypervisor to check")
    pcmd("take-over", cmd_profile_take_over, "make the profile's automation repo clone its own, whichever profile or laptop it belonged to", [yes])
    sp = pcmd("delete", cmd_profile_delete, "delete a profile (and with --clone, its automation repo clone on the hypervisor)", [yes], aliases=["rm"])
    sp.add_argument("name")
    sp.add_argument("--clone", action="store_true", help="also delete the profile's automation repo clone")

    sp = cmd("whoami", cmd_whoami, "show or set your GitHub login (lab machines and HBN slots are allocated to it)")
    sp.add_argument("login", nargs="?", help="your login; '' to clear it")
    sp.add_argument("--list", action="store_true", help="every login the lab files know")
    sp.add_argument("--force", action="store_true", help="set a login the lab files don't know")
    sp = cmd("hypervisors", cmd_hypervisors, "the lab's hypervisors, who uses them and whether you can log in", [js])
    sp.add_argument("--user", default="root", help="SSH user to check access as (default: root)")
    sp.add_argument("--no-check", action="store_true", help="don't try to log in")
    sp.add_argument("--refresh", action="store_true", help="pull the lab machine list")

    # settings
    sp = cmd("get", cmd_get, "a profile's settings; with KEYs their values (repo defaults included)", [js])
    sp.add_argument("keys", nargs="*", metavar="KEY")
    sp.add_argument("--all", action="store_true", help="every setting's value, as a deploy would use it")
    sp = cmd("set", cmd_set, "set settings")
    sp.add_argument("assignments", nargs="*", metavar="KEY=VALUE")
    sp.add_argument("--note", help="a note to keep with them")
    sp.add_argument("--from-env", metavar="FILE", help="import an `export KEY=value` file (comments become notes)")
    sp = cmd("unset", cmd_unset, "drop settings (back to the repo's default)")
    sp.add_argument("keys", nargs="+", metavar="KEY")
    sp = cmd("disable", lambda a: cmd_toggle(a, True), "switch settings off without forgetting them")
    sp.add_argument("keys", nargs="+", metavar="KEY")
    sp = cmd("enable", lambda a: cmd_toggle(a, False), "switch settings back on")
    sp.add_argument("keys", nargs="+", metavar="KEY")
    cmd("env", cmd_env, "print the user.env a deploy pushes")
    sp = cmd("check", cmd_check, "validate the settings against the repo, the lab files and the hypervisor", [js, yes])
    sp.add_argument("--fix", action="store_true", help="apply the suggested fixes and fill in what follows from the hypervisor")
    sp.add_argument("--all", action="store_true", help="also show what checked out fine")

    dpu = sub.add_parser("dpu", help="pick the DPU hosts (physical workers) from the lab list", description="DPU hosts")
    dsub = dpu.add_subparsers(dest="dcmd", metavar="ACTION", required=True)
    sp = dsub.add_parser("list", aliases=["ls"], parents=[pp, js], help="lab DPU hosts, who has them and which are yours")
    sp.add_argument("--refresh", action="store_true", help="pull the lab machine list")
    sp.set_defaults(fn=cmd_dpu_list)
    sp = dsub.add_parser("add", parents=[pp], help="add DPU hosts as the next workers")
    sp.add_argument("machines", nargs="+", metavar="HOST")
    sp.add_argument("--bmc-user")
    sp.add_argument("--bmc-password")
    sp.add_argument("--boot-mac", help="default: the NIC the BMC says carries the host's address")
    sp.add_argument("--root-device")
    sp.add_argument("--force", action="store_true", help="use a host allocated to someone else")
    sp.add_argument("--no-check", action="store_true", help="don't ask the hypervisor and the BMC")
    sp.set_defaults(fn=cmd_dpu_add)
    sp = dsub.add_parser("remove", aliases=["rm"], parents=[pp], help="remove DPU hosts (later workers move up)")
    sp.add_argument("hosts", nargs="+", metavar="HOST|N")
    sp.add_argument("--no-check", action="store_true", help="don't ask the hypervisor")
    sp.set_defaults(fn=cmd_dpu_remove)

    sp = cmd("slot", cmd_slot, "your HBN slots, or pick one for VTEP_CIDR (CIDR, auto or none)", [js])
    sp.add_argument("cidr", nargs="?", metavar="CIDR|auto|none")
    sp.add_argument("--force", action="store_true", help="use a range that isn't yours")
    sp.add_argument("--refresh", action="store_true", help="pull the allocations")
    sp = cmd("domain", cmd_domain, "the lab's DNS domains, or use one (CLUSTER_NAME, BASE_DOMAIN and the VIPs)", [js])
    sp.add_argument("name", nargs="?")
    sp.add_argument("--force", action="store_true", help="use a domain someone else uses")
    sp.add_argument("--refresh", action="store_true", help="pull the lab machine list")
    sp = cmd("vips", cmd_vips, "find free addresses for API_VIP and INGRESS_VIP", [js])
    sp.add_argument("--use", action="store_true", help="set API_VIP and INGRESS_VIP to the first two")

    # running things
    sp = cmd("status", cmd_status, "the hypervisor, your VMs, the repo and recent jobs", [js])
    sp.add_argument("--fetch", action="store_true", help="git fetch first, to tell how far behind the repo is")
    run_opts = argparse.ArgumentParser(add_help=False)
    run_opts.add_argument("--detach", action="store_true", help="start it and return, don't follow the log")
    run_opts.add_argument("--trace", action="store_true", help="show make's --debug trace in the log")
    run_opts.add_argument("--force", action="store_true", help="deploy even with errors in the settings")
    sp = cmd("deploy", cmd_deploy, "pull → clean up → push settings → make all → fetch kubeconfigs", [yes, run_opts])
    sp.add_argument("--no-pull", dest="pull", action="store_false", help="don't git pull the automation repo")
    sp.add_argument("--clean", action=argparse.BooleanOptionalAction, default=None,
                    help="make clean-all first (default: when you have VMs there)")
    sp.add_argument("--no-install", dest="install", action="store_false", help="don't push the settings and run make all")
    sp.add_argument("--no-kubeconfigs", dest="kubeconfigs", action="store_false", help="don't fetch the kubeconfigs")
    sp = cmd("run", cmd_run, "run single stages: " + ", ".join(jobs.STAGES), [yes, run_opts])
    sp.add_argument("stages", nargs="+", choices=list(jobs.STAGES), metavar="STAGE")
    cmd("jobs", cmd_jobs, "recent jobs on the hypervisor", [js])
    sp = cmd("logs", cmd_logs, "a job's log (default: the running or latest one)")
    sp.add_argument("job", nargs="?")
    sp.add_argument("-f", "--follow", action="store_true", help="keep following while it runs")
    sp.add_argument("--trace", action="store_true", help="show make's --debug trace")
    sp = cmd("cancel", cmd_cancel, "stop a running job", [yes])
    sp.add_argument("job", nargs="?")
    sp = cmd("kubeconfigs", cmd_kubeconfigs, "the local kubeconfigs, or --fetch them", [js])
    sp.add_argument("--fetch", action="store_true")
    sp.add_argument("kinds", nargs="*", metavar="KIND", help=", ".join(kubeconfigs.KINDS))

    sp = sub.add_parser("gui", help="start the web GUI", description="Start the web GUI (http://127.0.0.1:8765 by default).")
    sp.add_argument("--host", default="127.0.0.1")
    sp.add_argument("--port", type=int, default=8765)
    sp.add_argument("--open", action="store_true", help="open the browser")
    sp.add_argument("--reload", action="store_true", help="auto-reload on code changes (development)")
    sp.set_defaults(fn=cmd_gui)
    return top


def main(argv: list[str] | None = None) -> None:
    args = parser().parse_args(argv)
    try:
        r = args.fn(args)
        if asyncio.iscoroutine(r):
            asyncio.run(r)
    except KeyboardInterrupt:
        if _watching:
            print("\nStopped watching; the job keeps running on the hypervisor. "
                  "dpf-dev logs -f follows it again, dpf-dev cancel stops it.", file=sys.stderr)
        sys.exit(130)
    except (Fail, ConfigError, ops.OpsError, jobs.JobError, ssh.SSHError, kubeconfigs.KubeconfigError) as e:
        sys.stdout.flush()
        print(f"{red('error:')} {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
