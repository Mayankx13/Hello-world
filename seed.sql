-- LIQO — reference/seed data. Idempotent (INSERT OR IGNORE).
-- Applied after schema.sql on deploy so a fresh D1 is immediately usable.
-- Inventory is NOT seeded here — the Sync Worker loads it from BUSY/DBMS.

-- Stores (real Liqo locations; zirakpur + panchkula are the pilot sites).
INSERT OR IGNORE INTO stores (store_id, name, label, address, region, pilot) VALUES
 ('zirakpur',  'Liqo Zirakpur',  'Liqo Zirakpur (B2C)',  '1st Floor, SS Infinity Business Center, Zirakpur', 'North India', 1),
 ('panchkula', 'Liqo Panchkula', 'Liqo Panchkula (B2C)', 'SCO 384, Sector 20, Panchkula',                   'North India', 1),
 ('chandigarh','Liqo Chandigarh','Liqo Chandigarh (B2C)','SCO 313-314, Sector 35B, Chandigarh',             'North India', 0),
 ('kharar',    'Liqo Kharar',    'Liqo Kharar (B2C)',    'SCO 45-46A, City Heart Market, Kharar',           'North India', 0),
 ('pinjore',   'Liqo Pinjore',   'Liqo Pinjore (B2C)',   'Chandigarh-Kalka Road, Pinjore',                  'North India', 0),
 ('solan',     'Liqo Solan',     'Liqo Solan (B2C)',     'Amolak Towers, Lawi Khurd, Solan',                'North India', 0);

-- Employees (mirrors the demo accounts; pass_hash is the shared demo hash).
INSERT OR IGNORE INTO employees (employee_id, name, email, role, store_id, title, pass_hash) VALUES
 ('u-admin',  'Aarav Mehta',  'admin@liqo.in',                'admin',       NULL,        'Admin / CXO',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-mgr-zk', 'Ritu Sharma',  'manager.zirakpur@liqo.in',     'manager',     'zirakpur',  'Store Manager', '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-mgr-pk', 'Vikram Singh', 'manager.panchkula@liqo.in',    'manager',     'panchkula', 'Store Manager', '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-s1-zk',  'Simran Kaur',  'sales1.zirakpur@liqo.in',      'salesperson', 'zirakpur',  'Salesperson',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-s2-zk',  'Rohit Verma',  'sales2.zirakpur@liqo.in',      'salesperson', 'zirakpur',  'Salesperson',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-s3-zk',  'Neha Gupta',   'sales3.zirakpur@liqo.in',      'salesperson', 'zirakpur',  'Salesperson',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-s1-pk',  'Arjun Rana',   'sales1.panchkula@liqo.in',     'salesperson', 'panchkula', 'Salesperson',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-s2-pk',  'Pooja Mehta',  'sales2.panchkula@liqo.in',     'salesperson', 'panchkula', 'Salesperson',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-s1-ch',  'Karan Bedi',   'sales1.chandigarh@liqo.in',    'salesperson', 'chandigarh','Salesperson',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299'),
 ('u-s2-ch',  'Anjali Rao',   'sales2.chandigarh@liqo.in',    'salesperson', 'chandigarh','Salesperson',   '6bcd2fd8c9480a93ace5f9cf90ee38c122290d71e9fc0f163f8fb047eb75a299');

-- Incentive milestones (admin-tunable later from the dashboard).
INSERT OR IGNORE INTO milestones (milestone_id, name, metric, threshold, period, reward_inr) VALUES
 ('m-ipb-w',   'Items/bill 1.5+ (weekly)',     'items_per_bill', 1.5,  'weekly',  500),
 ('m-reco-w',  'Bought-recommended 70%+ (wk)', 'reco_rate',      0.70, 'weekly',  400),
 ('m-bills-m', '80+ bills (monthly)',          'bills',          80,   'monthly', 2000),
 ('m-rev-m',   'Revenue 20L+ (monthly)',       'revenue',        2000000, 'monthly', 3000);

-- A couple of live sample offers (the admin "offer of the day" can add more).
INSERT OR IGNORE INTO offers (offer_id, title, description, brand, category, store_id, discount_pct, starts_at, ends_at, boost_weight, created_by) VALUES
 ('o-seed-lg-ac',  'LG AC — Year-end clearance', 'Flat 10% off LG inverter ACs, this week only.', 'LG',      'ac', NULL, 10, '2026-06-01', '2026-12-31', 0.25, 'u-admin'),
 ('o-seed-hyu-wm', 'Hyundai Washer + free detergent', 'Hyundai 8kg top-load at a special LIQO price.', 'Hyundai', 'wm', NULL, 41, '2026-06-01', '2026-12-31', 0.20, 'u-admin');
