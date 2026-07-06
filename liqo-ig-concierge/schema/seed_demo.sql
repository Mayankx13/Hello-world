-- ============================================================================
-- DEMO data — a coherent 14-day story for dashboard demos and the KPI smoke
-- test. LOCAL / STAGING ONLY: never apply to the production database
-- (npm run db:demo applies it locally). Idempotent via INSERT OR IGNORE on
-- fixed mids/ids; dates are relative to now so the window queries always see
-- them.
--
-- The story: 12 Instagram users DM over two weeks → 6 leads → 4 visit
-- commitments → 3 visits → 2 conversions → 3 attributed bills.
-- ============================================================================

INSERT OR IGNORE INTO conversations (ig_user_id, mid, direction, message, intent, confidence, handoff, handoff_reason, model, input_tokens, output_tokens, created_at) VALUES
 -- d1: price query, answered fast, becomes lead + converts
 ('demo_u01','demo.u01.1','in','price of 1.5 ton inverter AC?','price_query',0.95,0,NULL,NULL,NULL,NULL, datetime('now','-13 days')),
 ('demo_u01','demo.u01.2','out','Our 1.5T inverter ACs start at ₹28,990...',NULL,NULL,0,NULL,'claude-haiku-4-5',840,150, datetime('now','-13 days','+45 seconds')),
 ('demo_u01','demo.u01.3','in','sounds good, panchkula store?','store_info',0.96,0,NULL,NULL,NULL,NULL, datetime('now','-13 days','+4 minutes')),
 ('demo_u01','demo.u01.4','out','SCO 384, Sector 20 Panchkula — open 10:30–20:30.',NULL,NULL,0,NULL,'claude-haiku-4-5',910,130, datetime('now','-13 days','+5 minutes')),
 -- d2: TV exchange offer, becomes lead, visits, converts
 ('demo_u02','demo.u02.1','in','any exchange offer on 55 inch TV?','offer_query',0.92,0,NULL,NULL,NULL,NULL, datetime('now','-12 days')),
 ('demo_u02','demo.u02.2','out','Yes — extra ₹2,000 off on exchange. Quote LIQO-DM at billing.',NULL,NULL,0,NULL,'claude-haiku-4-5',790,170, datetime('now','-12 days','+70 seconds')),
 -- d3: complaint → handoff
 ('demo_u03','demo.u03.1','in','fridge I bought last month is not cooling','complaint',0.89,0,NULL,NULL,NULL,NULL, datetime('now','-11 days')),
 ('demo_u03','demo.u03.2','out','Sorry to hear that — connecting you to our service team now.',NULL,NULL,1,'warranty complaint','claude-haiku-4-5',720,95, datetime('now','-11 days','+2 minutes')),
 -- d4: WM lead, called, visit committed
 ('demo_u04','demo.u04.1','in','best front load washing machine under 25k?','price_query',0.94,0,NULL,NULL,NULL,NULL, datetime('now','-10 days')),
 ('demo_u04','demo.u04.2','out','Great picks under ₹25k from IFB and Godrej...',NULL,NULL,0,NULL,'claude-haiku-4-5',860,180, datetime('now','-10 days','+55 seconds')),
 -- d5: store hours
 ('demo_u05','demo.u05.1','in','zirakpur store open on sunday?','store_info',0.97,0,NULL,NULL,NULL,NULL, datetime('now','-9 days')),
 ('demo_u05','demo.u05.2','out','Yes, all days 10:30–20:30.',NULL,NULL,0,NULL,'claude-haiku-4-5',680,60, datetime('now','-9 days','+30 seconds')),
 -- d6: price query, slow answer (over 2 min)
 ('demo_u06','demo.u06.1','in','tcl 65 inch price','price_query',0.93,0,NULL,NULL,NULL,NULL, datetime('now','-8 days')),
 ('demo_u06','demo.u06.2','out','TCL 65" starts at ₹42,990 with us.',NULL,NULL,0,NULL,'claude-haiku-4-5',750,110, datetime('now','-8 days','+9 minutes')),
 -- d7: AC lead, visit committed, visited
 ('demo_u07','demo.u07.1','in','need 2 ACs for new flat in kharar','price_query',0.9,0,NULL,NULL,NULL,NULL, datetime('now','-7 days')),
 ('demo_u07','demo.u07.2','out','Nice! For two rooms I''d suggest...',NULL,NULL,0,NULL,'claude-haiku-4-5',880,190, datetime('now','-7 days','+80 seconds')),
 -- d8: offer query
 ('demo_u08','demo.u08.1','in','diwali offers started?','offer_query',0.91,0,NULL,NULL,NULL,NULL, datetime('now','-6 days')),
 ('demo_u08','demo.u08.2','out','Festive offers go live next week — want a ping?',NULL,NULL,0,NULL,'claude-haiku-4-5',700,120, datetime('now','-6 days','+50 seconds')),
 -- d9: human ask → handoff
 ('demo_u09','demo.u09.1','in','can I talk to a real person about bulk order','human_request',0.85,0,NULL,NULL,NULL,NULL, datetime('now','-5 days')),
 ('demo_u09','demo.u09.2','out','Of course — our team will DM you shortly.',NULL,NULL,1,'bulk order / human requested','claude-haiku-4-5',690,80, datetime('now','-5 days','+90 seconds')),
 -- d10: fridge lead, called
 ('demo_u10','demo.u10.1','in','double door fridge under 30k with warranty','price_query',0.94,0,NULL,NULL,NULL,NULL, datetime('now','-4 days')),
 ('demo_u10','demo.u10.2','out','Solid options under ₹30k from Haier and Godrej...',NULL,NULL,0,NULL,'claude-haiku-4-5',830,175, datetime('now','-4 days','+65 seconds')),
 -- d11: availability
 ('demo_u11','demo.u11.1','in','iphone bhi milta hai kya?','availability',0.87,0,NULL,NULL,NULL,NULL, datetime('now','-2 days')),
 ('demo_u11','demo.u11.2','out','We focus on TVs, ACs, fridges & washing machines...',NULL,NULL,0,NULL,'claude-haiku-4-5',710,105, datetime('now','-2 days','+40 seconds')),
 -- d12: unanswered inbound from >24h ago → one missed 24h window
 ('demo_u12','demo.u12.1','in','solan me store kahan hai','store_info',0.9,0,NULL,NULL,NULL,NULL, datetime('now','-3 days'));

