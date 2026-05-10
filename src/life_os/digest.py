"""Weekly digest — structured roll-up of the journal corpus.

The digest is *structured* (templated headers + per-domain rollup + a
"next week" block) so the format stays stable week to week. Claude
generates only the qualitative blocks; the stats and roadmap pulse come
from SQLite directly.

Saved to `digests/YYYY-Www.md` (ISO week) for weekly digests and
`digests/YYYY-MM-DD.md` for ad-hoc.
"""
from __future__ import annotations

import json
import sqlite3
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

from . import awareness, config
from .llm import anthropic_client
from .storage import markdown as md
from .storage import sqlite as sqlite_mod


# --- Data gathering --------------------------------------------------------


@dataclass
class DigestData:
    period_start: date
    period_end: date
    entries: list[sqlite3.Row]
    logs: list[sqlite3.Row]
    active_phases: list[sqlite3.Row]
    overdue: list[sqlite3.Row]
    awareness_signals: list[str]
    streak_days: int


def _resolve_window(window: str, today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    if window in {"7d", "1w", "week"}:
        return today - timedelta(days=6), today
    if window in {"30d", "1m", "month"}:
        return today - timedelta(days=29), today
    if window == "all":
        return date(1970, 1, 1), today
    if window.endswith("d") and window[:-1].isdigit():
        n = int(window[:-1])
        return today - timedelta(days=n - 1), today
    raise ValueError(f"unknown window: {window!r}")


def _streak(conn: sqlite3.Connection, today: date) -> int:
    cur = conn.cursor()
    cur.execute("SELECT date FROM entries WHERE kind='evening' ORDER BY date DESC LIMIT 60")
    seen = {row["date"] for row in cur.fetchall()}
    streak = 0
    cursor = today
    while cursor.isoformat() in seen:
        streak += 1
        cursor = date.fromordinal(cursor.toordinal() - 1)
    return streak


def gather(paths: config.Paths, window: str = "7d", today: date | None = None) -> DigestData:
    today = today or date.today()
    period_start, period_end = _resolve_window(window, today)
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM roadmap_items")
    if cur.fetchone()["c"] == 0:
        sqlite_mod.reindex_all(conn, paths)

    cur.execute(
        "SELECT * FROM entries WHERE date >= ? AND date <= ? ORDER BY date DESC",
        (period_start.isoformat(), period_end.isoformat()),
    )
    entries = cur.fetchall()
    cur.execute(
        "SELECT * FROM logs WHERE date >= ? AND date <= ? ORDER BY date DESC",
        (period_start.isoformat(), period_end.isoformat()),
    )
    logs = cur.fetchall()
    active_phases = sqlite_mod.fetch_active_phases(conn)
    overdue = sqlite_mod.fetch_overdue_items(conn)
    awareness_signals = awareness.evening_followups(conn, paths)
    streak_days = _streak(conn, today)
    conn.close()
    return DigestData(
        period_start=period_start,
        period_end=period_end,
        entries=list(entries),
        logs=list(logs),
        active_phases=list(active_phases),
        overdue=list(overdue),
        awareness_signals=awareness_signals,
        streak_days=streak_days,
    )


# --- Stat blocks (no LLM) --------------------------------------------------


def _avg(values: Iterable[float | int | None]) -> float | None:
    nums = [v for v in values if v is not None]
    if not nums:
        return None
    return sum(nums) / len(nums)


def _stats_block(data: DigestData) -> str:
    days = (data.period_end - data.period_start).days + 1
    entries_by_kind = Counter(e["kind"] for e in data.entries)
    logs_by_domain: dict[str, Counter[str]] = defaultdict(Counter)
    for row in data.logs:
        logs_by_domain[row["domain"]][row["log_type"]] += 1

    sleep_avg = _avg(e["sleep_hours"] for e in data.entries)
    energy_avg = _avg(e["energy"] for e in data.entries)

    lines = ["## Numbers", ""]
    lines.append(f"- Evening entries: {entries_by_kind.get('evening', 0)} / {days} days")
    lines.append(f"- Weekly entries: {entries_by_kind.get('weekly', 0)}")
    if logs_by_domain:
        log_summary = "; ".join(
            f"{domain} {sum(types.values())} ({', '.join(f'{c} {t}' for t, c in types.most_common())})"
            for domain, types in sorted(logs_by_domain.items())
        )
        lines.append(f"- Logs: {log_summary}")
    else:
        lines.append("- Logs: none")
    avg_bits = []
    if sleep_avg is not None:
        avg_bits.append(f"sleep avg {sleep_avg:.1f}h")
    if energy_avg is not None:
        avg_bits.append(f"energy avg {energy_avg:.1f}/10")
    avg_bits.append(f"streak {data.streak_days}")
    lines.append(f"- {'  •  '.join(avg_bits)}")
    return "\n".join(lines)


def _roadmap_pulse_block(data: DigestData) -> str:
    by_domain: dict[str, sqlite3.Row] = {}
    for row in data.active_phases:
        if row["domain"] in by_domain:
            continue
        by_domain[row["domain"]] = row
    lines = ["## Roadmap pulse", ""]
    today = data.period_end
    for domain in config.DOMAINS:
        row = by_domain.get(domain)
        if not row:
            lines.append(f"- **{domain}** — no active phase indexed.")
            continue
        due = row["due_date"]
        due_part = ""
        if due:
            try:
                due_d = date.fromisoformat(due)
                delta = (due_d - today).days
                due_part = f", due {due} ({delta} days left)" if delta >= 0 else f", **due {due} ({-delta} days overdue)**"
            except ValueError:
                due_part = f", due {due}"
        lines.append(f"- **{domain}**: {row['title']}{due_part}")
    if data.overdue:
        lines.append("")
        lines.append("Overdue milestones:")
        for row in data.overdue[:5]:
            lines.append(f"  - {row['domain']}: {row['title']} (due {row['due_date']})")
    return "\n".join(lines)


def _awareness_block(data: DigestData) -> str:
    if not data.awareness_signals:
        return "## Awareness\n\n- Nothing flagged this week."
    return "## Awareness\n\n" + "\n".join(f"- {s}" for s in data.awareness_signals)


def _per_domain_log_summary(data: DigestData) -> dict[str, list[str]]:
    """Pull short body excerpts per domain so the LLM has raw signal."""
    out: dict[str, list[str]] = defaultdict(list)
    for row in data.logs:
        body = (row["body"] or "").strip().splitlines()
        # First non-blank, non-heading line.
        excerpt = next((line for line in body if line.strip() and not line.lstrip().startswith("#")), "")
        if excerpt:
            out[row["domain"]].append(f"({row['date']} {row['log_type']}) {excerpt[:160]}")
    return out


def _entry_excerpts(data: DigestData) -> list[str]:
    out: list[str] = []
    for row in data.entries:
        body = (row["body"] or "").strip()
        if not body:
            continue
        out.append(f"### {row['date']} ({row['kind']})\n{body[:1200]}")
    return out


# --- LLM block ------------------------------------------------------------


_LLM_SYSTEM = """You are generating a section of Mayank's Life OS weekly digest.

Be honest, brief, and specific. No congratulation theater. Don't repeat
the stats — they appear elsewhere. Cite specific dates or entries when
useful. Surface drift; if a domain has zero meaningful action, say so.
"""


_LLM_USER_TEMPLATE = """Generate two markdown sections for the digest.

Window: {start} to {end}

## Per-domain read
For each of the six domains (body, perfectghar, career, finance, social, growth),
write 1–3 sentences distilling what actually happened. If nothing happened in
a domain, say "(no signal this week)" — don't invent action. Use ### Domain
headers (lowercase domain name).

## What I'd focus on next week
3–5 bullets. Each bullet is one concrete action (verb + object), tied to
the active phase or to drift you observed. Anchor to roadmap dates when
relevant. No vague aspirations.

Source material — entries this week:

{entries}

Source material — log excerpts grouped by domain:

{logs}

Active phases:

{phases}

Awareness signals:

{signals}

Output ONLY the two requested markdown sections. Start with "## Per-domain read".
"""


def _llm_section(data: DigestData, paths: config.Paths) -> str:
    try:
        client = anthropic_client.make_client()
    except RuntimeError:
        return (
            "## Per-domain read\n\n*(no Anthropic key configured; LLM synthesis skipped — "
            "add ANTHROPIC_API_KEY or run `journal config set-key` to enable)*\n\n"
            "## What I'd focus on next week\n\n*(LLM synthesis skipped)*"
        )
    entries_text = "\n\n".join(_entry_excerpts(data)) or "(no entries)"
    log_summary = _per_domain_log_summary(data)
    logs_text = "\n".join(
        f"### {domain}\n" + "\n".join(f"- {line}" for line in lines)
        for domain, lines in sorted(log_summary.items())
    ) or "(no logs)"
    phases_text = "\n".join(
        f"- {row['domain']}: {row['title']} (status: {row['status']}, due: {row['due_date'] or '—'})"
        for row in data.active_phases
    ) or "(none)"
    signals_text = "\n".join(f"- {s}" for s in data.awareness_signals) or "(none)"

    user_msg = _LLM_USER_TEMPLATE.format(
        start=data.period_start.isoformat(),
        end=data.period_end.isoformat(),
        entries=entries_text,
        logs=logs_text,
        phases=phases_text,
        signals=signals_text,
    )

    response = client.messages.create(
        model=config.get_model(),
        max_tokens=1500,
        system=[{"type": "text", "text": _LLM_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user_msg}],
    )
    blocks = response.content if hasattr(response, "content") else []
    text_parts = [getattr(b, "text", "") for b in blocks if getattr(b, "type", "") == "text"]
    return "\n".join(t for t in text_parts if t).strip() or "(no LLM output)"


# --- Renderers + path helpers ---------------------------------------------


def _digest_filename(data: DigestData, label: str) -> str:
    if label == "weekly":
        iso = data.period_end.isocalendar()
        return f"{iso.year}-W{iso.week:02d}.md"
    return f"{data.period_end.isoformat()}-{label}.md"


def render(data: DigestData, paths: config.Paths, *, use_llm: bool = True, label: str = "weekly") -> str:
    title = "Weekly digest" if label == "weekly" else f"Digest ({label})"
    iso = data.period_end.isocalendar()
    if label == "weekly":
        title = f"Weekly digest — {iso.year} W{iso.week:02d} ({data.period_start} → {data.period_end})"
    else:
        title = f"Digest — {data.period_start} → {data.period_end}"

    front = (
        f"---\n"
        f"window: {data.period_start} to {data.period_end}\n"
        f"generated: {datetime.now().isoformat(timespec='seconds')}\n"
        f"label: {label}\n"
        f"---\n\n"
        f"# {title}\n"
    )
    parts = [
        front,
        _stats_block(data),
        _roadmap_pulse_block(data),
        _awareness_block(data),
    ]
    if use_llm:
        parts.append(_llm_section(data, paths))
    else:
        parts.append("## Per-domain read\n\n*(LLM synthesis skipped via --no-llm)*\n\n## What I'd focus on next week\n\n*(LLM synthesis skipped)*")
    return "\n\n".join(parts).rstrip() + "\n"


def save(text: str, paths: config.Paths, data: DigestData, *, label: str = "weekly") -> Path:
    digests_dir = paths.home / "digests"
    digests_dir.mkdir(parents=True, exist_ok=True)
    out_path = digests_dir / _digest_filename(data, label)
    out_path.write_text(text, encoding="utf-8")
    return out_path


def generate(
    paths: config.Paths,
    *,
    window: str = "7d",
    label: str | None = None,
    use_llm: bool = True,
    today: date | None = None,
) -> tuple[Path, str, DigestData]:
    """Generate, save, and return (path, text, data)."""
    label = label or ("weekly" if window in {"7d", "1w", "week"} else window)
    data = gather(paths, window=window, today=today)
    text = render(data, paths, use_llm=use_llm, label=label)
    out_path = save(text, paths, data, label=label)
    return out_path, text, data
