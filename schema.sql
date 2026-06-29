-- ============================================================================
-- LIQO — Cloudflare D1 (SQLite) schema.  Normalised, FK-enforced.
--
-- Domains:
--   0. Reference   stores, config
--   1. Inventory   inventory (hourly snapshot from BUSY/DBMS)
--   2. People      employees, attendance, leaves, milestones, incentives, feedback
--   3. Customers   customers, customer_brand_prefs, customer_events
--   4. Commerce    sessions, suggested_products, sales, sale_items, offers,
--                  demand_requests
--   5. Analytics   v_* views (store summary, demand, employee month, customer 360)
--
-- DBMS principles applied:
--   * 3NF — facts live once; analytics are VIEWS, never duplicated columns.
--   * Referential integrity — FOREIGN KEY ... ON DELETE; PRAGMA foreign_keys=ON.
--   * Domain integrity — CHECK constraints encode every enum; NOT NULL on facts.
--   * Identity — surrogate INTEGER PKs for high-churn rows, natural TEXT PKs
--     for slugs (store_id, employee_id, customer phone-id).
--   * Access paths — indexes on every FK and on real query/sort predicates.
--   * Auditability — created_at on every table; updated_at where rows mutate.
--
-- Apply:  wrangler d1 execute liqo --remote --file=./schema.sql --yes
-- (idempotent: CREATE ... IF NOT EXISTS throughout.)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- 0 · REFERENCE
-- ===========================================================================

-- stores: the store master. store_id is the slug used everywhere for routing.
CREATE TABLE IF NOT EXISTS stores (
  store_id    TEXT PRIMARY KEY,                 -- 'zirakpur'
  name        TEXT NOT NULL,                    -- 'Liqo Zirakpur'
  label       TEXT,
  address     TEXT,
  region      TEXT,                             -- 'North India'
  phone       TEXT,
  pilot       INTEGER NOT NULL DEFAULT 0 CHECK (pilot IN (0,1)),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- config: engine parameters + questionnaire as JSON docs (key = 'engine' | 'questionnaire').
CREATE TABLE IF NOT EXISTS config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,                    -- JSON
  version     TEXT,
  updated_at  TEXT NOT NULL
);

