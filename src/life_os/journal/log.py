"""`journal log <domain>` — domain-specific structured logs."""
from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.prompt import Prompt

from .. import config
from ..storage import markdown as md
from ..storage import sqlite as sqlite_mod
from .evening import _ask_prompt, _editor_or_inline, _render_scaffold


def _next_seq(target_dir: Path, when: date) -> int:
    if not target_dir.exists():
        return 1
    prefix = f"{when.isoformat()}-"
    existing = [p for p in target_dir.iterdir() if p.name.startswith(prefix)]
    return len(existing) + 1


def run(
    paths: config.Paths,
    domain: str,
    *,
    log_type: str | None = None,
    use_editor: bool = True,
    text_override: str | None = None,
    prefilled_metadata: dict[str, Any] | None = None,
    when: date | None = None,
    console: Console | None = None,
) -> Path:
    if domain not in config.DOMAINS:
        raise ValueError(f"unknown domain: {domain!r}; expected one of {config.DOMAINS}")
    console = console or Console()
    when = when or date.today()
    template_path = paths.prompts_dir / f"log-{domain}.md"
    template = md.read(template_path)
    log_types = template.metadata.get("log_types", {}) or {}
    if not log_types:
        raise RuntimeError(f"{template_path} has no log_types defined")

    if log_type is None:
        choice = Prompt.ask(
            "log type",
            choices=list(log_types.keys()),
            default=next(iter(log_types)),
            console=console,
        )
    else:
        choice = log_type
    if choice not in log_types:
        raise ValueError(f"unknown log_type {choice!r}; expected one of {list(log_types)}")

    spec = log_types[choice] or {}
    structured: dict[str, Any] = {}
    for prompt_spec in spec.get("prompts", []) or []:
        value = _ask_prompt(prompt_spec, console, prefilled=prefilled_metadata)
        if value is not None:
            structured[prompt_spec["key"]] = value

    scaffold = _render_scaffold(spec.get("sections", []) or [])
    body = text_override if text_override is not None else _editor_or_inline(scaffold, use_editor=use_editor, console=console)

    target_dir = paths.logs_dir / domain
    seq = _next_seq(target_dir, when)
    out_path = target_dir / f"{when.isoformat()}-{choice}-{seq:02d}.md"

    metadata: dict[str, Any] = {
        "date": when.isoformat(),
        "type": "log",
        "log_type": choice,
        "domain": domain,
        "captured_at": datetime.now().isoformat(timespec="seconds"),
        **structured,
    }
    if prefilled_metadata:
        for k, v in prefilled_metadata.items():
            metadata.setdefault(k, v)

    md.write(out_path, metadata, body)
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    sqlite_mod.upsert_log(conn, md.read(out_path), domain, paths.home)
    conn.close()
    console.print(f"[green]wrote[/green] {out_path.relative_to(paths.home)}")
    return out_path
