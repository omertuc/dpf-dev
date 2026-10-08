"""Thin async wrapper around the system `ssh` binary.

We deliberately shell out to OpenSSH so the user's keys, agent and
~/.ssh/config (proxies, etc.) just work. A dedicated ControlMaster keeps
repeated calls fast. RemoteCommand/RequestTTY are overridden because the
user's interactive aliases attach to tmux.
"""

from __future__ import annotations

import asyncio
import os
import shlex
from dataclasses import dataclass
from pathlib import Path

from .config import Profile

CONTROL_DIR = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "dpf-dev-gui" / "ssh"


class SSHError(RuntimeError):
    pass


def _wrap_bash(script: str) -> str:
    # bash reads a script from stdin incrementally, so a child process that reads
    # stdin could swallow the rest of it. Wrapping everything in a function makes
    # bash parse the whole thing first; the body then runs with stdin on /dev/null.
    return f"__dpfgui_main() {{\n{script}\n}}\n__dpfgui_main </dev/null\n"


@dataclass
class Result:
    rc: int
    out: str
    err: str

    def check(self, what: str) -> "Result":
        if self.rc != 0:
            msg = (self.err or self.out).strip().splitlines()
            raise SSHError(f"{what} failed (exit {self.rc}): {msg[-1] if msg else 'no output'}")
        return self


def ssh_argv(profile: Profile, *remote: str) -> list[str]:
    CONTROL_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    return [
        "ssh",
        "-o", "RemoteCommand=none",
        "-o", "RequestTTY=no",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
        "-o", "ServerAliveInterval=15",
        "-o", "ServerAliveCountMax=4",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ControlMaster=auto",
        "-o", f"ControlPath={CONTROL_DIR}/%C",
        "-o", "ControlPersist=10m",
        profile.target,
        "--",
        *remote,
    ]


async def run(profile: Profile, script: str, *, interp: tuple[str, ...] = ("bash", "-s"),
              args: tuple[str, ...] = (), timeout: float = 60) -> Result:
    """Run `script` on the hypervisor by piping it to `interp` over ssh."""
    remote = " ".join(shlex.quote(a) for a in (*interp, *args))
    if interp[0] == "bash":
        script = _wrap_bash(script)
    proc = await asyncio.create_subprocess_exec(
        *ssh_argv(profile, remote),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(script.encode()), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise SSHError(f"Timed out after {timeout:.0f}s talking to {profile.host}")
    if b"disabling multiplexing" in err:
        await _reset_master(profile)
    if proc.returncode == 255:
        lines = err.decode(errors="replace").strip().splitlines()
        raise SSHError(lines[-1] if lines else f"ssh to {profile.host} failed")
    return Result(proc.returncode, out.decode(errors="replace"), err.decode(errors="replace"))


async def _reset_master(profile: Profile) -> None:
    """The shared connection is there but refuses sessions (e.g. after the laptop slept), so
    every ssh logs in from scratch (seconds each) until it goes away: make it go."""
    proc = await asyncio.create_subprocess_exec(
        *ssh_argv(profile)[:-2], "-O", "exit", profile.target,
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    await proc.wait()


async def spawn(profile: Profile, script: str) -> asyncio.subprocess.Process:
    """Start a long-running remote bash script; caller reads stdout and must kill it."""
    proc = await asyncio.create_subprocess_exec(
        *ssh_argv(profile, "bash -s"),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    assert proc.stdin
    proc.stdin.write(_wrap_bash(script).encode())
    await proc.stdin.drain()
    proc.stdin.close()
    return proc
