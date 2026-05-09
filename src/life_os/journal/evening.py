"""`journal evening` — ~3-min reflection capture."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import click
from rich.console import Console
from rich.prompt import Prompt

from .. import config
from ..storage import markdown as md
from ..storage import sqlite as sqlite_mod
from .. import awareness


def _render_scaffold(sections: list[dict[str, Any]]) -> str:
    parts = []
    for section in sections:
        heading = section.get("heading", "Section")
        placeholder = section.get("placeholder", "").strip()
        comment = f"<!-- {placeholder} -->" if placeholder else ""
        parts.append(f"## {heading}\n\n{comment}\n")
    return "\n".join(parts).rstrip() + "\n"


def _ask_prompt(spec: dict[str, Any], console: Console, prefilled: dict[str, Any] | None = None) -> Any:
    key = spec["key"]
    if prefilled is not None and key in prefilled:
        return prefilled[key]
    label = spec.get("label", key)
    kind = spec.get("type", "text")
    try:
        if kind == "choice":
            options = spec.get("options", [])
            return Prompt.ask(label, choices=options, default=options[0] if options else None, console=console)
        raw = Prompt.ask(label, default="", console=console)
    except (EOFError, KeyboardInterrupt):
        return None
    if not raw:
        return None
    if kind == "int":
        try:
            value = int(raw)
        except ValueError:
            console.print(f"[yellow]not an integer, keeping as text: {raw}[/yellow]")
            return raw
        if "min" in spec and value < spec["min"]:
            value = spec["min"]
        if "max" in spec and value > spec["max"]:
            value = spec["max"]
        return value
    if kind == "float":
        try:
            return float(raw)
        except ValueError:
            console.print(f"[yellow]not a number, keeping as text: {raw}[/yellow]")
            return raw
    return raw


def _editor_or_inline(scaffold: str, *, use_editor: bool, console: Console) -> str:
    if not use_editor:
        return scaffold
    try:
        edited = click.edit(scaffold, require_save=False, extension=".md")
    except click.UsageError as exc:
        console.print(f"[yellow]editor unavailable ({exc}); writing scaffold as-is[/yellow]")
        return scaffold
    return edited if edited is not None else scaffold


def output_path_for(paths: config.Paths, kind: str, when: date) -> Path:
    return paths.entries_dir / f"{when.year:04d}" / f"{when.month:02d}" / f"{when.isoformat()}-{kind}.md"


def run(
    paths: config.Paths,
    *,
    use_editor: bool = True,
    text_override: str | None = None,
    prefilled_metadata: dict[str, Any] | None = None,
    when: date | None = None,
    console: Console | None = None,
) -> tuple[Path, list[str]]:
    """Run the evening flow. Returns (entry_path, awareness_suggestions)."""
    console = console or Console()
    when = when or date.today()
    template = md.read(paths.prompts_dir / "evening.md")
    structured: dict[str, Any] = {}
    for spec in template.metadata.get("prompts", []) or []:
        value = _ask_prompt(spec, console, prefilled=prefilled_metadata)
        if value is not None:
            structured[spec["key"]] = value

    scaffold = _render_scaffold(template.metadata.get("sections", []) or [])
    if text_override is not None:
        body = text_override
    else:
        body = _editor_or_inline(scaffold, use_editor=use_editor, console=console)

    metadata: dict[str, Any] = {
        "date": when.isoformat(),
        "type": "evening",
        **structured,
    }
    if prefilled_metadata:
        for k, v in prefilled_metadata.items():
            metadata.setdefault(k, v)

    out_path = output_path_for(paths, "evening", when)
    md.write(out_path, metadata, body)

    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    sqlite_mod.upsert_entry(conn, md.read(out_path), paths.home)
    suggestions = awareness.evening_followups(conn, paths)
    conn.close()

    console.print(f"[green]wrote[/green] {out_path.relative_to(paths.home)}")
    if suggestions:
        console.print("\n[bold]Awareness:[/bold]")
        for s in suggestions:
            console.print(f"  • {s}")
    return out_path, suggestions
