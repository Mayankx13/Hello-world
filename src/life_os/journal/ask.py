"""`journal ask` — talk to Claude with cached corpus context."""
from __future__ import annotations

from typing import Any

from rich.console import Console
from rich.prompt import Prompt

from .. import config
from ..llm import anthropic_client


def run(
    paths: config.Paths,
    *,
    window: str = "all",
    fast: bool = False,
    one_shot: str | None = None,
    max_tokens: int = 1024,
    console: Console | None = None,
    dry_run: bool = False,
) -> int:
    """Interactive REPL with Claude. Returns exit code."""
    console = console or Console()
    prompt = anthropic_client.build_prompt(paths, window=window)
    summary = prompt.debug_summary
    console.print(
        f"[dim]ask: window={window} blocks={summary['blocks']} "
        f"persona={summary['persona_chars']}c "
        f"master={summary['master_chars']}c "
        f"domains={summary['domains_chars']}c "
        f"corpus={summary['corpus_chars']}c[/dim]"
    )

    if dry_run:
        return 0

    try:
        client = anthropic_client.make_client()
    except RuntimeError as exc:
        console.print(f"[red]{exc}[/red]")
        return 2

    model = config.get_model(fast=fast)
    console.print(f"[dim]model: {model}[/dim]")
    messages: list[dict[str, Any]] = []

    def _send(user_text: str) -> None:
        messages.append({"role": "user", "content": user_text})
        console.print()
        console.print("[bold cyan]claude:[/bold cyan] ", end="")
        full = []
        for chunk in anthropic_client.stream_reply(client, model, prompt, messages, max_tokens=max_tokens):
            console.print(chunk, end="", soft_wrap=True)
            full.append(chunk)
        console.print()
        messages.append({"role": "assistant", "content": "".join(full)})

    if one_shot is not None:
        _send(one_shot)
        return 0

    console.print("[dim]Type a question. /q or empty line to exit.[/dim]\n")
    while True:
        try:
            user_text = Prompt.ask("[bold]you[/bold]", default="", console=console)
        except (EOFError, KeyboardInterrupt):
            console.print()
            return 0
        if not user_text or user_text.strip() in {"/q", "/quit", "/exit"}:
            return 0
        _send(user_text)
