# Excel → D1 importer

Loads the four operational exports into the LIQO D1 tables, matching `schema.sql`
exactly. The inventory stage runs the **real engine transform**
(`transformInventory` + `DEFAULT_CONFIG`), so the snapshot is identical to what
the Sync Worker would write — recommendations work on real stock immediately.

```
Sales Person List  ─────────────▶ employees                  (+ stores)
Stock Status (MC-wise) ──┬───────▶ data/import/raw/*.json ──▶ 03_inventory.sql
                         └ engine transform (AC/TV/Fridge/WM)
100 Cx Retails  ┐
Last month Zirk ┘ ── group by bill ▶ customers, customer_brand_prefs,
                                      sales, sale_items, customer_events
```

## ⚠️ Privacy — the output is NOT committed

`data/import/` is gitignored. It contains customer **PII** (names, phones,
addresses) and **dealer pricing**, and this repo is public. Never commit it.
Load it straight into your private D1 with wrangler (below).

## Run

```bash
# 1) generate + validate (writes data/import/, prints row counts + view checks)
tools/etl/run.sh /path/to/uploads            # dir holding the 4 .xlsx files

# 2) (optional) prove the engine recommends on the real stock
tools/etl/test.sh
```

Inputs are matched by filename substring (`Sales_Person`, `StockStatus`,
`Cx_Retails`, `Last_month_Sales`), so your own re-exports work unchanged.

Requires `python3` + `openpyxl` (`pip install openpyxl`) and the repo's
`node_modules` (`esbuild` is used to bundle the TS inventory stage).

## Load into D1

Run in this order (FK dependencies). Use `liqo-dev` for the dev database:

```bash
for f in 01_stores 02_employees 03_inventory 04_customers 05_sales; do
  wrangler d1 execute liqo --remote --file=./data/import/$f.sql --yes
done
```

`schema.sql` must already be applied (the deploy workflow does this). All
statements are `INSERT OR IGNORE` / snapshot-replace, so re-running is safe.

## What each file produces (typical volumes)

| File | Tables | ~Rows |
|------|--------|-------|
| `01_stores.sql` | `stores` | 7 |
| `02_employees.sql` | `employees` (role, store, ISD/LIQO title) | 67 |
| `03_inventory.sql` | `inventory` (engine snapshot, 4 categories) | ~2 000 |
| `04_customers.sql` | `customers` (premium tier, home store) + `customer_brand_prefs` | ~1 270 / ~1 880 |
| `05_sales.sql` | `sales` + `sale_items` + `customer_events` (purchases) | ~1 390 / ~1 950 / ~1 390 |

## Mapping notes & deliberate choices

- **Inventory = the 4 recommendable categories** (AC/TV/Fridge/Washing Machine).
  The engine only ranks these; other catalogue lines (Geyser, Speaker, Fan, …)
  are reported in `summary.json` and skipped. The per-store stock columns are
  unpivoted to one row per SKU×store with stock > 0. `price` = LIQO price
  (→ online → MRP); margin from `LIQO − DEALER` when present, else synthesised.
  Ramgarh B2B/B2C/None-QC collapse to `store_id=ramgarh` with `channel` set so
  only B2C counts as retail.
- **Customers** are deduped by normalised 10-digit phone; `premium_tier` is
  banded from lifetime spend; `customer_brand_prefs` capture owned brands;
  `consent=1` by default (first-party transaction history → recallable in-app;
  pass `--no-consent` to import contactless).
- **Sales** group line rows by `Vch/Bill No`. `employee_id` links only when the
  salesperson cell carries a `LIQO####` code that exists in `employees`
  (else NULL); `store_id` from the bill location; `source='walk_in'`.
- Everything validates against `schema.sql` in an in-memory SQLite with
  `foreign_key_check` before it can reach D1.
