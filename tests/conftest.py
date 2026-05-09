"""Shared pytest fixtures for Life OS."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))


@pytest.fixture()
def life_os_home(tmp_path: Path) -> Path:
    """A clean Life OS home directory copied from the repo for each test."""
    target = tmp_path / "life-os"
    target.mkdir()
    # Copy the canonical structure: roadmap, journal/prompts, data/schema.sql, ROADMAP.md.
    shutil.copytree(REPO_ROOT / "roadmap", target / "roadmap")
    shutil.copytree(REPO_ROOT / "journal" / "prompts", target / "journal" / "prompts")
    (target / "journal" / "entries").mkdir(parents=True)
    (target / "journal" / "logs").mkdir(parents=True)
    for d in ["body", "perfectghar", "career", "finance", "social", "growth"]:
        (target / "journal" / "logs" / d).mkdir(parents=True)
    (target / "journal" / "private").mkdir(parents=True)
    (target / "data").mkdir(parents=True)
    shutil.copy2(REPO_ROOT / "data" / "schema.sql", target / "data" / "schema.sql")
    shutil.copy2(REPO_ROOT / "ROADMAP.md", target / "ROADMAP.md")
    return target


@pytest.fixture()
def paths(life_os_home, monkeypatch):
    monkeypatch.setenv("LIFE_OS_HOME", str(life_os_home))
    from life_os import config

    return config.load_paths()
