-- LIQO — reference/seed data. Idempotent (INSERT OR IGNORE).
-- Applied after schema.sql on deploy so a fresh D1 is immediately usable.
-- ONLY real reference data lives here (stores + default milestones) so a live
-- deploy never re-injects fake rows over your actual DBMS data. Demo accounts
-- and sample offers live in seed-demo.sql (applied only in DEV_DEMO_MODE).
-- Inventory is NOT seeded here — the Sync Worker loads it from BUSY/DBMS.

-- Stores (real Liqo locations; zirakpur + panchkula are the pilot sites).
INSERT OR IGNORE INTO stores (store_id, name, label, address, region, pilot) VALUES
 ('zirakpur',  'Liqo Zirakpur',  'Liqo Zirakpur (B2C)',  '1st Floor, SS Infinity Business Center, Zirakpur', 'North India', 1),
 ('panchkula', 'Liqo Panchkula', 'Liqo Panchkula (B2C)', 'SCO 384, Sector 20, Panchkula',                   'North India', 1),
 ('chandigarh','Liqo Chandigarh','Liqo Chandigarh (B2C)','SCO 313-314, Sector 35B, Chandigarh',             'North India', 0),
 ('kharar',    'Liqo Kharar',    'Liqo Kharar (B2C)',    'SCO 45-46A, City Heart Market, Kharar',           'North India', 0),
 ('pinjore',   'Liqo Pinjore',   'Liqo Pinjore (B2C)',   'Chandigarh-Kalka Road, Pinjore',                  'North India', 0),
 ('solan',     'Liqo Solan',     'Liqo Solan (B2C)',     'Amolak Towers, Lawi Khurd, Solan',                'North India', 0);

-- Incentive milestones (admin-tunable later from the dashboard). These are
-- configuration defaults, not sample data — every store needs targets to chase.
INSERT OR IGNORE INTO milestones (milestone_id, name, metric, threshold, period, reward_inr) VALUES
 ('m-ipb-w',   'Items/bill 1.5+ (weekly)',     'items_per_bill', 1.5,  'weekly',  500),
 ('m-reco-w',  'Bought-recommended 70%+ (wk)', 'reco_rate',      0.70, 'weekly',  400),
 ('m-bills-m', '80+ bills (monthly)',          'bills',          80,   'monthly', 2000),
 ('m-rev-m',   'Revenue 20L+ (monthly)',       'revenue',        2000000, 'monthly', 3000);
