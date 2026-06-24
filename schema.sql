-- LIQO Sales Assistant — Cloudflare D1 (SQLite) schema.
-- Three tables: inventory (current snapshot), config (engine parameters),
-- sessions (outcome logs for weekly tuning).
--
-- Apply:  wrangler d1 execute liqo --file=./schema.sql
-- (add --remote to run against the deployed D1 instead of local.)

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- inventory: current snapshot, refreshed hourly by the Sync Worker.
-- One row per (sku, store). The API reads ONLY this table — never BUSY live.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id              TEXT PRIMARY KEY,          -- `${sku}|${store}`
  sku             TEXT NOT NULL,
  store           TEXT NOT NULL,
  store_id        TEXT NOT NULL,             -- slug for routing
  channel         TEXT NOT NULL,             -- retail | B2B | QC | logistics
  category        TEXT NOT NULL,             -- ac | tv | fridge | wm
  category_label  TEXT,
  brand           TEXT NOT NULL,
  model           TEXT,
  name            TEXT,
  sub_category    TEXT,
  capacity_value  REAL,
  capacity_unit   TEXT,
  capacity_text   TEXT,
  star_rating     INTEGER,
  inverter        INTEGER,                   -- 0/1/null
  smart_os        TEXT,
  price           INTEGER NOT NULL,          -- unit price, Rs, GST-inclusive
  mrp             INTEGER,
  sku_margin      INTEGER NOT NULL,          -- unit margin, Rs
  margin_pct      REAL NOT NULL,             -- 0..1
  margin_band     TEXT,
  stock_qty       INTEGER NOT NULL DEFAULT 0,
  ageing_slab     TEXT,
  ageing_rank     INTEGER NOT NULL DEFAULT 1,-- 1 newest .. 6 oldest
  band            TEXT NOT NULL,             -- good | better | best
  emi_eligible    INTEGER NOT NULL DEFAULT 1,
  exchange_eligible INTEGER NOT NULL DEFAULT 1,
  image           TEXT,
  tags            TEXT NOT NULL DEFAULT '[]',-- JSON array
  last_synced_at  TEXT NOT NULL              -- ISO timestamp
);

CREATE INDEX IF NOT EXISTS idx_inv_store_cat   ON inventory (store_id, category, channel);
CREATE INDEX IF NOT EXISTS idx_inv_cat_price   ON inventory (category, price);
CREATE INDEX IF NOT EXISTS idx_inv_channel     ON inventory (channel);

-- ---------------------------------------------------------------------------
-- config: engine parameters as a single JSON document (key = 'engine').
-- Editing this row changes recommendation behaviour live — NO redeploy.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config (
  key         TEXT PRIMARY KEY,              -- 'engine'
  value       TEXT NOT NULL,                 -- JSON
  version     TEXT,
  updated_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- sessions: one row per completed (or abandoned) customer journey.
-- Feeds weekly tuning and the future ML-learned ranking weights.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id    TEXT PRIMARY KEY,
  user_id       TEXT,                        -- salesperson who ran the journey (gamification)
  store_id      TEXT,
  category      TEXT,
  lang          TEXT,
  answers       TEXT,                        -- JSON array of tags
  budget_band   TEXT,
  stretch       INTEGER,
  exchange      INTEGER,
  shown_cards   TEXT,                        -- JSON (good/better/best/stretch skus)
  chosen        TEXT,                        -- JSON (chosen sku + tier)
  attach        TEXT,                        -- JSON array of attach ids
  outcome       TEXT,                        -- bought-recommended | bought-different | still-thinking
  total         INTEGER,
  items_per_bill REAL,                       -- e.g. 1.4 (fractional — REAL affinity)
  ts            TEXT,                        -- client timestamp
  created_at    TEXT NOT NULL                -- server insert time
);

CREATE INDEX IF NOT EXISTS idx_sessions_store ON sessions (store_id, category);
CREATE INDEX IF NOT EXISTS idx_sessions_time  ON sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions (user_id, created_at);

-- Migration for an existing DB (run once; harmless to skip on a fresh schema):
--   ALTER TABLE sessions ADD COLUMN user_id TEXT;
