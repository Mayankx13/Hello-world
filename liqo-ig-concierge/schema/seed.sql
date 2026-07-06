-- ============================================================================
-- liqo-ig-concierge — reference seed data. Idempotent (INSERT OR IGNORE with
-- fixed ids) — re-running never duplicates rows and never overwrites edits
-- made after the first apply. Applied automatically by npm run db:apply.
--
-- Stores: the 11 LIQO material centres. Rows 1–7 carry the addresses already
-- on file; rows 8–11 are blank slots. All hours/phone/maps_url values marked
-- "EDIT:" are placeholders for ops to replace (dashboard or direct SQL).
-- ============================================================================

INSERT OR IGNORE INTO stores (id, name, address, city, hours, phone, maps_url) VALUES
 ( 1, 'LIQO Zirakpur',   '1st Floor, SS Infinity Business Center, Zirakpur', 'Zirakpur',   'EDIT: 10:30-20:30, all days', 'EDIT: phone', 'https://maps.google.com/?q=LIQO+Zirakpur'),
 ( 2, 'LIQO Panchkula',  'SCO 384, Sector 20, Panchkula',                    'Panchkula',  'EDIT: 10:30-20:30, all days', 'EDIT: phone', 'https://maps.google.com/?q=LIQO+Panchkula'),
 ( 3, 'LIQO Chandigarh', 'SCO 313-314, Sector 35B, Chandigarh',              'Chandigarh', 'EDIT: 10:30-20:30, all days', 'EDIT: phone', 'https://maps.google.com/?q=LIQO+Chandigarh'),
 ( 4, 'LIQO Kharar',     'SCO 45-46A, City Heart Market, Kharar',            'Kharar',     'EDIT: 10:30-20:30, all days', 'EDIT: phone', 'https://maps.google.com/?q=LIQO+Kharar'),
 ( 5, 'LIQO Pinjore',    'Chandigarh-Kalka Road, Pinjore',                   'Pinjore',    'EDIT: 10:30-20:30, all days', 'EDIT: phone', 'https://maps.google.com/?q=LIQO+Pinjore'),
 ( 6, 'LIQO Solan',      'Amolak Towers, Lawi Khurd, Solan',                 'Solan',      'EDIT: 10:30-20:30, all days', 'EDIT: phone', 'https://maps.google.com/?q=LIQO+Solan'),
 ( 7, 'LIQO Ramgarh',    'EDIT: address, Ramgarh (HP)',                      'Ramgarh',    'EDIT: 10:30-20:30, all days', 'EDIT: phone', 'https://maps.google.com/?q=LIQO+Ramgarh'),
 ( 8, 'EDIT: LIQO Material Centre 8',  'EDIT: address', 'EDIT: city', 'EDIT: hours', 'EDIT: phone', 'EDIT: maps url'),
 ( 9, 'EDIT: LIQO Material Centre 9',  'EDIT: address', 'EDIT: city', 'EDIT: hours', 'EDIT: phone', 'EDIT: maps url'),
 (10, 'EDIT: LIQO Material Centre 10', 'EDIT: address', 'EDIT: city', 'EDIT: hours', 'EDIT: phone', 'EDIT: maps url'),
 (11, 'EDIT: LIQO Material Centre 11', 'EDIT: address', 'EDIT: city', 'EDIT: hours', 'EDIT: phone', 'EDIT: maps url');

-- One sample offer so the concierge and dashboard have something to show.
INSERT OR IGNORE INTO offers (id, title, details, active) VALUES
 (1, 'Sample: DM-exclusive exchange bonus',
    'EDIT ME — extra Rs 2,000 off on exchange of any old AC / TV / fridge / washing machine. In-store only; quote code LIQO-DM at billing.',
    1);
