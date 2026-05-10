from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from life_os import digest as digest_mod
from life_os.storage import markdown as md
from life_os.storage import sqlite as sqlite_mod


def _seed_evening(paths, day: date, *, energy: int, sleep: float, body: str = "## Wins\n\nshipped\n"):
    p = paths.entries_dir / f"{day.year:04d}" / f"{day.month:02d}" / f"{day.isoformat()}-evening.md"
    md.write(p, {"date": day.isoformat(), "type": "evening", "energy": energy, "sleep_hours": sleep}, body)
    return p


def _seed_log(paths, day: date, domain: str, log_type: str, body: str = "## Notes\n\nfine\n"):
    p = paths.logs_dir / domain / f"{day.isoformat()}-{log_type}-01.md"
    md.write(p, {"date": day.isoformat(), "domain": domain, "log_type": log_type}, body)
    return p


def test_resolve_window_7d():
    today = date(2026, 5, 10)
    start, end = digest_mod._resolve_window("7d", today)
    assert start == date(2026, 5, 4)
    assert end == today


def test_resolve_window_30d_and_custom():
    today = date(2026, 5, 10)
    start, _ = digest_mod._resolve_window("30d", today)
    assert (today - start).days == 29
    start2, _ = digest_mod._resolve_window("14d", today)
    assert (today - start2).days == 13


def test_gather_collects_entries_and_logs(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    today = date.today()
    paths_in_window = [
        _seed_evening(paths, today, energy=7, sleep=7.5),
        _seed_evening(paths, today - timedelta(days=2), energy=6, sleep=6.0),
    ]
    log_paths = [
        _seed_log(paths, today, "body", "workout"),
        _seed_log(paths, today - timedelta(days=1), "perfectghar", "interview"),
    ]
    for p in paths_in_window:
        sqlite_mod.upsert_entry(conn, md.read(p), paths.home)
    for p in log_paths:
        sqlite_mod.upsert_log(conn, md.read(p), p.parent.name, paths.home)
    sqlite_mod.reindex_all(conn, paths)
    conn.close()

    data = digest_mod.gather(paths, window="7d", today=today)
    assert len(data.entries) == 2
    assert len(data.logs) == 2
    assert data.streak_days >= 1
    assert any(row["domain"] == "body" for row in data.active_phases)


def test_render_without_llm_includes_required_sections(paths):
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    today = date.today()
    sqlite_mod.upsert_entry(
        conn,
        md.read(_seed_evening(paths, today, energy=7, sleep=7.5)),
        paths.home,
    )
    sqlite_mod.reindex_all(conn, paths)
    conn.close()

    out_path, text, data = digest_mod.generate(paths, window="7d", use_llm=False, today=today)
    assert out_path.exists()
    assert out_path.parent.name == "digests"
    for required in ("# Weekly digest", "## Numbers", "## Roadmap pulse", "## Awareness", "## Per-domain read", "## What I'd focus on next week"):
        assert required in text, f"missing {required!r}"


def test_filename_uses_iso_week(paths):
    today = date(2026, 5, 10)  # Sunday → ISO week 19
    sqlite_mod.connect(paths.sqlite_path)  # ensure dir
    out_path, _, _ = digest_mod.generate(paths, window="7d", use_llm=False, today=today)
    assert out_path.name == "2026-W19.md"
