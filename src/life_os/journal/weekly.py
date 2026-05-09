"""`journal weekly` — Sunday review tied to roadmap."""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.table import Table

from .. import config
from ..storage import markdown as md
from ..storage import sqlite as sqlite_mod
from .evening import _ask_prompt, _editor_or_inline, _render_scaffold, output_path_for


def _print_pulse(conn, console: Console) -> None:
    table = Table(title="Roadmap pulse — active phases", show_header=True)
    table.add_column("Domain")
    table.add_column("Phase")
    table.add_column("Due")
    table.add_column("Status")
    rows = sqlite_mod.fetch_active_phases(conn)
    for row in rows:
        table.add_row(row["domain"], row["title"], row["due_date"] or "—", row["status"])
    if rows:
        console.print(table)
    overdue = sqlite_mod.fetch_overdue_items(conn)
    if overdue:
        console.print("\n[red]Overdue:[/red]")
        for row in overdue:
            console.print(f"  • {row['domain']}: {row['title']} (due {row['due_date']})")


def run(
    paths: config.Paths,
    *,
    use_editor: bool = True,
    text_override: str | None = None,
    prefilled_metadata: dict[str, Any] | None = None,
    when: date | None = None,
    console: Console | None = None,
) -> tuple[Path, list[str]]:
    console = console or Console()
    when = when or date.today()
    template = md.read(paths.prompts_dir / "weekly.md")

    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    _print_pulse(conn, console)

    structured: dict[str, Any] = {}
    for spec in template.metadata.get("prompts", []) or []:
        value = _ask_prompt(spec, console, prefilled=prefilled_metadata)
        if value is not None:
            structured[spec["key"]] = value

    scaffold = _render_scaffold(template.metadata.get("sections", []) or [])
    body = text_override if text_override is not None else _editor_or_inline(scaffold, use_editor=use_editor, console=console)

    metadata: dict[str, Any] = {
        "date": when.isoformat(),
        "type": "weekly",
        **structured,
    }
    if prefilled_metadata:
        for k, v in prefilled_metadata.items():
            metadata.setdefault(k, v)

    out_path = output_path_for(paths, "weekly", when)
    md.write(out_path, metadata, body)
    sqlite_mod.upsert_entry(conn, md.read(out_path), paths.home)
    conn.close()
    console.print(f"[green]wrote[/green] {out_path.relative_to(paths.home)}")
    return out_path, []
