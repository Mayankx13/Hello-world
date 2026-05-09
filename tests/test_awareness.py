from __future__ import annotations

from datetime import date, timedelta

from life_os import awareness
from life_os.storage import markdown as md
from life_os.storage import sqlite as sqlite_mod


def _evening(paths, when: date, *, energy: int, sleep_hours: float, body: str = ""):
    p = paths.entries_dir / f"{when.year:04d}" / f"{when.month:02d}" / f"{when.isoformat()}-evening.md"
    md.write(p, {"date": when.isoformat(), "type": "evening", "energy": energy, "sleep_hours": sleep_hours}, body)
    return p


def test_low_sleep_rule_triggers(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    today = date.today()
    for offset, hrs in ((0, 5.0), (1, 5.5)):
        path = _evening(paths, today - timedelta(days=offset), energy=6, sleep_hours=hrs)
        sqlite_mod.upsert_entry(conn, md.read(path), paths.home)
    out = awareness.rule_low_sleep_streak(conn)
    assert out is not None and "short nights" in out


def test_low_sleep_rule_silent_when_well_rested(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    today = date.today()
    for offset, hrs in ((0, 7.5), (1, 7.0), (2, 7.5)):
        path = _evening(paths, today - timedelta(days=offset), energy=7, sleep_hours=hrs)
        sqlite_mod.upsert_entry(conn, md.read(path), paths.home)
    assert awareness.rule_low_sleep_streak(conn) is None


def test_avoidance_pattern_detection(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    today = date.today()
    body = "## Wins\n\nx\n\n## Avoided\n\nlinkedin profile rewrite\n"
    for offset in range(4):
        path = _evening(paths, today - timedelta(days=offset), energy=6, sleep_hours=7.0, body=body)
        sqlite_mod.upsert_entry(conn, md.read(path), paths.home)
    out = awareness.rule_avoidance_pattern(conn)
    assert out is not None
    assert "linkedin" in out.lower() or "profile" in out.lower() or "rewrite" in out.lower()


def test_overdue_milestones(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    sqlite_mod.reindex_all(conn, paths)
    cur = conn.cursor()
    # Force one milestone to be overdue.
    cur.execute("UPDATE roadmap_items SET due_date = '2020-01-01', status='active' "
                "WHERE id IN (SELECT id FROM roadmap_items LIMIT 1)")
    conn.commit()
    overdue = awareness.rule_overdue_milestones(conn)
    assert any("Overdue" in s for s in overdue)
