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
KEYRING_TG_USER = "telegram-bot-token"

# Telegram bot defaults — overrideable via env.
DEFAULT_EVENING_NUDGE_HHMM = "20:00"
DEFAULT_WEEKLY_NUDGE_HHMM = "20:30"
DEFAULT_WEEKLY_NUDGE_DOW = 6  # Sunday in python-telegram-bot job_queue convention


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


def get_telegram_token() -> str | None:
    """Return the Telegram bot token. Env var first; keyring fallback."""
    env = os.environ.get("LIFE_OS_TELEGRAM_TOKEN")
    if env:
        return env
    try:
        import keyring

        return keyring.get_password(KEYRING_SERVICE, KEYRING_TG_USER)
    except Exception:
        return None


def set_telegram_token(value: str) -> None:
    import keyring

    keyring.set_password(KEYRING_SERVICE, KEYRING_TG_USER, value)


def get_telegram_chat_id() -> int | None:
    """Authorized chat_id for the bot. Env first; config file fallback."""
    env = os.environ.get("LIFE_OS_TELEGRAM_CHAT_ID")
    if env:
        try:
            return int(env)
        except ValueError:
            return None
    cfg = _bot_config_path()
    if cfg.exists():
        try:
            for line in cfg.read_text(encoding="utf-8").splitlines():
                if line.startswith("chat_id="):
                    return int(line.split("=", 1)[1].strip())
        except (OSError, ValueError):
            pass
    return None


def set_telegram_chat_id(chat_id: int) -> None:
    cfg = _bot_config_path()
    cfg.parent.mkdir(parents=True, exist_ok=True)
    cfg.write_text(f"chat_id={chat_id}\n", encoding="utf-8")


def get_evening_nudge_time() -> str:
    return os.environ.get("LIFE_OS_EVENING_NUDGE", DEFAULT_EVENING_NUDGE_HHMM)


def get_weekly_nudge_time() -> str:
    return os.environ.get("LIFE_OS_WEEKLY_NUDGE", DEFAULT_WEEKLY_NUDGE_HHMM)


def _bot_config_path() -> Path:
    override = os.environ.get("LIFE_OS_BOT_CONFIG")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".life-os" / "bot.conf"
