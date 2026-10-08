"""Small GitHub REST API client (no `gh` needed).

Requests are anonymous unless GITHUB_TOKEN is set, which private repos need.
User profiles are cached on disk, so the anonymous rate limit (60/hour) is
only spent on logins we haven't seen in a week.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import config

USER_TTL = 7 * 86400
_failed: dict[str, float] = {}  # login -> when a lookup last failed (retried after an hour)


class GitHubError(RuntimeError):
    pass


def _get(path: str, timeout: float = 10) -> dict:
    req = urllib.request.Request(f"https://api.github.com/{path}", headers={
        "Accept": "application/vnd.github+json", "User-Agent": "dpf-dev-gui",
        **({"Authorization": f"Bearer {t}"} if (t := os.environ.get("GITHUB_TOKEN")) else {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            msg = json.load(e).get("message") or e.reason
        except ValueError:
            msg = e.reason
        raise GitHubError(f"GitHub API {path}: {e.code} {msg}")
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise GitHubError(f"GitHub API {path}: {getattr(e, 'reason', e)}")


def contents(owner: str, repo: str, path: str) -> str:
    """A file from a repo's default branch."""
    return base64.b64decode(_get(f"repos/{owner}/{repo}/contents/{path}")["content"]).decode()


# ── The dpf-allocations repo (lab machines, HBN subnets) ─────────────────────

ALLOCATIONS = "rh-ecosystem-edge/dpf-allocations"


def source_spec(source: str, default_file: str) -> tuple[str, str, str] | None:
    """(owner, repo, path) for a `github:owner/repo[/path]` source, None for a local file."""
    if not source.startswith("github:"):
        return None
    parts = source[len("github:"):].strip("/").split("/", 2)
    if len(parts) < 2:
        raise GitHubError("GitHub sources look like github:owner/repo or github:owner/repo/path/to/file.yaml")
    return parts[0], parts[1], parts[2] if len(parts) == 3 else default_file


PULL_EVERY = 60  # seconds between pulls of a clone
_pulled: dict[str, float] = {}
_locks: dict[str, threading.Lock] = {}


def _git(*args: str, cwd: Path | None = None) -> None:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=60,
                       env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
    if r.returncode:
        lines = (r.stderr or r.stdout).strip().splitlines()
        raise GitHubError(f"git {args[0]}: {lines[-1] if lines else 'failed'}")


def clone(owner: str, repo: str, fresh: bool = False) -> Path:
    """The app's own clone of a repo (under the state dir), cloned on first use and pulled
    at most every PULL_EVERY seconds (`fresh` pulls now). When a pull fails (offline, say), the last one stays."""
    path = config.state_dir() / "repos" / owner / repo
    lock = _locks.setdefault(f"{owner}/{repo}", threading.Lock())
    with lock:
        if not (path / ".git").exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            _git("clone", "--quiet", f"https://github.com/{owner}/{repo}.git", str(path))
            _pulled[str(path)] = time.time()
        elif fresh or time.time() - _pulled.get(str(path), 0) > PULL_EVERY:
            _pulled[str(path)] = time.time()
            try:
                _git("pull", "--quiet", "--ff-only", cwd=path)
            except (GitHubError, subprocess.TimeoutExpired):
                pass
    return path


def read_source(source: str, default_file: str, fresh: bool = False) -> str:
    """An allocations file: `github:owner/repo[/path]` (read from the app's clone) or a local path."""
    if spec := source_spec(source, default_file):
        try:
            path = clone(spec[0], spec[1], fresh) / spec[2]
        except subprocess.TimeoutExpired:
            raise GitHubError(f"Cloning {spec[0]}/{spec[1]} timed out")
    else:
        path = Path(source).expanduser()
    try:
        return path.read_text()
    except OSError as e:
        raise GitHubError(f"Can't read {path}: {e.strerror}")


# ── User profiles (cached) ───────────────────────────────────────────────────


def _cache_path():
    return config.state_dir() / "github-users.json"


def _read_cache() -> dict:
    try:
        return json.loads(_cache_path().read_text())
    except (OSError, ValueError):
        return {}


def _fetch_user(login: str) -> dict | None:
    if time.time() - _failed.get(login, 0) < 3600:
        return None
    try:
        d = _get(f"users/{login}", timeout=5)
    except GitHubError:
        _failed[login] = time.time()
        return None
    return {"name": d.get("name"), "avatar": d.get("avatar_url"), "at": time.time()}


def users(logins: list[str]) -> dict[str, dict]:
    """{login: {name, avatar}} for each login; name and avatar are None when unknown."""
    cache = _read_cache()
    stale = [l for l in dict.fromkeys(logins) if time.time() - cache.get(l, {}).get("at", 0) > USER_TTL]
    if stale:
        with ThreadPoolExecutor(8) as ex:
            fetched = {l: u for l, u in zip(stale, ex.map(_fetch_user, stale)) if u}
        if fetched:
            cache.update(fetched)
            _cache_path().write_text(json.dumps(cache, indent=2) + "\n")
    return {l: {"name": cache.get(l, {}).get("name"), "avatar": cache.get(l, {}).get("avatar")} for l in logins}
