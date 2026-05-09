"""`status` — the 'where am I' dashboard."""
from __future__ import annotations

from datetime import date

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .. import awareness, config
from ..storage import sqlite as sqlite_mod


def _streak(conn) -> int:
    cur = conn.cursor()
    cur.execute("SELECT date FROM entries WHERE kind='evening' ORDER BY date DESC LIMIT 60")
    dates = [date.fromisoformat(r["date"]) for r in cur.fetchall()]
    if not dates:
        return 0
    today = date.today()
    streak = 0
    cursor = today
    seen = set(dates)
    while cursor in seen:
        streak += 1
        cursor = date.fromordinal(cursor.toordinal() - 1)
    return streak


def _phase_table(conn) -> Table:
    table = Table(title="Active phases")
    table.add_column("Domain")
    table.add_column("Phase")
    table.add_column("Due")
    table.add_column("Status")
    for row in sqlite_mod.fetch_active_phases(conn):
        table.add_row(row["domain"], row["title"], row["due_date"] or "—", row["status"])
    return table


def _countdown_table() -> Table:
    today = date.today()
    pinned = [
        ("Move-in settled", date(2026, 5, 22)),
        ("Derma week-4 retest", date(2026, 6, 5)),
        ("Derma week-8 retest", date(2026, 7, 3)),
        ("First SIP debit", date(2026, 7, 31)),
        ("Lean-bulk checkpoint", date(2026, 8, 15)),
        ("≥1 offer at ≥40 LPA", date(2026, 11, 30)),
        ("Job decision", date(2026, 12, 31)),
    ]
    table = Table(title="Countdown")
    table.add_column("Event")
    table.add_column("Date")
    table.add_column("Days")
    for label, target in pinned:
        delta = (target - today).days
        if delta < 0:
            continue
        table.add_row(label, target.isoformat(), str(delta))
    return table


def run(paths: config.Paths, console: Console | None = None) -> int:
    console = console or Console()
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM roadmap_items")
    if cur.fetchone()["c"] == 0:
        sqlite_mod.reindex_all(conn, paths)

    console.print(_phase_table(conn))
    console.print()
    console.print(_countdown_table())

    streak = _streak(conn)
    console.print(f"\nEvening journal streak: [bold]{streak}[/bold] day(s)  (no shame either way)")

    overdue = sqlite_mod.fetch_overdue_items(conn)
    if overdue:
        console.print()
        console.print(Panel.fit(
            "\n".join(f"• {r['domain']}: {r['title']} (due {r['due_date']})" for r in overdue),
            title="Overdue", border_style="red",
        ))

    suggestions = awareness.evening_followups(conn, paths)
    if suggestions:
        console.print()
        console.print(Panel.fit(
            "\n".join(f"• {s}" for s in suggestions),
            title="Awareness", border_style="yellow",
        ))

    conn.close()
    return 0
