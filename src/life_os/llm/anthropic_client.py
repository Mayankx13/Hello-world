"""Anthropic SDK wrapper with prompt caching for `journal ask`.

Strategy: build a system prompt with up to four `cache_control` breakpoints —
persona, ROADMAP.md, per-domain roadmap files, and the journal corpus. The
user message is uncached so cache hit rate stays near 100% for follow-ups.

Per the Anthropic API documentation, only the last 4 cache_control blocks are
honored. Newer breakpoints invalidate older ones in the same request.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable

from .. import config


PERSONA = """You are Mayank's reflective operating partner inside Life OS.

You are talking with Mayank — 28M, software engineer, lean-bulking on
isotretinoin, just bought a home (move-in May 2026), running PerfectGhar (a
real-estate B2C lead-gen play), prepping a 40 LPA remote switch for Q4 2026,
and aiming for a US B1/B2 visa for a 2027 visit to his brother at CMU.

His six domains are: Body, PerfectGhar, Career, Finance, Social, Growth.

Operating principles to encode in your replies:
- Move fast; be honest; surface drift.
- Systems > motivation. Reference his roadmap and recent entries explicitly.
- Selective with people and time.
- Cross-domain awareness: bad sleep affects training; offer signing affects
  PerfectGhar moonlighting; isotretinoin shapes Body periodization.
- No streak guilt. No congratulation theater. If you see a pattern of
  avoidance, name it. If a milestone is overdue, ask whether to move it or
  kill it — never let it rot quietly.

When you respond:
- Be brief. Default to ≤150 words unless he asks for depth.
- Cite specific dates, files, or entry excerpts so he can verify.
- If he's asking what to do next, give one concrete action with a date.
- If you don't know, say so.
"""


def _read_text_safe(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def _gather_roadmap(paths: config.Paths) -> tuple[str, str]:
    """Return (master_text, per_domain_concat). Both can be cache-marked."""
    master = _read_text_safe(paths.roadmap_master)
    pieces: list[str] = []
    if paths.roadmap_dir.exists():
        for p in sorted(paths.roadmap_dir.glob("*.md")):
            pieces.append(f"# FILE: {p.name}\n\n{_read_text_safe(p)}\n")
    return master, "\n\n---\n\n".join(pieces)


def _gather_corpus(paths: config.Paths, *, max_chars: int = 200_000) -> str:
    """Concatenate journal entries (oldest → newest), bounded."""
    chunks: list[str] = []
    if paths.entries_dir.exists():
        files = sorted(paths.entries_dir.rglob("*.md"))
        for p in files:
            try:
                rel = p.relative_to(paths.home)
            except ValueError:
                rel = p
            chunks.append(f"# ENTRY: {rel}\n\n{_read_text_safe(p)}\n")
    if paths.logs_dir.exists():
        for p in sorted(paths.logs_dir.rglob("*.md")):
            try:
                rel = p.relative_to(paths.home)
            except ValueError:
                rel = p
            chunks.append(f"# LOG: {rel}\n\n{_read_text_safe(p)}\n")
    text = "\n\n---\n\n".join(chunks)
    if len(text) > max_chars:
        # Keep newest by trimming from the front.
        text = text[-max_chars:]
        text = "[...older entries truncated to keep cache prefix bounded...]\n\n" + text
    return text


@dataclass
class CachedPrompt:
    system_blocks: list[dict[str, Any]]
    debug_summary: dict[str, int]


def build_prompt(paths: config.Paths, *, window: str = "all") -> CachedPrompt:
    """Build the cached system prompt for `journal ask`.

    `window`:
      - "all": full corpus (default; matches user's chosen behavior).
      - "7d": last 7 days of entries/logs only.
      - "now": no corpus; just persona + roadmap.
    """
    today = date.today()
    persona = PERSONA + f"\n\nToday: {today.isoformat()}\n"
    master_md, per_domain_md = _gather_roadmap(paths)
    corpus = ""
    if window == "all":
        corpus = _gather_corpus(paths)
    elif window == "7d":
        corpus = _gather_corpus(paths, max_chars=80_000)
        # Cheap cutoff: drop entries older than 8 days based on filename ISO date.
        cutoff = today.toordinal() - 8
        keep_lines: list[str] = []
        for entry in corpus.split("\n\n---\n\n"):
            kept = True
            for token in entry.splitlines()[:1]:
                # Look for YYYY-MM-DD anywhere in header line.
                import re

                m = re.search(r"(\d{4})-(\d{2})-(\d{2})", token)
                if m:
                    try:
                        d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                        if d.toordinal() < cutoff:
                            kept = False
                    except ValueError:
                        pass
            if kept:
                keep_lines.append(entry)
        corpus = "\n\n---\n\n".join(keep_lines)
    elif window == "now":
        corpus = ""
    else:
        raise ValueError(f"unknown window: {window!r}")

    blocks: list[dict[str, Any]] = []
    blocks.append({
        "type": "text",
        "text": persona,
        "cache_control": {"type": "ephemeral"},
    })
    if master_md:
        blocks.append({
            "type": "text",
            "text": "<roadmap_master>\n" + master_md + "\n</roadmap_master>",
            "cache_control": {"type": "ephemeral"},
        })
    if per_domain_md:
        blocks.append({
            "type": "text",
            "text": "<roadmap_domains>\n" + per_domain_md + "\n</roadmap_domains>",
            "cache_control": {"type": "ephemeral"},
        })
    if corpus:
        blocks.append({
            "type": "text",
            "text": "<journal_corpus>\n" + corpus + "\n</journal_corpus>",
            "cache_control": {"type": "ephemeral"},
        })

    return CachedPrompt(
        system_blocks=blocks,
        debug_summary={
            "blocks": len(blocks),
            "persona_chars": len(persona),
            "master_chars": len(master_md),
            "domains_chars": len(per_domain_md),
            "corpus_chars": len(corpus),
        },
    )


def make_client():
    import anthropic

    api_key = config.get_api_key()
    if not api_key:
        raise RuntimeError(
            "No Anthropic API key found. Set one with `journal config set-key` "
            "(stores in OS keychain) or export ANTHROPIC_API_KEY."
        )
    return anthropic.Anthropic(api_key=api_key)


def stream_reply(client, model: str, prompt: CachedPrompt, messages: list[dict[str, Any]], max_tokens: int = 1024):
    """Stream a reply. Yields text chunks. Returns the final Message via .response."""
    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=prompt.system_blocks,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
