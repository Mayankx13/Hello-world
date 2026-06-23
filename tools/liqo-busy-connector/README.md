# LIQO ↔ BUSY connector (local SQL Server → cloud)

Connects your **BUSY / Microsoft SQL Server** inventory DB (on
`WIN-0A5I5MNR100`) to the LIQO app. Cloudflare can't reach a database on your
store LAN, so this small agent runs **on the Windows machine** and **pushes**
the data out over HTTPS — SQL Server is never exposed to the internet.

```
 Store LAN                                   Cloudflare
┌──────────────────────────┐   HTTPS push   ┌─────────────────────────┐
│ SQL Server (BUSY)        │ ─────────────▶ │ liqo-sync  /push        │
│   WIN-0A5I5MNR100        │   (outbound)   │   transform → D1        │
│ this connector (hourly)  │                │ liqo-api   /recommend ──┼─▶ PWA
└──────────────────────────┘                └─────────────────────────┘
```

> **This is for the full pilot, not the GitHub Pages demo.** The Pages demo is a
> static build on sample data and cannot read a live DB. To use real inventory
> you need the Cloudflare backend deployed (`../../DEPLOY.md`): the Sync Worker
> (with `/push` + `ADMIN_TOKEN`), D1, and the API — then point the PWA at the API
> via `VITE_API_BASE`.

## Prerequisites
- **Node.js 18+** on the Windows box (https://nodejs.org, LTS).
- The LIQO **Sync Worker deployed** to Cloudflare and its **`ADMIN_TOKEN`**.
- SQL Server **TCP/IP protocol enabled** (SQL Server Configuration Manager →
  Protocols → TCP/IP → Enabled), and the SQL login can read the inventory.

## Setup (PowerShell)
```powershell
cd tools\liqo-busy-connector
npm install
copy config.example.json config.json
# keep secrets out of the file:
setx LIQO_SQL_PASSWORD "your-sql-password"
setx LIQO_ADMIN_TOKEN  "your-worker-admin-token"
```

1. **Find your data** (lists tables/views, then columns):
   ```powershell
   node index.mjs --discover
   node index.mjs --discover dbo.YourInventoryTable
   ```
2. **Write the query** in `config.json` — a `SELECT` that **aliases your BUSY
   columns to the LIQO field names** below.
3. **Test without sending:**
   ```powershell
   node index.mjs --dry-run
   ```
4. **Push for real:**
   ```powershell
   node index.mjs
   ```
   Expected: `{ ok:true, raw: N, written: M, ... }`. Open the PWA — it now shows
   live stock.

## Field mapping (alias your columns to these)

| LIQO field | Required | Meaning / BUSY source |
| --- | --- | --- |
| `sku` | ✅ | Unique item code |
| `store` | ✅ | Branch / location name → becomes the store in the picker |
| `category` | ✅ | One of `ac` `tv` `fridge` `wm` (use a `CASE` on your item group). Other categories are ignored. |
| `brand` | ✅ | Brand name |
| `name` | ✅ | Full item description (also used to drop scrap/demo lines) |
| `valueWithGst` + `qty` | ✅* | Stock **total** value (GST-incl) and quantity → unit price = value / qty |
| `price` | ✅* | …**or** give the per-unit price directly instead of value+qty |
| `stockQty` | ✅ | Units in stock at that store (drives availability + ranking) |
| `subCategory` | ⭐ | e.g. `Split AC`, `Double Door`, `Front loading`, `QLed`, `4K UHD` → tags |
| `capacityValue` | ⭐ | Number: tonnage (AC), inches (TV), litres (fridge), kg (WM) → size tags |
| `starRating` | ⭐ | Number or text (`"5 Star"` is auto-cleaned) |
| `inverter` | ⭐ | `1/0`, `true/false`, or `"Inverter"` |
| `skuMargin` *or* `marginPct` | ⭐ | Per-unit margin in ₹ (or as a fraction) → commercial ranking |
| `ageingSlab` | ◽ | Stock-age bucket text → optional ageing-weighted ranking |
| `smartOS`, `mrp`, `capacityText`, `channel` | ◽ | Optional extras (`channel` defaults to `retail`) |

✅* = provide **either** `valueWithGst`+`qty` **or** `price`. ⭐ recommended for
good recommendations. ◽ optional. Everything else (bands, tags, EMI flags) is
derived by the Worker — you don't compute it here.

### Example query
```sql
SELECT
  i.ItemCode                              AS sku,
  i.BranchName                            AS store,
  CASE
    WHEN i.GroupName LIKE '%Air Cond%'                          THEN 'ac'
    WHEN i.GroupName LIKE '%Televis%' OR i.GroupName LIKE '%LED%' THEN 'tv'
    WHEN i.GroupName LIKE '%Refrig%'                            THEN 'fridge'
    WHEN i.GroupName LIKE '%Wash%'                              THEN 'wm'
  END                                     AS category,
  i.BrandName                             AS brand,
  i.ItemName                              AS name,
  i.SubGroupName                          AS subCategory,
  i.Capacity                              AS capacityValue,
  i.StarRating                            AS starRating,
  i.IsInverter                            AS inverter,
  i.StockValueWithGST                     AS valueWithGst,
  i.StockQty                              AS qty,
  i.StockQty                              AS stockQty,
  i.AgeingSlab                            AS ageingSlab,
  i.UnitMargin                            AS skuMargin
FROM dbo.YourInventoryView i
WHERE i.StockQty > 0
  AND i.GroupName IN ('Air Conditioner','LED TV','Refrigerator','Washing Machine');
```
(Replace table/column names with whatever `--discover` shows. Column names above
are illustrative — BUSY schemas vary by installation.)

## Run it hourly (Windows Task Scheduler)
```powershell
schtasks /Create /TN "LIQO Inventory Sync" /SC HOURLY ^
  /TR "node \"%CD%\index.mjs\"" /ST 09:00 /RL HIGHEST /F
```
(Or point `/TR` at a small `.bat` that `cd`s here and runs `node index.mjs`.)
The Worker's own hourly cron stays as a fallback; pushing simply overrides it
with live data when this runs.

## Security
- **Don't put the password in chat or commit it.** Use the `LIQO_SQL_PASSWORD` /
  `LIQO_ADMIN_TOKEN` env vars (`config.json` is git-ignored anyway).
- Prefer a **read-only SQL login** scoped to the inventory view rather than `SA`.
- Keep SQL Server on the LAN only — this agent makes **outbound** calls, so no
  inbound firewall holes or port-forwarding are needed.

## Troubleshooting
- **Connect fails:** enable TCP/IP in SQL Server Configuration Manager and
  restart the service; allow the SQL port through Windows Firewall *locally*.
- **Named instance:** set `sql.options.instanceName` (e.g. `"BUSY"` or
  `"SQLEXPRESS"`) and you can drop `port`.
- **TLS error:** keep `encrypt:false` + `trustServerCertificate:true` for a
  local box (already the default).
- **0 rows:** check the `WHERE` clause and that `category` resolves to one of the
  four supported values.
