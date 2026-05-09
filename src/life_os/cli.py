"""Life OS CLI entry points.

Three console scripts (declared in pyproject.toml):
- `life-os` — the umbrella app (`life-os journal evening`, `life-os status`, ...)
- `journal` — the journal sub-app exposed directly (`journal evening`, ...)
- `status`  — the status command exposed directly
"""
from __future__ import annotations

import os
from datetime import date as _date
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.prompt import Prompt

from . import config
from .dashboards import status as status_mod
from .journal import ask as ask_mod
from .journal import evening as evening_mod
from .journal import log as log_mod
from .journal import weekly as weekly_mod
from .storage import encryption, markdown as md, sqlite as sqlite_mod


# --- Sub-app: config -------------------------------------------------------

config_app = typer.Typer(help="Life OS config (API key, age identity)", no_args_is_help=True)


@config_app.command("set-key")
def cmd_set_key() -> None:
    """Store the Anthropic API key in the OS keychain."""
    console = Console()
    key = Prompt.ask("Anthropic API key", password=True, console=console)
    if not key.strip():
        console.print("[yellow]empty input; not stored[/yellow]")
        raise typer.Exit(code=1)
    config.set_api_key(key.strip())
    console.print("[green]stored in OS keychain[/green]")


@config_app.command("show")
def cmd_show_config() -> None:
    paths = config.load_paths()
    console = Console()
    console.print(f"home:        {paths.home}")
    console.print(f"roadmap:     {paths.roadmap_dir}")
    console.print(f"journal:     {paths.journal_dir}")
    console.print(f"data:        {paths.data_dir}")
    console.print(f"sqlite:      {paths.sqlite_path}")
    console.print(f"age key:     {paths.age_key_path} (exists: {paths.age_key_path.exists()})")
    console.print(f"api key set: {bool(config.get_api_key())}")
    console.print(f"model:       {config.get_model()}  (fast: {config.get_model(fast=True)})")


@config_app.command("init-age")
def cmd_init_age(
    passphrase: Optional[str] = typer.Option(None, help="Optional passphrase to protect the key file."),
) -> None:
    """Create an age identity at ~/.life-os/age.key (or LIFE_OS_AGE_KEY)."""
    paths = config.load_paths()
    console = Console()
    if not encryption.age_available():
        console.print("[red]`age` binary not found on PATH. Install age then retry.[/red]")
        raise typer.Exit(code=2)
    if paths.age_key_path.exists():
        console.print(f"[yellow]identity already exists at {paths.age_key_path}; refusing to overwrite[/yellow]")
        raise typer.Exit(code=1)
    encryption.generate_identity(paths.age_key_path, passphrase=passphrase)
    console.print(f"[green]wrote[/green] {paths.age_key_path} (chmod 600 on Unix)")


# --- Journal sub-app -------------------------------------------------------

journal_app = typer.Typer(help="Life OS journal (evening / weekly / log / ask)", no_args_is_help=True)
journal_app.add_typer(config_app, name="config")


@journal_app.command("evening")
def cmd_evening(
    no_editor: bool = typer.Option(False, "--no-editor", help="Skip the editor; write the placeholder scaffold as-is."),
    text: Optional[str] = typer.Option(None, "--text", help="Use this text as the body, skipping editor."),
    when: Optional[str] = typer.Option(None, "--date", help="ISO date override (default: today)."),
) -> None:
    paths = config.load_paths()
    target_date = _date.fromisoformat(when) if when else None
    evening_mod.run(paths, use_editor=not no_editor, text_override=text, when=target_date)


@journal_app.command("weekly")
def cmd_weekly(
    no_editor: bool = typer.Option(False, "--no-editor"),
    text: Optional[str] = typer.Option(None, "--text"),
    when: Optional[str] = typer.Option(None, "--date"),
) -> None:
    paths = config.load_paths()
    target_date = _date.fromisoformat(when) if when else None
    weekly_mod.run(paths, use_editor=not no_editor, text_override=text, when=target_date)


