"""SQLite index over the markdown corpus. Always regenerable from markdown."""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any, Iterable

from . import markdown as md


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection, schema_sql: Path) -> None:
    conn.executescript(schema_sql.read_text(encoding="utf-8"))
    conn.commit()


def reset_db(conn: sqlite3.Connection) -> None:
    """Drop everything (used by reindex)."""
    cur = conn.cursor()
    cur.executescript(
        """
        DROP TABLE IF EXISTS entry_links;
        DROP TABLE IF EXISTS log_links;
        DROP TABLE IF EXISTS tags;
        DROP TABLE IF EXISTS entries;
        DROP TABLE IF EXISTS logs;
        DROP TABLE IF EXISTS roadmap_items;
        """
    )
    conn.commit()


def upsert_entry(conn: sqlite3.Connection, doc: md.MarkdownDoc, repo_root: Path) -> int:
    metadata = doc.metadata or {}
    rel_path = str(doc.path.relative_to(repo_root)).replace("\\", "/")
    kind = metadata.get("type") or metadata.get("kind") or "evening"
    entry_date = str(metadata.get("date") or date.today().isoformat())
    energy = metadata.get("energy")
    sleep = metadata.get("sleep_hours")
    title = doc.title()
    body = doc.body

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO entries (path, kind, date, energy, sleep_hours, title, body, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(path) DO UPDATE SET
            kind=excluded.kind,
            date=excluded.date,
            energy=excluded.energy,
            sleep_hours=excluded.sleep_hours,
            title=excluded.title,
            body=excluded.body,
            metadata=excluded.metadata,
            updated_at=datetime('now')
        """,
        (rel_path, kind, entry_date, energy, sleep, title, body, json.dumps(metadata, default=str)),
    )
    cur.execute("SELECT id FROM entries WHERE path = ?", (rel_path,))
    entry_id = cur.fetchone()["id"]

    cur.execute("DELETE FROM entry_links WHERE entry_id = ?", (entry_id,))
    for link in metadata.get("links", []) or []:
        cur.execute(
            "INSERT OR IGNORE INTO entry_links (entry_id, item_id) VALUES (?, ?)",
            (entry_id, str(link)),
        )

    cur.execute("DELETE FROM tags WHERE object_kind='entry' AND object_id=?", (entry_id,))
    for tag in metadata.get("tags", []) or []:
        cur.execute(
            "INSERT OR IGNORE INTO tags (object_kind, object_id, tag) VALUES ('entry', ?, ?)",
            (entry_id, str(tag)),
        )

    conn.commit()
    return entry_id


def upsert_log(conn: sqlite3.Connection, doc: md.MarkdownDoc, domain: str, repo_root: Path) -> int:
    metadata = doc.metadata or {}
    rel_path = str(doc.path.relative_to(repo_root)).replace("\\", "/")
    log_date = str(metadata.get("date") or date.today().isoformat())
    log_type = metadata.get("log_type") or metadata.get("type") or "note"

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO logs (path, domain, date, log_type, payload, body)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
            domain=excluded.domain,
            date=excluded.date,
            log_type=excluded.log_type,
            payload=excluded.payload,
            body=excluded.body
        """,
        (rel_path, domain, log_date, log_type, json.dumps(metadata, default=str), doc.body),
    )
    cur.execute("SELECT id FROM logs WHERE path = ?", (rel_path,))
    log_id = cur.fetchone()["id"]
    conn.commit()
    return log_id


def upsert_roadmap_doc(conn: sqlite3.Connection, doc: md.MarkdownDoc, repo_root: Path) -> int:
    """Parse phase headings out of a roadmap file and upsert each phase as an item."""
    domain = doc.metadata.get("domain") or doc.path.stem
    rel_path = str(doc.path.relative_to(repo_root)).replace("\\", "/")
    phases = md.iter_roadmap_phases(doc)
    cur = conn.cursor()
    cur.execute("DELETE FROM roadmap_items WHERE file_path = ?", (rel_path,))
    for phase in phases:
        title = phase["title"]
        fields = phase["fields"]
        # Skip non-phase sections like "Standing rules" that have no structured fields.
        if not fields and not phase["dod"]:
            continue
        slug = f"{domain}-{_slugify(title)}"[:120]
        cur.execute(
            """
            INSERT OR REPLACE INTO roadmap_items
                (id, domain, phase, title, start_date, due_date, status, dod, file_path, line_number, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                slug,
                domain,
                title.split(":", 1)[0].strip() if ":" in title else title,
                title,
                fields.get("start"),
                fields.get("due"),
                fields.get("status", "planned"),
                "\n".join(phase["dod"]) if phase["dod"] else None,
                rel_path,
                phase["line_number"],
                "\n".join(phase["body_lines"]).strip() or None,
            ),
        )
    conn.commit()
    return len(phases)


def reindex_all(conn: sqlite3.Connection, paths) -> dict[str, int]:
    """Walk markdown and rebuild all tables. `paths` is a Paths from config."""
    counts = {"entries": 0, "logs": 0, "roadmap_phases": 0}
    repo = paths.home

    if paths.entries_dir.exists():
        for md_path in sorted(paths.entries_dir.rglob("*.md")):
            upsert_entry(conn, md.read(md_path), repo)
            counts["entries"] += 1

    if paths.logs_dir.exists():
        for domain_dir in sorted(p for p in paths.logs_dir.iterdir() if p.is_dir()):
            for md_path in sorted(domain_dir.rglob("*.md")):
                upsert_log(conn, md.read(md_path), domain_dir.name, repo)
                counts["logs"] += 1

    if paths.roadmap_dir.exists():
        for md_path in sorted(paths.roadmap_dir.glob("*.md")):
            if md_path.name in {"weekly-review-template.md", "dependencies.md"}:
                continue
            counts["roadmap_phases"] += upsert_roadmap_doc(conn, md.read(md_path), repo)

    return counts


def fetch_recent_entries(conn: sqlite3.Connection, days: int) -> list[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM entries
        WHERE date >= date('now', ?)
        ORDER BY date DESC, id DESC
        """,
        (f"-{days} days",),
    )
    return cur.fetchall()


def fetch_active_phases(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM roadmap_items
        WHERE status IN ('active','planned')
        ORDER BY domain, COALESCE(due_date, '9999-12-31'), phase
        """
    )
    return cur.fetchall()


def fetch_overdue_items(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM roadmap_items
        WHERE status != 'done'
          AND due_date IS NOT NULL
          AND due_date < date('now')
        ORDER BY due_date ASC
        """
    )
    return cur.fetchall()


def fetch_recent_logs(conn: sqlite3.Connection, days: int) -> list[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM logs
        WHERE date >= date('now', ?)
        ORDER BY date DESC, id DESC
        """,
        (f"-{days} days",),
    )
    return cur.fetchall()


def domain_last_entry_dates(conn: sqlite3.Connection) -> dict[str, str]:
    """Most-recent entry/log date per domain (via tags or log domain)."""
    out: dict[str, str] = {}
    cur = conn.cursor()
    cur.execute("SELECT domain, MAX(date) AS d FROM logs GROUP BY domain")
    for row in cur.fetchall():
        out[row["domain"]] = row["d"]
    return out
