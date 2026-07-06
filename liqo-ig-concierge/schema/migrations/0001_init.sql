-- ============================================================================
-- Migration 0001 — initial schema (mirror of /schema/schema.sql at v1).
-- Applied via: npm run db:migrate / db:migrate:remote (wrangler d1 migrations).
-- Future schema changes: add a NEW numbered file here AND update schema.sql —
-- never edit this file after it has been applied anywhere.
-- ============================================================================
-- liqo-ig-concierge — Cloudflare D1 (SQLite) schema
-- Database: liqo_concierge          Binding (Worker): DB
--
-- Ownership: this repo owns the schema. The n8n DM loop reads/writes these
-- same tables via the Cloudflare API — column names, types, and CHECK enums
-- are a stable contract; change them only via a new numbered migration in
-- /schema/migrations and coordinate with the n8n workflow.
--
-- Apply:   npm run db:apply          (local, wrangler d1 execute --local)
--          npm run db:apply:remote   (production D1)
-- Idempotent: CREATE ... IF NOT EXISTS throughout — safe to re-run.
--
-- Conventions:
--   * All timestamps are TEXT in UTC, 'YYYY-MM-DD HH:MM:SS' (SQLite
--     datetime('now')). The dashboard converts to IST for display.
--   * D1 enforces FOREIGN KEY constraints by default — no PRAGMA needed
--     (unsupported PRAGMAs are rejected by D1, so none are used here).
--   * Phone numbers are stored normalized to the last 10 digits (Indian
--     mobile) everywhere they are used for matching (leads, attribution).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1 · conversations — one row per DM message, both directions.
--     Written by the n8n loop after each inbound message and each reply.
--     Powers KPIs, funnel stage 1, timeseries, intents, and cost aggregation.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id             INTEGER PRIMARY KEY,
  ig_user_id     TEXT,                                      -- IG-scoped user id of the counterparty
  mid            TEXT UNIQUE,                               -- Meta message id (also the dedupe key)
  direction      TEXT    CHECK (direction IN ('in','out')), -- 'in' = customer → LIQO
  message        TEXT,                                      -- message body (never logged by the Worker; stored only here)
  intent         TEXT,                                      -- classifier label, e.g. 'price_query', 'store_info'
  confidence     REAL,                                      -- classifier confidence 0..1
  handoff        INTEGER DEFAULT 0,                         -- 1 = escalated to a human
  handoff_reason TEXT,
  model          TEXT,                                      -- e.g. 'claude-haiku-4-5'
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  created_at     TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations (created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user    ON conversations (ig_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_intent  ON conversations (intent, created_at);
-- Partial index: handoffs are a small fraction of rows but queried daily.
CREATE INDEX IF NOT EXISTS idx_conversations_handoff ON conversations (created_at) WHERE handoff = 1;


-- ----------------------------------------------------------------------------
-- 2 · leads — captured contacts; the store team's morning call-down list.
--     status lifecycle: new → called → visit_committed → visited → converted
--     (or lost at any point). Updated from the dashboard via the Worker API.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id               INTEGER PRIMARY KEY,
  ig_user_id       TEXT,
  name             TEXT,
  phone            TEXT,                    -- normalized: last 10 digits
  city             TEXT,
  product_category TEXT,                    -- 'ac' | 'tv' | 'fridge' | 'wm' | free text
  need             TEXT,                    -- what they asked for, in their words
  status           TEXT DEFAULT 'new'
                   CHECK (status IN ('new','called','visit_committed','visited','converted','lost')),
  store_hint       TEXT,                    -- nearest material centre, guessed from city
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_phone   ON leads (phone);          -- attribution phone-match
CREATE INDEX IF NOT EXISTS idx_leads_user    ON leads (ig_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);


-- ----------------------------------------------------------------------------
-- 3 · offers — current promotions the concierge is allowed to quote.
--     Edited by ops; n8n reads WHERE active = 1.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id         INTEGER PRIMARY KEY,
  title      TEXT,
  details    TEXT,
  active     INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_offers_active ON offers (active);


-- ----------------------------------------------------------------------------
-- 4 · stores — the 11 LIQO material centres. Seeded with placeholders in
--     /schema/seed.sql; addresses/hours/phones are edited by ops.
--     n8n quotes these verbatim for "where is the store" intents.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
  id       INTEGER PRIMARY KEY,
  name     TEXT,
  address  TEXT,
  city     TEXT,
  hours    TEXT,
  phone    TEXT,
  maps_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_stores_city ON stores (city);


-- ----------------------------------------------------------------------------
-- 5 · attribution — DM-attributed BUSY bills, loaded daily by
--     /scripts/import_busy_bills.py through POST /api/attribution/import.
--     bill_no is UNIQUE because the importer upserts on it. NOTE: BUSY bill
--     numbers are unique within a billing series/fiscal year — if two material
--     centres ever share a series, widen to UNIQUE(bill_no, store) in a new
--     migration.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attribution (
  id              INTEGER PRIMARY KEY,
  bill_no         TEXT UNIQUE,
  bill_date       TEXT,                     -- 'YYYY-MM-DD'
  store           TEXT,
  phone           TEXT,                     -- normalized: last 10 digits
  mention_code    TEXT,                     -- code as found in narration, e.g. 'LIQO-DM'
  bill_amount     REAL,
  items_count     INTEGER,
  matched_lead_id INTEGER REFERENCES leads(id),
  match_method    TEXT CHECK (match_method IN ('code','phone','manual')),
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attribution_date  ON attribution (bill_date);
CREATE INDEX IF NOT EXISTS idx_attribution_lead  ON attribution (matched_lead_id);
CREATE INDEX IF NOT EXISTS idx_attribution_phone ON attribution (phone);


-- ----------------------------------------------------------------------------
-- 6 · api_costs — nightly aggregation of conversations token usage.
--     One row per day (UNIQUE lets the nightly job upsert idempotently).
--     cost_inr = (input_tokens × $1/MTok + output_tokens × $5/MTok) × USD_INR.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_costs (
  id            INTEGER PRIMARY KEY,
  day           TEXT UNIQUE,               -- 'YYYY-MM-DD'
  conversations INTEGER,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_inr      REAL
);


-- ----------------------------------------------------------------------------
-- 7 · processed_messages — webhook dedupe ledger. n8n checks/inserts the Meta
--     mid here before processing so redelivered webhooks are ignored.
--     WITHOUT ROWID: the table IS its primary-key index — one lookup, no
--     rowid indirection. created_at supports purging old mids (e.g. > 30 d).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_messages (
  mid        TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_processed_created ON processed_messages (created_at);
