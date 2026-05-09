from __future__ import annotations

from datetime import date

from life_os.storage import markdown as md
from life_os.storage import sqlite as sqlite_mod


def test_init_db_creates_tables(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    names = {r["name"] for r in cur.fetchall()}
    for required in ["entries", "logs", "roadmap_items", "entry_links", "log_links", "tags"]:
        assert required in names
    conn.close()


def test_reindex_picks_up_roadmap_phases(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    counts = sqlite_mod.reindex_all(conn, paths)
    assert counts["roadmap_phases"] > 0
    cur = conn.cursor()
    cur.execute("SELECT domain, COUNT(*) AS c FROM roadmap_items GROUP BY domain ORDER BY domain")
    by_domain = {r["domain"]: r["c"] for r in cur.fetchall()}
    for d in ("body", "perfectghar", "career", "finance", "social", "growth"):
        assert by_domain.get(d, 0) >= 2, f"{d} should have ≥2 phases, got {by_domain.get(d, 0)}"
    conn.close()


def test_upsert_entry_then_query(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    entry_path = paths.entries_dir / "2026" / "05" / "2026-05-09-evening.md"
    md.write(
        entry_path,
        {"date": "2026-05-09", "type": "evening", "energy": 6, "sleep_hours": 7.0},
        "## Wins\n\ntest\n\n## Avoided\n\nemail backlog\n",
    )
    sqlite_mod.upsert_entry(conn, md.read(entry_path), paths.home)
    rows = sqlite_mod.fetch_recent_entries(conn, days=7)
    assert len(rows) == 1
    assert rows[0]["energy"] == 6
    conn.close()


def test_upsert_log(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    log_path = paths.logs_dir / "body" / "2026-05-09-workout-01.md"
    md.write(
        log_path,
        {"date": "2026-05-09", "domain": "body", "log_type": "workout", "rpe": 7},
        "## Notes\n\nUpper A complete.\n",
    )
    sqlite_mod.upsert_log(conn, md.read(log_path), "body", paths.home)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM logs WHERE domain='body'")
    assert cur.fetchone()["c"] == 1
    conn.close()