-- ===========================================================================
-- 1 · INVENTORY  (hourly snapshot; the API reads ONLY this, never BUSY live)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS inventory (
  id              TEXT PRIMARY KEY,             -- `${sku}|${store}`
  sku             TEXT NOT NULL,
  store           TEXT NOT NULL,
  store_id        TEXT NOT NULL,                -- relates to stores.store_id (snapshot, not FK-enforced: replaced wholesale hourly)
  channel         TEXT NOT NULL,                -- retail | B2B | QC | logistics
  category        TEXT NOT NULL,                -- ac | tv | fridge | wm
  category_label  TEXT,
  brand           TEXT NOT NULL,
  model           TEXT,
  name            TEXT,
  sub_category    TEXT,
  capacity_value  REAL,
  capacity_unit   TEXT,
  capacity_text   TEXT,
  star_rating     INTEGER,
  inverter        INTEGER,
  smart_os        TEXT,
  price           INTEGER NOT NULL,
  mrp             INTEGER,
  sku_margin      INTEGER NOT NULL,
  margin_pct      REAL NOT NULL,
  margin_band     TEXT,
  stock_qty       INTEGER NOT NULL DEFAULT 0,
  ageing_slab     TEXT,
  ageing_rank     INTEGER NOT NULL DEFAULT 1,
  band            TEXT NOT NULL,                -- good | better | best
  emi_eligible    INTEGER NOT NULL DEFAULT 1,
  exchange_eligible INTEGER NOT NULL DEFAULT 1,
  image           TEXT,
  tags            TEXT NOT NULL DEFAULT '[]',
  last_synced_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inv_store_cat ON inventory (store_id, category, channel);
CREATE INDEX IF NOT EXISTS idx_inv_cat_price ON inventory (category, price);
CREATE INDEX IF NOT EXISTS idx_inv_channel   ON inventory (channel);
CREATE INDEX IF NOT EXISTS idx_inv_brand     ON inventory (brand);

-- ===========================================================================
-- 2 · PEOPLE
-- ===========================================================================

-- employees: staff master (supersedes the static users.json; auth + HR root).
CREATE TABLE IF NOT EXISTS employees (
  employee_id TEXT PRIMARY KEY,                 -- 'u-s1-zk'
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,
  phone       TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin','manager','salesperson')),
  store_id    TEXT REFERENCES stores(store_id) ON DELETE SET NULL,  -- NULL = all stores (admin)
  title       TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  pass_hash   TEXT,
  joined_at   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_emp_store ON employees (store_id, role);
CREATE INDEX IF NOT EXISTS idx_emp_role  ON employees (role, status);

-- attendance: one row per employee per day.
CREATE TABLE IF NOT EXISTS attendance (
  id          INTEGER PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  store_id    TEXT REFERENCES stores(store_id) ON DELETE SET NULL,
  date        TEXT NOT NULL,                    -- 'YYYY-MM-DD'
  status      TEXT NOT NULL CHECK (status IN ('present','absent','half_day','leave','week_off','holiday')),
  check_in    TEXT,
  check_out   TEXT,
  note        TEXT,
  marked_by   TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_store_date ON attendance (store_id, date);
CREATE INDEX IF NOT EXISTS idx_att_emp_date   ON attendance (employee_id, date);

-- leaves: leave requests + approval workflow.
CREATE TABLE IF NOT EXISTS leaves (
  id          INTEGER PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('casual','sick','earned','unpaid')),
  from_date   TEXT NOT NULL,
  to_date     TEXT NOT NULL,
  days        REAL NOT NULL DEFAULT 1,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approver_id TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,
  decided_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (to_date >= from_date)
);
CREATE INDEX IF NOT EXISTS idx_leave_emp    ON leaves (employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leaves (status, from_date);

-- milestones: incentive rules (metric crosses threshold over a period -> reward).
CREATE TABLE IF NOT EXISTS milestones (
  milestone_id TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  metric       TEXT NOT NULL CHECK (metric IN ('items_per_bill','bills','reco_rate','revenue','points')),
  threshold    REAL NOT NULL,
  period       TEXT NOT NULL CHECK (period IN ('weekly','monthly','once')),
  reward_inr   INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- incentives: the money ledger. Display-only credit; payroll settles offline.
CREATE TABLE IF NOT EXISTS incentives (
  id           INTEGER PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  milestone_id TEXT REFERENCES milestones(milestone_id) ON DELETE SET NULL,
  period       TEXT NOT NULL,                   -- '2026-W26' | '2026-06'
  points       INTEGER NOT NULL DEFAULT 0,
  amount_inr   INTEGER NOT NULL DEFAULT 0,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'credited' CHECK (status IN ('pending','credited','settled','void')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_inc_emp    ON incentives (employee_id, period);
CREATE INDEX IF NOT EXISTS idx_inc_status ON incentives (status, period);

-- feedback: employee feedback + anonymous feedback (employee_id NULL when anonymous).
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY,
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,
  store_id    TEXT REFERENCES stores(store_id) ON DELETE SET NULL,
  category    TEXT NOT NULL CHECK (category IN ('store','management','product','customer','process','other')),
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  message     TEXT,
  anonymous   INTEGER NOT NULL DEFAULT 0 CHECK (anonymous IN (0,1)),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','actioned','closed')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (anonymous = 0 OR employee_id IS NULL)  -- anonymous rows never carry an employee id
);
CREATE INDEX IF NOT EXISTS idx_fb_store ON feedback (store_id, created_at);

-- ===========================================================================
-- 3 · CUSTOMERS  (DPDP: stored only with consent; erasable by phone)
-- ===========================================================================

-- customers: contact + the durable tags (premiumness, preferred payment).
CREATE TABLE IF NOT EXISTS customers (
  customer_id      TEXT PRIMARY KEY,            -- 'c-<phone10>'
  phone            TEXT NOT NULL UNIQUE,
  name             TEXT,
  email            TEXT,
  consent          INTEGER NOT NULL DEFAULT 0 CHECK (consent IN (0,1)),
  premium_tier     TEXT CHECK (premium_tier IN ('value','mainstream','premium','luxury')),
  preferred_payment TEXT CHECK (preferred_payment IN ('cash','card','emi','upi','exchange')),
  home_store_id    TEXT REFERENCES stores(store_id) ON DELETE SET NULL,
  first_seen_at    TEXT,
  last_seen_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_cust_store ON customers (home_store_id);

-- customer_brand_prefs: brand tagging, M:N, optionally per-category.
CREATE TABLE IF NOT EXISTS customer_brand_prefs (
  id          INTEGER PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  brand       TEXT NOT NULL,
  category    TEXT,                             -- NULL = applies to all categories
  affinity    TEXT NOT NULL DEFAULT 'likes' CHECK (affinity IN ('likes','owns','avoid')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (customer_id, brand, category, affinity)
);
CREATE INDEX IF NOT EXISTS idx_cbp_cust ON customer_brand_prefs (customer_id);

-- customer_events: every touchpoint (visit, intent, quote, recommendation,
-- whatsapp, call, exchange enquiry, purchase). The unified timeline.
CREATE TABLE IF NOT EXISTS customer_events (
  event_id    INTEGER PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('visit','intent','quote','recommendation','whatsapp','call','exchange_enquiry','purchase','service')),
  category    TEXT,
  brand       TEXT,
  budget_band TEXT,
  sku         TEXT,
  store_id    TEXT REFERENCES stores(store_id) ON DELETE SET NULL,
  employee_id TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,
  session_id  TEXT,                             -- soft link to sessions.session_id
  amount      INTEGER,
  meta        TEXT,                             -- JSON
  ts          TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cev_cust ON customer_events (customer_id, ts);
CREATE INDEX IF NOT EXISTS idx_cev_type ON customer_events (type, ts);

-- ===========================================================================
-- 4 · COMMERCE
-- ===========================================================================

-- sessions: one row per guided journey. Links the employee who ran it and the
-- customer it served (both optional). shown/chosen kept as JSON for the UI;
-- suggested_products normalises the same data for analytics.
CREATE TABLE IF NOT EXISTS sessions (
  session_id    TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,   -- salesperson
  customer_id   TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,   -- recalled customer
  store_id      TEXT REFERENCES stores(store_id) ON DELETE SET NULL,
  category      TEXT,
  lang          TEXT,
  answers       TEXT,                           -- JSON array of tags
  budget_band   TEXT,
  stretch       INTEGER,
  exchange      INTEGER,
  shown_cards   TEXT,                           -- JSON
  chosen        TEXT,                           -- JSON
  attach        TEXT,                           -- JSON
  outcome       TEXT CHECK (outcome IN ('bought-recommended','bought-different','still-thinking','new-customer') OR outcome IS NULL),
  total         INTEGER,
  items_per_bill REAL,
  ts            TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_store ON sessions (store_id, category);
CREATE INDEX IF NOT EXISTS idx_sessions_time  ON sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_cust  ON sessions (customer_id, created_at);

-- suggested_products: one row per card the engine showed (normalised from
-- sessions.shown_cards) — powers conversion + demand analysis per SKU/brand.
CREATE TABLE IF NOT EXISTS suggested_products (
  id          INTEGER PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  store_id    TEXT,
  category    TEXT,
  sku         TEXT,
  brand       TEXT,
  tier        TEXT CHECK (tier IN ('good','better','best','stretch','attach')),
  price       INTEGER,
  score       REAL,
  shown       INTEGER NOT NULL DEFAULT 1 CHECK (shown IN (0,1)),
  chosen      INTEGER NOT NULL DEFAULT 0 CHECK (chosen IN (0,1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sp_session ON suggested_products (session_id);
CREATE INDEX IF NOT EXISTS idx_sp_sku     ON suggested_products (sku, chosen);
CREATE INDEX IF NOT EXISTS idx_sp_brand   ON suggested_products (brand, category);

-- sales: a bill header (normalised: header here, lines in sale_items).
CREATE TABLE IF NOT EXISTS sales (
  sale_id        INTEGER PRIMARY KEY,
  bill_no        TEXT UNIQUE,
  customer_id    TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  employee_id    TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,
  store_id       TEXT REFERENCES stores(store_id) ON DELETE SET NULL,
  session_id     TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
  total          INTEGER NOT NULL DEFAULT 0,
  items_count    INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash','card','emi','upi','exchange')),
  exchange       INTEGER NOT NULL DEFAULT 0 CHECK (exchange IN (0,1)),
  source         TEXT NOT NULL DEFAULT 'assistant' CHECK (source IN ('assistant','walk_in')),
  ts             TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_store ON sales (store_id, ts);
CREATE INDEX IF NOT EXISTS idx_sales_emp   ON sales (employee_id, ts);
CREATE INDEX IF NOT EXISTS idx_sales_cust  ON sales (customer_id, ts);

-- sale_items: bill lines (1 sale -> N items). Past purchase history = join on customer.
CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER PRIMARY KEY,
  sale_id     INTEGER NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
  sku         TEXT,
  brand       TEXT,
  category    TEXT,
  qty         INTEGER NOT NULL DEFAULT 1,
  unit_price  INTEGER NOT NULL DEFAULT 0,
  line_total  INTEGER NOT NULL DEFAULT 0,
  tier        TEXT CHECK (tier IN ('good','better','best','stretch','attach') OR tier IS NULL),
  recommended INTEGER NOT NULL DEFAULT 0 CHECK (recommended IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_si_sale  ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_si_sku   ON sale_items (sku);
CREATE INDEX IF NOT EXISTS idx_si_brand ON sale_items (brand, category);

-- offers: latest offers + the admin "push a brand/offer for a day" engine boost.
CREATE TABLE IF NOT EXISTS offers (
  offer_id     TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  brand        TEXT,                            -- NULL = any
  category     TEXT,                            -- NULL = any
  sku          TEXT,                            -- NULL = any matching brand/category
  store_id     TEXT REFERENCES stores(store_id) ON DELETE CASCADE,  -- NULL = all stores
  discount_pct REAL,
  offer_price  INTEGER,
  image        TEXT,
  starts_at    TEXT NOT NULL,
  ends_at      TEXT NOT NULL,
  boost_weight REAL NOT NULL DEFAULT 0,         -- 0 = display only; >0 nudges the engine
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by   TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_offers_live ON offers (active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_offers_boost ON offers (active, boost_weight);

-- demand_requests: a customer wanted something not (well) stocked — gap signal.
CREATE TABLE IF NOT EXISTS demand_requests (
  id           INTEGER PRIMARY KEY,
  store_id     TEXT REFERENCES stores(store_id) ON DELETE SET NULL,
  customer_id  TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  employee_id  TEXT REFERENCES employees(employee_id) ON DELETE SET NULL,
  category     TEXT,
  brand        TEXT,
  sku          TEXT,
  budget_band  TEXT,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','sourced','fulfilled','dropped')),
  ts           TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dr_store ON demand_requests (store_id, category, status);

-- ===========================================================================
-- 5 · ANALYTICS VIEWS  (derive — never duplicate)
-- ===========================================================================

-- Per store per day: bills, revenue, items-per-bill, recommended share.
-- Header aggregates come from `sales` ONLY (joining lines would fan-out-multiply
-- the header sums); recommended_rate is a correlated subquery over the lines.
CREATE VIEW IF NOT EXISTS v_store_daily AS
SELECT s.store_id,
       substr(s.ts, 1, 10)                              AS day,
       COUNT(*)                                         AS bills,
       SUM(s.total)                                     AS revenue,
       SUM(s.items_count)                               AS items,
       ROUND(CAST(SUM(s.items_count) AS REAL) / NULLIF(COUNT(*),0), 2) AS items_per_bill,
       (SELECT ROUND(CAST(SUM(CASE WHEN si.recommended=1 THEN si.qty ELSE 0 END) AS REAL)
                     / NULLIF(SUM(si.qty),0), 2)
        FROM sale_items si JOIN sales s2 ON s2.sale_id = si.sale_id
        WHERE s2.store_id = s.store_id
          AND substr(s2.ts,1,10) = substr(s.ts,1,10))   AS recommended_rate
FROM sales s
GROUP BY s.store_id, day;

-- Demand by store + category: interest (suggested) vs conversion (sold).
CREATE VIEW IF NOT EXISTS v_demand_category AS
SELECT store_id, category,
       SUM(suggested) AS suggested,
       SUM(sold)      AS sold,
       ROUND(CAST(SUM(sold) AS REAL) / NULLIF(SUM(suggested),0), 2) AS conversion
FROM (
  SELECT store_id, category, COUNT(*) AS suggested, 0 AS sold
  FROM suggested_products WHERE shown=1 GROUP BY store_id, category
  UNION ALL
  SELECT store_id, category, 0 AS suggested, COUNT(*) AS sold
  FROM sale_items si JOIN sales s ON s.sale_id = si.sale_id GROUP BY s.store_id, si.category
)
GROUP BY store_id, category;

-- Per employee per month: bills, items-per-bill, reco rate, incentive total.
CREATE VIEW IF NOT EXISTS v_employee_month AS
SELECT e.employee_id, e.name, e.store_id,
       substr(s.ts,1,7)                                 AS month,
       COUNT(DISTINCT s.sale_id)                        AS bills,
       ROUND(CAST(SUM(s.items_count) AS REAL) / NULLIF(COUNT(DISTINCT s.sale_id),0), 2) AS items_per_bill,
       COALESCE((SELECT SUM(amount_inr) FROM incentives i
                 WHERE i.employee_id = e.employee_id
                   AND i.period = substr(s.ts,1,7)
                   AND i.status IN ('credited','settled')), 0) AS incentive_inr
FROM employees e
LEFT JOIN sales s ON s.employee_id = e.employee_id
WHERE e.role = 'salesperson'
GROUP BY e.employee_id, month;

-- Customer 360: rollup of the timeline for fast recall.
CREATE VIEW IF NOT EXISTS v_customer_360 AS
SELECT c.customer_id, c.phone, c.name, c.premium_tier, c.preferred_payment,
       c.home_store_id, c.last_seen_at,
       (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.customer_id)            AS purchases,
       (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id = c.customer_id) AS lifetime_value,
       (SELECT COUNT(*) FROM customer_events e WHERE e.customer_id = c.customer_id)  AS touchpoints,
       (SELECT group_concat(DISTINCT brand) FROM customer_brand_prefs b
          WHERE b.customer_id = c.customer_id AND b.affinity IN ('likes','owns'))    AS brands
FROM customers c;

-- ===========================================================================
-- MIGRATION NOTES (existing DB, run once; harmless on a fresh schema)
--   ALTER TABLE sessions ADD COLUMN user_id TEXT;
--   ALTER TABLE sessions ADD COLUMN customer_id TEXT;
-- New installs get everything above directly.
-- ===========================================================================