@journal_app.command("log")
def cmd_log(
    domain: str = typer.Argument(..., help=f"One of: {', '.join(config.DOMAINS)}"),
    log_type: Optional[str] = typer.Option(None, "--type", "-t", help="Skip the prompt and use this log type."),
    no_editor: bool = typer.Option(False, "--no-editor"),
    text: Optional[str] = typer.Option(None, "--text"),
) -> None:
    paths = config.load_paths()
    log_mod.run(paths, domain, log_type=log_type, use_editor=not no_editor, text_override=text)


@journal_app.command("ask")
def cmd_ask(
    window: str = typer.Option("all", "--window", help="all | 7d | now"),
    fast: bool = typer.Option(False, "--fast", help="Use the haiku model."),
    prompt: Optional[str] = typer.Option(None, "--prompt", help="One-shot prompt; skips REPL."),
    max_tokens: int = typer.Option(1024, "--max-tokens"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Print prompt summary; do not call API."),
) -> None:
    paths = config.load_paths()
    code = ask_mod.run(
        paths,
        window=window,
        fast=fast,
        one_shot=prompt,
        max_tokens=max_tokens,
        dry_run=dry_run,
    )
    raise typer.Exit(code=code)


@journal_app.command("unlock")
def cmd_unlock() -> None:
    """Decrypt the private bucket into data/private/ for this shell session."""
    paths = config.load_paths()
    console = Console()
    if not paths.age_key_path.exists():
        console.print(f"[red]no age identity at {paths.age_key_path}; run `journal config init-age` first[/red]")
        raise typer.Exit(code=2)
    if not paths.private_dir.exists():
        console.print("[yellow]no private bucket yet; nothing to unlock[/yellow]")
        raise typer.Exit(code=0)
    staging = paths.data_dir / "private"
    staging.mkdir(parents=True, exist_ok=True)
    decrypted = 0
    for ciphertext_path in sorted(paths.private_dir.glob("*.age")):
        plaintext = encryption.decrypt_with_identity(ciphertext_path.read_bytes(), paths.age_key_path)
        out_path = staging / (ciphertext_path.stem + ".md")
        out_path.write_bytes(plaintext)
        try:
            out_path.chmod(0o600)
        except OSError:
            pass
        decrypted += 1
    console.print(f"[green]decrypted[/green] {decrypted} file(s) into {staging}")


@journal_app.command("lock")
def cmd_lock() -> None:
    """Wipe the decrypted staging dir."""
    paths = config.load_paths()
    console = Console()
    staging = paths.data_dir / "private"
    if not staging.exists():
        console.print("[yellow]nothing to lock[/yellow]")
        return
    count = 0
    for p in staging.glob("**/*"):
        if p.is_file():
            try:
                p.write_bytes(b"\x00" * min(len(p.read_bytes()), 4096))
            except OSError:
                pass
            p.unlink(missing_ok=True)
            count += 1
    try:
        staging.rmdir()
    except OSError:
        pass
    console.print(f"[green]locked[/green]; wiped {count} file(s)")


@journal_app.command("reindex")
def cmd_journal_reindex() -> None:
    paths = config.load_paths()
    console = Console()
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    sqlite_mod.reset_db(conn)
    sqlite_mod.init_db(conn, paths.schema_sql)
    counts = sqlite_mod.reindex_all(conn, paths)
    console.print(f"[green]reindex[/green]: {counts}")
    conn.close()


# --- Top-level umbrella app ------------------------------------------------

app = typer.Typer(help="Life OS — roadmap + journal", no_args_is_help=True)
app.add_typer(journal_app, name="journal")


@app.command("status")
def cmd_status() -> None:
    """Print the dashboard."""
    paths = config.load_paths()
    code = status_mod.run(paths)
    raise typer.Exit(code=code)


@app.command("reindex")
def cmd_reindex() -> None:
    cmd_journal_reindex()


# Standalone entry for the `status` script.
def status_command() -> None:
    paths = config.load_paths()
    code = status_mod.run(paths)
    raise typer.Exit(code=code)


if __name__ == "__main__":
    app()
