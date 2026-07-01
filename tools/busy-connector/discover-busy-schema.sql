-- ===========================================================================
-- BUSY (MS SQL Server) schema discovery — run these once in SSMS (or sqlcmd)
-- against your BUSY server, and share the results so we can pin down the exact
-- item-wise-stock query + column names for the connector's config.json.
-- All are READ-ONLY.
-- ===========================================================================

-- 1) Which databases exist? (find your BUSY *company* DB, then USE it below.)
SELECT name FROM sys.databases ORDER BY name;
GO

-- >>> USE [YOUR_BUSY_COMPANY_DB];   -- uncomment + set, then run the rest
GO

-- 2) All base tables.
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
GO

-- 3) Views (BUSY sometimes exposes stock/report data as views).
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_NAME;
GO

-- 4) Columns that look like item / stock / price / brand / location — this is
--    the map to the LIQO fields (sku, category, brand, store, price, mrp, qty).
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE '%Item%'  OR COLUMN_NAME LIKE '%Stock%' OR COLUMN_NAME LIKE '%Qty%'
   OR COLUMN_NAME LIKE '%MRP%'   OR COLUMN_NAME LIKE '%Price%' OR COLUMN_NAME LIKE '%Rate%'
   OR COLUMN_NAME LIKE '%Brand%' OR COLUMN_NAME LIKE '%Company%' OR COLUMN_NAME LIKE '%Group%'
   OR COLUMN_NAME LIKE '%Categ%' OR COLUMN_NAME LIKE '%Location%' OR COLUMN_NAME LIKE '%Branch%'
   OR COLUMN_NAME LIKE '%Godown%' OR COLUMN_NAME LIKE '%Center%' OR COLUMN_NAME LIKE '%Centre%'
ORDER BY TABLE_NAME, COLUMN_NAME;
GO

-- 5) BUSY keeps masters (items, groups, brands) in Master1 — peek at the shape.
--    (If Master1 doesn't exist on your version, use the table names from step 2.)
SELECT TOP 25 * FROM Master1;
GO

-- 6) If step 2/3 revealed a stock summary table or view (e.g. ItemStock,
--    StockSummary, vwStockStatus…), sample it so we can read closing qty + price:
-- SELECT TOP 25 * FROM <StockTableOrView>;
-- GO

-- ---------------------------------------------------------------------------
-- FASTEST PATH: your BUSY dealer/support already has the "Item-wise Stock with
-- Sale Price, MRP, Brand, Category, Location" report query — ask them for the
-- underlying SQL and paste it into config.json -> sql.query. It just needs to
-- return one row per SKU per store with those columns.
-- ---------------------------------------------------------------------------
