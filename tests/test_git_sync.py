from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from life_os.bots import git_sync


def _git(args: list[str], cwd: Path) -> None:
    subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        env={
            "HOME": str(cwd),
            "GIT_AUTHOR_NAME": "Test",
            "GIT_AUTHOR_EMAIL": "test@example.com",
            "GIT_COMMITTER_NAME": "Test",
            "GIT_COMMITTER_EMAIL": "test@example.com",
            "PATH": "/usr/bin:/bin",
        },
    )


def _make_repo_with_remote(tmp_path: Path) -> Path:
    bare = tmp_path / "remote.git"
    work = tmp_path / "work"
    work.mkdir()
    subprocess.run(["git", "init", "--bare", "-b", "main", str(bare)], check=True, capture_output=True)
    _git(["init", "-b", "main"], cwd=work)
    _git(["config", "user.name", "Test"], cwd=work)
    _git(["config", "user.email", "test@example.com"], cwd=work)
    _git(["config", "commit.gpgsign", "false"], cwd=work)
    _git(["config", "tag.gpgsign", "false"], cwd=work)
    (work / "README").write_text("seed\n")
    _git(["add", "README"], cwd=work)
    _git(["commit", "-m", "seed"], cwd=work)
    _git(["remote", "add", "origin", str(bare)], cwd=work)
    _git(["push", "-u", "origin", "main"], cwd=work)
    return work


def test_is_git_repo_true_for_repo(tmp_path: Path):
    work = _make_repo_with_remote(tmp_path)
    assert git_sync.is_git_repo(work)


def test_is_git_repo_false_for_plain_dir(tmp_path: Path):
    assert not git_sync.is_git_repo(tmp_path)


def test_commit_and_push_writes_to_remote(tmp_path: Path):
    work = _make_repo_with_remote(tmp_path)
    new_file = work / "entry.md"
    new_file.write_text("hello\n")
    pushed = git_sync.commit_and_push(work, [new_file], "test: add entry")
    assert pushed is True

    # Clone the bare repo to a third dir; the file should be there.
    clone = tmp_path / "clone"
    subprocess.run(
        ["git", "clone", str(tmp_path / "remote.git"), str(clone)],
        check=True,
        capture_output=True,
    )
    assert (clone / "entry.md").exists()


def test_commit_and_push_no_changes_returns_false(tmp_path: Path):
    work = _make_repo_with_remote(tmp_path)
    existing = work / "README"
    pushed = git_sync.commit_and_push(work, [existing], "noop")
    assert pushed is False
