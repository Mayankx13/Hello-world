"""Paths, environment, and keychain access for Life OS."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

DOMAINS = ("body", "perfectghar", "career", "finance", "social", "growth")
DEFAULT_MODEL = "claude-opus-4-7"
FAST_MODEL = "claude-haiku-4-5"
KEYRING_SERVICE = "life-os"
KEYRING_USER = "anthropic"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Paths:
    home: Path
    roadmap_dir: Path = field(init=False)
    roadmap_master: Path = field(init=False)
    journal_dir: Path = field(init=False)
    entries_dir: Path = field(init=False)
    logs_dir: Path = field(init=False)
    private_dir: Path = field(init=False)
    prompts_dir: Path = field(init=False)
    data_dir: Path = field(init=False)
    sqlite_path: Path = field(init=False)
    private_sqlite_path: Path = field(init=False)
    schema_sql: Path = field(init=False)
    age_key_path: Path = field(init=False)

    def __post_init__(self) -> None:
        h = self.home
        object.__setattr__(self, "roadmap_dir", h / "roadmap")
        object.__setattr__(self, "roadmap_master", h / "ROADMAP.md")
        object.__setattr__(self, "journal_dir", h / "journal")
        object.__setattr__(self, "entries_dir", h / "journal" / "entries")
        object.__setattr__(self, "logs_dir", h / "journal" / "logs")
        object.__setattr__(self, "private_dir", h / "journal" / "private")
        object.__setattr__(self, "prompts_dir", h / "journal" / "prompts")
        object.__setattr__(self, "data_dir", h / "data")
        object.__setattr__(self, "sqlite_path", h / "data" / "index.sqlite")
        object.__setattr__(self, "private_sqlite_path", h / "data" / "private.sqlite")
        object.__setattr__(self, "schema_sql", h / "data" / "schema.sql")
        default_key = Path.home() / ".life-os" / "age.key"
        override = os.environ.get("LIFE_OS_AGE_KEY")
        object.__setattr__(self, "age_key_path", Path(override) if override else default_key)


def load_paths(home: Path | None = None) -> Paths:
    if home is not None:
        return Paths(home=home)
    env_home = os.environ.get("LIFE_OS_HOME")
    if env_home:
        return Paths(home=Path(env_home).expanduser().resolve())
    return Paths(home=_repo_root())


def get_model(fast: bool = False) -> str:
    if fast:
        return FAST_MODEL
    return os.environ.get("LIFE_OS_MODEL", DEFAULT_MODEL)


def get_api_key() -> str | None:
    """Return the Anthropic API key from env or OS keychain."""
    env_key = os.environ.get("ANTHROPIC_API_KEY")
    if env_key:
        return env_key
    try:
        import keyring  # local import: avoid hard dep at module import time

        return keyring.get_password(KEYRING_SERVICE, KEYRING_USER)
    except Exception:
        return None


def set_api_key(value: str) -> None:
    import keyring

    keyring.set_password(KEYRING_SERVICE, KEYRING_USER, value)


def get_age_bin() -> str:
    return os.environ.get("LIFE_OS_AGE_BIN", "age")
