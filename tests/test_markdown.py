from __future__ import annotations

from pathlib import Path

from life_os.storage import markdown as md


def test_write_then_read_roundtrip(tmp_path: Path):
    target = tmp_path / "entry.md"
    metadata = {"date": "2026-05-09", "type": "evening", "energy": 7, "sleep_hours": 7.5, "tags": ["body", "sleep"]}
    body = "## Wins\n\nHit upper-day volume.\n\n## Lesson\n\nDon't skip warmups."
    md.write(target, metadata, body)
    doc = md.read(target)
    assert doc.metadata["date"] == "2026-05-09"
    assert doc.metadata["energy"] == 7
    assert doc.metadata["tags"] == ["body", "sleep"]
    assert "Hit upper-day volume." in doc.body


def test_phase_parsing(tmp_path: Path):
    body = """\
# Body — Roadmap

## Phase 1: Deload (May 9 – May 22, 2026)
- start: 2026-05-09
- due: 2026-05-22
- status: active
- dod:
  - First DOD line
  - Second DOD line

Some notes here.

## Phase 2: Build (May 23 onward)
- start: 2026-05-23
- status: planned
"""
    target = tmp_path / "body.md"
    md.write(target, {"domain": "body"}, body)
    doc = md.read(target)
    phases = md.iter_roadmap_phases(doc)
    assert len(phases) == 2
    p1 = phases[0]
    assert p1["fields"]["start"] == "2026-05-09"
    assert p1["fields"]["status"] == "active"
    assert p1["dod"] == ["First DOD line", "Second DOD line"]
    p2 = phases[1]
    assert p2["fields"]["status"] == "planned"
