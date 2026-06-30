-- LIQO — DEMO-ONLY seed data. Idempotent (INSERT OR IGNORE).
-- Applied ONLY when building the offline/demo environment (DEV_DEMO_MODE=true).
-- A LIVE deploy must NOT run this, otherwise these fictional employees and
-- sample offers would re-appear on top of your real DBMS data on every deploy.

-- Demo accounts (fictional; shared demo pass_hash). Real staff come from the
-- employees import, not from here.
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

-- Sample offers (so the offline demo's Promotions/Offers tab isn't empty).
INSERT OR IGNORE INTO offers (offer_id, title, description, brand, category, store_id, discount_pct, starts_at, ends_at, boost_weight, created_by) VALUES
 ('o-seed-lg-ac',  'LG AC — Year-end clearance', 'Flat 10% off LG inverter ACs, this week only.', 'LG',      'ac', NULL, 10, '2026-06-01', '2026-12-31', 0.25, 'u-admin'),
 ('o-seed-hyu-wm', 'Hyundai Washer + free detergent', 'Hyundai 8kg top-load at a special LIQO price.', 'Hyundai', 'wm', NULL, 41, '2026-06-01', '2026-12-31', 0.20, 'u-admin');