-- fixed high ids (9001+) so re-runs are no-ops and demo rows never collide
-- with real lead ids
INSERT OR IGNORE INTO leads (id, ig_user_id, name, phone, city, product_category, need, status, store_hint, created_at, updated_at) VALUES
 (9001,'demo_u01','Aarav','9810011001','Panchkula','ac','1.5T inverter AC','converted','LIQO Panchkula', datetime('now','-13 days'), datetime('now','-9 days')),
 (9002,'demo_u02','Meher','9810011002','Zirakpur','tv','55" TV on exchange','converted','LIQO Zirakpur', datetime('now','-12 days'), datetime('now','-8 days')),
 (9003,'demo_u04','Gurpreet','9810011004','Chandigarh','wm','front load under 25k','visit_committed','LIQO Chandigarh', datetime('now','-10 days'), datetime('now','-6 days')),
 (9004,'demo_u07','Nisha','9810011007','Kharar','ac','2 ACs for new flat','visited','LIQO Kharar', datetime('now','-7 days'), datetime('now','-3 days')),
 (9005,'demo_u10','Vikram','9810011010','Panchkula','fridge','double door under 30k','called','LIQO Panchkula', datetime('now','-4 days'), datetime('now','-2 days')),
 (9006,'demo_u11','Sana','9810011011','Solan','other','asked about phones','new',NULL, datetime('now','-2 days'), datetime('now','-2 days'));

INSERT OR IGNORE INTO attribution (bill_no, bill_date, store, phone, mention_code, bill_amount, items_count, matched_lead_id, match_method) VALUES
 ('DEMO/PK/501', date('now','-9 days'), 'LIQO Panchkula', '9810011001', 'LIQO-DM', 30490, 2,
   (SELECT id FROM leads WHERE phone='9810011001'), 'code'),
 ('DEMO/ZK/731', date('now','-8 days'), 'LIQO Zirakpur', '9810011002', NULL, 46990, 2,
   (SELECT id FROM leads WHERE phone='9810011002'), 'phone'),
 ('DEMO/PK/540', date('now','-2 days'), 'LIQO Panchkula', NULL, 'LIQODM', 18999, 1, NULL, 'code');

INSERT OR IGNORE INTO qa_scores (day, score, note) VALUES
 (date('now','-7 days'), 91, 'demo: weekly sample of 20 conversations');
