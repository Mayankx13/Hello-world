-- Migration 0002 — qa_scores: manual QA sampling score, entered from the
-- dashboard's economics & quality panel via POST /api/quality.
-- One row per day; UNIQUE(day) lets re-entries upsert.

CREATE TABLE IF NOT EXISTS qa_scores (
  id         INTEGER PRIMARY KEY,
  day        TEXT UNIQUE,                    -- 'YYYY-MM-DD'
  score      REAL,                           -- 0..100
  note       TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
