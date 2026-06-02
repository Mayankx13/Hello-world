"""
Typed, env-backed config — the only place env vars are read.

Why pydantic-settings rather than os.environ.get():
  - Type safety: AZURE_OPENAI_API_VERSION is a str, MAX_TOKENS_PER_QUERY
    is an int. Wrong types fail at startup, not at the first request.
  - One import everywhere: `from src.config import settings`.
    Beats sprinkling os.environ.get() across the codebase, which is the
    #1 cause of "works locally, fails in prod" issues.
  - Validation lives next to the field. If MAX_QUERIES_PER_DAY drifts to
    0, the app refuses to start with a clear error.

Why a singleton (`settings = Settings()`):
  - Pydantic Settings reads .env once on instantiation. Re-instantiating
    on every request would re-read the env, which is both slow and
    confusing if the env changes mid-process.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # Why case_sensitive=False: .env files are conventionally
        # SCREAMING_SNAKE; field names below are snake_case.
        case_sensitive=False,
        # Why extra="ignore": we don't want a typo in .env to crash the
        # app at startup — but we do want to log unknown keys.
        # (Logging the unknowns is in the lifespan handler, not here.)
        extra="ignore",
    )

    # ── LLM ──────────────────────────────────────────────────────────
    use_azure_openai: bool = True

    azure_openai_endpoint: str = ""
    azure_openai_api_key: SecretStr = SecretStr("")
    azure_openai_api_version: str = "2024-08-01-preview"
    azure_openai_chat_deployment: str = "gpt-4o"
    azure_openai_mini_deployment: str = "gpt-4o-mini"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    openai_api_key: SecretStr = SecretStr("")

    # ── Warehouse ────────────────────────────────────────────────────
    # PostgresDsn validates the connection string is well-formed.
    # SQLAlchemy/psycopg get it as-is.
    database_url: PostgresDsn = Field(
        default="postgresql://retail:retail@localhost:5432/olist"
    )
    database_readonly_url: PostgresDsn = Field(
        default="postgresql://retail_readonly:retail_readonly@localhost:5432/olist"
    )

    # ── Vector ───────────────────────────────────────────────────────
    vector_backend: str = "chroma"  # "chroma" | "azure_ai_search"
    chroma_persist_dir: Path = Path("./.chroma")

    azure_search_endpoint: str = ""
    azure_search_api_key: SecretStr = SecretStr("")
    azure_search_index_name: str = "retail-policies"

    # ── Blob (prod-only) ─────────────────────────────────────────────
    azure_blob_connection_string: SecretStr = SecretStr("")
    azure_blob_container: str = "policies"

    # ── Cost guards ──────────────────────────────────────────────────
    # gt=0 means "must be strictly positive". Pydantic enforces this
    # at startup — a typo of `MAX_TOKENS_PER_QUERY=0` will not silently
    # disable the guard.
    max_tokens_per_query: int = Field(default=8000, gt=0)
    max_queries_per_day: int = Field(default=500, gt=0)
    daily_budget_usd: float = Field(default=5.0, gt=0)

    # ── Observability ────────────────────────────────────────────────
    log_level: str = "INFO"
    log_db_path: Path = Path("./.logs/calls.sqlite")

    # ── Tenancy ──────────────────────────────────────────────────────
    default_tenant_id: str = "demo-tenant"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached settings accessor. Why lru_cache and not a module-level
    `settings = Settings()`:
      - Tests can monkeypatch the env, then call get_settings.cache_clear()
        to force a re-read. With a module-level singleton, the only way
        to override is to mutate the singleton, which leaks state across
        tests.
    """
    return Settings()


settings = get_settings()
