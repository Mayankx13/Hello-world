# BUSY → LIQO inventory connector

Automatically syncs live stock from **BUSY ERP** (on-prem, MS SQL Server) into the
LIQO app. It reads BUSY, maps the rows, and pushes **one full snapshot** to the
LIQO API, which atomically replaces the D1 inventory. Runs unattended on the
Windows machine that can reach BUSY's SQL Server.

```
Task Scheduler → busy-liqo-sync.ps1 → read BUSY (SQL or CSV) → map → POST /inventory/push → D1
```

Why it's safe & low-touch: **outbound HTTPS only** (no firewall/router/VPN
changes), no software to install (uses built-in .NET SQL client), and a full
snapshot each run means a missed run self-corrects on the next.

---

## Prerequisites

- Windows with **PowerShell 5.1+** (built in) on a machine that can reach the
  BUSY **SQL Server** (the BUSY server itself, or any PC on the same LAN).
- Read access to the BUSY SQL Server (Windows auth, or a **read-only** SQL login).
- The LIQO **ADMIN_TOKEN** (same secret the workers use).
- The cloud endpoint deployed: `POST /inventory/push` (ships in commit that adds
  this folder — redeploy dev once so it's live).

---

## One-time setup

### 1. Find BUSY's stock query (schema discovery)
Run `discover-busy-schema.sql` in SSMS against your BUSY server and share the
output — or, fastest, **ask your BUSY dealer for the "Item-wise Stock with Sale
Price / MRP / Brand / Category / Location" query**. The connector just needs a
query that returns **one row per SKU per store** with those columns.

### 2. Configure
```powershell
copy config.example.json config.json
notepad config.json
```
Fill in:
- `adminToken` — your LIQO admin token.
- `pushUrl` — `https://api-dev.amaflip.in/inventory/push` (dev) — later `api.amaflip.in` for prod.
- `mode` — `"sql"` (recommended) or `"csv"` (read your existing BUSY export).
- `sql.server` / `sql.database` / `sql.auth` and `sql.query` (from step 1).
- `columnMap` — point each LIQO field at the exact column name your query returns.
- `storeMap` — BUSY location text → LIQO store slug (already pre-filled for your 7 stores).
- `categoryMap` — BUSY category text → `ac` / `tv` / `fridge` / `wm`.

> Minimum columns: `sku, store, category, brand, price, stockQty`. Everything
> else (`mrp`, `capacityText`, `starRating`, `inverter`, `model/name`) is optional
> and improves the recommendations if present.

### 3. Test a run
```powershell
powershell -ExecutionPolicy Bypass -File .\busy-liqo-sync.ps1 -Config .\config.json
```
Expect: `PUSH ok -> raw=<n> written=<m> …`. Then confirm in the app
(`GET https://api-dev.amaflip.in/catalog/health` shows the new counts +
`lastSyncedAt`), and the sync appears in the admin **Activity log**.

### 4. Put the sync into "push" mode (so the hourly cron stops re-seeding)
Set `INVENTORY_SOURCE = "push"` on the **liqo-sync** worker (repo var / wrangler)
and redeploy. The cron then idles and your pushes own the inventory.

### 5. Schedule it (unattended)
Task Scheduler → Create Task:
- **General:** "Run whether user is logged on or not."
- **Triggers:** Daily, repeat every **30–60 min** for 24h.
- **Actions:** Start a program
  - Program: `powershell.exe`
  - Arguments: `-ExecutionPolicy Bypass -File "C:\LIQO\busy-connector\busy-liqo-sync.ps1" -Config "C:\LIQO\busy-connector\config.json"`
- **Settings:** "If the task fails, restart every 5 min, up to 3 times."

Done — stock now flows to the app automatically.

---

## Switching between SQL and CSV
- `mode: "sql"` → live query each run (recommended once the query is confirmed).
- `mode: "csv"` → set `csv.pickNewestIn` to the folder where BUSY drops its export;
  the connector grabs the newest file. Good for going live **today** with your
  current export while the SQL query is finalized.

## Security
- `config.json` (token + DB creds) is **gitignored** — it never leaves the machine.
- Only stock rows (SKU, price, qty, brand, category, store) are sent — **no PII**.
- Use a **read-only** SQL login if you use SQL auth.
- Rotate the token anytime (update `config.json`).

## Troubleshooting
- `no mappable rows` → your `columnMap`/`categoryMap` names don't match the source
  columns. Check the query output headers.
- `401` on push → wrong/expired `adminToken`, or `/inventory/push` not deployed yet.
- SQL connect errors → check `server` (instance name), auth mode, and that the
  machine can reach the SQL Server (firewall/port 1433 or the named-instance port).
- All logs are in `busy-liqo-sync.log` next to the script.
