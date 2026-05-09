"""Cross-domain awareness rules.

Rules are simple Python functions that read SQLite and return human-readable
suggestions. They are surfaced after `journal evening` and inside `status`.
No ML, no streak shaming.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import date, timedelta

from . import config


def _row_value(row: sqlite3.Row, key: str, default=None):
    try:
        v = row[key]
    except (IndexError, KeyError):
        return default
    return default if v is None else v


def rule_low_sleep_streak(conn: sqlite3.Connection) -> str | None:
    cur = conn.cursor()
    cur.execute(
        "SELECT date, sleep_hours FROM entries WHERE kind='evening' AND date >= date('now', '-3 days') "
        "ORDER BY date DESC LIMIT 3"
    )
    rows = cur.fetchall()
    if len(rows) < 2:
        return None
    short_nights = [r for r in rows if r["sleep_hours"] is not None and r["sleep_hours"] < 6]
    if len(short_nights) >= 2:
        nights = ", ".join(f"{r['date']} ({r['sleep_hours']}h)" for r in short_nights)
        return (
            f"Sleep flag: {len(short_nights)} short nights in last 3 ({nights}). "
            "Per Body roadmap: tomorrow is mobility + cardio, not heavy training."
        )
    return None


def rule_low_energy_streak(conn: sqlite3.Connection) -> str | None:
    cur = conn.cursor()
    cur.execute(
        "SELECT date, energy FROM entries WHERE kind='evening' AND date >= date('now', '-7 days') "
        "AND energy IS NOT NULL ORDER BY date DESC"
    )
    rows = cur.fetchall()
    if len(rows) < 3:
        return None
    avg = sum(r["energy"] for r in rows) / len(rows)
    if avg < 5:
        return (
            f"Energy flag: 7-day avg energy {avg:.1f}. "
            "Worth a `journal log body labs` if this is a derma/ lipid signal."
        )
    return None


def rule_domain_drift(conn: sqlite3.Connection) -> list[str]:
    """Domains with no log entries in 10+ days."""
    cur = conn.cursor()
    suggestions: list[str] = []
    cur.execute("SELECT domain, MAX(date) AS d FROM logs GROUP BY domain")
    seen = {r["domain"]: r["d"] for r in cur.fetchall()}
    today = date.today()
    cutoff = today - timedelta(days=10)
    for domain in config.DOMAINS:
        last = seen.get(domain)
        if last is None:
            continue
        try:
            last_d = date.fromisoformat(last)
        except ValueError:
            continue
        if last_d < cutoff:
            days = (today - last_d).days
            suggestions.append(f"Domain drift: {domain} — last log {days} days ago.")
    return suggestions


def rule_avoidance_pattern(conn: sqlite3.Connection) -> str | None:
    """If 'Avoided' section in last 7 evenings repeats the same word."""
    cur = conn.cursor()
    cur.execute(
        "SELECT body FROM entries WHERE kind='evening' AND date >= date('now', '-7 days') ORDER BY date DESC"
    )
    rows = cur.fetchall()
    if len(rows) < 3:
        return None
    import re
    from collections import Counter

    words: Counter[str] = Counter()
    for row in rows:
        body = row["body"] or ""
        # Pull text under "## Avoided" heading until next heading.
        m = re.search(r"##\s+Avoided\s*\n+(.*?)(?:\n##|\Z)", body, re.DOTALL | re.IGNORECASE)
        if not m:
            continue
        section = m.group(1).lower()
        for token in re.findall(r"[a-z]{4,}", section):
            if token in {"that", "this", "with", "have", "been", "from", "into", "what", "when", "kind"}:
                continue
            words[token] += 1
    if not words:
        return None
    most, count = words.most_common(1)[0]
    if count >= 3:
        return f"Avoidance pattern: '{most}' shows up {count} times in last week's Avoided sections."
    return None


def rule_overdue_milestones(conn: sqlite3.Connection) -> list[str]:
    cur = conn.cursor()
    cur.execute(
        "SELECT domain, title, due_date FROM roadmap_items "
        "WHERE status != 'done' AND due_date IS NOT NULL AND due_date < date('now') "
        "ORDER BY due_date ASC LIMIT 5"
    )
    rows = cur.fetchall()
    return [f"Overdue: {r['domain']} — {r['title']} (due {r['due_date']})" for r in rows]


def evening_followups(conn: sqlite3.Connection, paths: config.Paths) -> list[str]:
    out: list[str] = []
    for fn in (rule_low_sleep_streak, rule_low_energy_streak, rule_avoidance_pattern):
        msg = fn(conn)
        if msg:
            out.append(msg)
    out.extend(rule_domain_drift(conn))
    out.extend(rule_overdue_milestones(conn))
    return out
