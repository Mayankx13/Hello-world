-- Life OS — SQLite index schema. Regenerable from markdown.
-- This file is the canonical schema. Apply via storage/sqlite.py:init_db().

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    path         TEXT NOT NULL UNIQUE,
    kind         TEXT NOT NULL,           -- 'evening' | 'weekly'
    date         TEXT NOT NULL,           -- ISO YYYY-MM-DD
    energy       INTEGER,
    sleep_hours  REAL,
    title        TEXT,
    body         TEXT NOT NULL,
    metadata     TEXT NOT NULL,           -- JSON of full frontmatter
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_kind ON entries(kind);

CREATE TABLE IF NOT EXISTS logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    path         TEXT NOT NULL UNIQUE,
    domain       TEXT NOT NULL,
    date         TEXT NOT NULL,
    log_type     TEXT NOT NULL,           -- workout | meal | lead | application | ...
    payload      TEXT NOT NULL,           -- JSON of frontmatter
    body         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_domain ON logs(domain);
CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);

CREATE TABLE IF NOT EXISTS roadmap_items (
    id              TEXT PRIMARY KEY,            -- stable slug, e.g. body-p2-stable-build
    domain          TEXT NOT NULL,
    phase           TEXT NOT NULL,
    title           TEXT NOT NULL,
    start_date      TEXT,
    due_date        TEXT,
    status          TEXT NOT NULL DEFAULT 'planned',  -- planned | active | done | skipped
    dod             TEXT,                        -- newline-separated DOD items
    file_path       TEXT NOT NULL,
    line_number     INTEGER,
    notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_roadmap_domain ON roadmap_items(domain);
CREATE INDEX IF NOT EXISTS idx_roadmap_due ON roadmap_items(due_date);
CREATE INDEX IF NOT EXISTS idx_roadmap_status ON roadmap_items(status);

CREATE TABLE IF NOT EXISTS entry_links (
    entry_id  INTEGER NOT NULL,
    item_id   TEXT NOT NULL,
    PRIMARY KEY (entry_id, item_id),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS log_links (
    log_id   INTEGER NOT NULL,
    item_id  TEXT NOT NULL,
    PRIMARY KEY (log_id, item_id),
    FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    object_kind  TEXT NOT NULL,    -- 'entry' | 'log'
    object_id    INTEGER NOT NULL,
    tag          TEXT NOT NULL,
    PRIMARY KEY (object_kind, object_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);

-- FTS deferred to v1.1; the LLM corpus path uses raw markdown directly.
