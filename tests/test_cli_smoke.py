from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from typer.testing import CliRunner

from life_os.cli import app, journal_app
from life_os.journal import evening as evening_mod
from life_os.journal import log as log_mod
from life_os.journal import weekly as weekly_mod
from life_os.storage import markdown as md, sqlite as sqlite_mod


def test_journal_evening_writes_entry(paths):
    out, suggestions = evening_mod.run(
        paths,
        use_editor=False,
        text_override="## Wins\n\nshipped life-os v1\n\n## Avoided\n\nemail backlog\n",
        prefilled_metadata={"energy": 7, "sleep_hours": 7.5, "training_status": "done", "derma_status": "none"},
    )
    assert out.exists()
    doc = md.read(out)
    assert doc.metadata["energy"] == 7
    assert doc.metadata["type"] == "evening"
    assert "shipped life-os v1" in doc.body
    assert isinstance(suggestions, list)


def test_journal_weekly_writes_entry(paths):
    out, _ = weekly_mod.run(
        paths,
        use_editor=False,
        text_override="## Wins\n\nbuilt v1\n",
        prefilled_metadata={"avg_energy": 7, "avg_sleep": 7.0, "padel_sessions": 1},
    )
    assert out.exists()
    doc = md.read(out)
    assert doc.metadata["type"] == "weekly"
    assert doc.metadata["avg_energy"] == 7


def test_journal_log_body_workout(paths):
    out = log_mod.run(
        paths,
        "body",
        log_type="workout",
        use_editor=False,
        text_override="## Notes\n\nUpper A complete.\n",
        prefilled_metadata={"session": "Upper A", "top_lift": "OHP 50kg 5x5", "rpe": 7, "joint_dryness": "none"},
    )
    assert out.exists()
    doc = md.read(out)
    assert doc.metadata["domain"] == "body"
    assert doc.metadata["log_type"] == "workout"
    assert doc.metadata["rpe"] == 7


def test_status_runs_against_seeded_repo(paths, capsys):
    # Seed an entry first so status has data.
    today = date.today()
    p = paths.entries_dir / f"{today.year:04d}" / f"{today.month:02d}" / f"{today.isoformat()}-evening.md"
    md.write(p, {"date": today.isoformat(), "type": "evening", "energy": 7, "sleep_hours": 7.5}, "## Wins\n\nx\n")
    conn = sqlite_mod.connect(paths.sqlite_path)
    sqlite_mod.init_db(conn, paths.schema_sql)
    sqlite_mod.upsert_entry(conn, md.read(p), paths.home)
    sqlite_mod.reindex_all(conn, paths)
    conn.close()

    from life_os.dashboards import status as status_mod
    rc = status_mod.run(paths)
    assert rc == 0
    out = capsys.readouterr().out
    assert "Active phases" in out


def test_journal_ask_dry_run(paths, monkeypatch):
    runner = CliRunner()
    monkeypatch.setenv("LIFE_OS_HOME", str(paths.home))
    result = runner.invoke(app, ["journal", "ask", "--window", "now", "--dry-run"])
    assert result.exit_code == 0, result.output
    assert "blocks" in result.output
