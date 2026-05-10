"""Auto-sync helpers used by the bot to keep the journal in lockstep with git.

The bot can run on a VPS (or any always-on machine) while the user reads/writes
on a laptop. Everything routes through the private GitHub remote: pull-rebase
before write, commit, push.
"""
from __future__ import annotations

import logging
import subprocess
import time
from pathlib import Path

log = logging.getLogger(__name__)


class GitSyncError(RuntimeError):
    pass


def _run(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    proc = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise GitSyncError(f"git {args} failed: {proc.stderr.strip()}")
    return proc


def is_git_repo(path: Path) -> bool:
    try:
        proc = _run(["git", "rev-parse", "--git-dir"], cwd=path, check=False)
        return proc.returncode == 0
    except FileNotFoundError:
        return False


def current_branch(path: Path) -> str:
    return _run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=path).stdout.strip()


def pull_rebase(path: Path, remote: str = "origin", branch: str | None = None) -> None:
    branch = branch or current_branch(path)
    _run(["git", "fetch", remote, branch], cwd=path)
    _run(["git", "pull", "--rebase", "--autostash", remote, branch], cwd=path)


def commit_and_push(
    repo: Path,
    paths_to_add: list[Path],
    message: str,
    *,
    remote: str = "origin",
    branch: str | None = None,
    push_retries: int = 3,
) -> bool:
    """Add paths, commit, push. Returns True if a commit was made."""
    if not is_git_repo(repo):
        log.info("not a git repo; skipping sync")
        return False
    branch = branch or current_branch(repo)

    for p in paths_to_add:
        rel = p.relative_to(repo) if p.is_absolute() else p
        _run(["git", "add", "--", str(rel)], cwd=repo)

    status = _run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=repo).stdout
    if not status.strip():
        log.info("nothing to commit")
        return False

    _run(["git", "commit", "-m", message], cwd=repo)

    delay = 2
    last_err: GitSyncError | None = None
    for attempt in range(push_retries):
        try:
            try:
                pull_rebase(repo, remote=remote, branch=branch)
            except GitSyncError as exc:
                log.warning("pull --rebase before push failed (attempt %d): %s", attempt + 1, exc)
            _run(["git", "push", remote, branch], cwd=repo)
            return True
        except GitSyncError as exc:
            last_err = exc
            log.warning("push attempt %d failed: %s", attempt + 1, exc)
            time.sleep(delay)
            delay *= 2
    raise last_err or GitSyncError("push failed after retries")
