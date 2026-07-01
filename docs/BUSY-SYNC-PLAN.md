# BUSY → LIQO — Automated Inventory Sync Plan

**Goal:** hands-off, automatic sync of live stock from **BUSY ERP (on-premise,
shared across all stores)** into the Cloudflare **D1** snapshot the app reads —
so recommendations always reflect real, in-stock models with no manual uploads.

This plan is built around what's already in the repo (`worker-sync` + `/push` +
`docs/DATA-SOURCES.md`) and closes the two gaps that block a live sync today.

---

## Why this shape is feasible (the key decisions)

| Decision | Why it makes automation feasible |
|---|---|
| **Push, not pull** (on-prem → cloud over outbound HTTPS) | BUSY sits behind the shop's internet — dynamic IP, no inbound ports. Outbound HTTPS needs **zero** firewall/router/VPN changes and works on any connection. |
| **Scheduled connector on the BUSY Windows machine** (Task Scheduler) | BUSY runs on Windows; Task Scheduler is built-in. No extra server, no cloud-to-on-prem tunnel to maintain. |
| **One central BUSY → one connector → one full-snapshot push** | Stock for all 7 stores lives in one BUSY, so one job reads everything and replaces the whole D1 snapshot atomically. **No delta bookkeeping**, no per-store race conditions. |
| **Extraction via BUSY's own export (or a read-only SQL query)** | Uses BUSY features that already exist — no BUSY customisation, no vendor lock-in. |
| **App reads only the D1 snapshot** | Nothing customer-facing ever touches BUSY, so a slow/offline BUSY never affects the store floor. |

---

## The automated pipeline (end state)

```
Windows Task Scheduler on the BUSY server  (every 30–60 min, unattended)
  └─ runs the connector (PowerShell — nothing to install)
       1. read current stock from BUSY
            • Option A: newest scheduled Stock-Status export (CSV/XLSX), OR
            • Option B: a read-only SQL Server query (live)
       2. map BUSY columns → LIQO row contract (sku, store, category, brand, price, stockQty …)
       3. map BUSY location/branch → store slug (zirakpur, panchkula, chandigarh, …)
       4. POST { rows:[…] }  →  https://api-dev.amaflip.in/inventory/push   (Bearer ADMIN_TOKEN)
  └─ Cloudflare API worker: transform → ATOMIC replace of the D1 snapshot  (audit-logged)
  └─ App + engine read the fresh snapshot;  GET /catalog/health shows counts + last-sync time
```

Freshness = the Task Scheduler interval (30–60 min is ample for in-store use; can
go tighter). Everything after the POST is already built.

---

## Two cloud-side prerequisites (gaps to close first — small)

1. **A reachable push endpoint.** `liqo-sync` has no public URL. Rather than
   provision a new domain for it, add **`POST /inventory/push`** to the **API
   worker** — it's already public (`api-dev.amaflip.in`), already admin-token
   gated, and already **audit-logged**, so every sync shows up in the Activity
   log for free. It reuses the same `transformInventory` + `replaceInventory`
   the sync worker uses (no logic duplicated).
2. **Stop the cron from clobbering pushed data.** Set the sync worker to
   **push mode** (`INVENTORY_SOURCE = "push"`) and make its hourly cron a no-op
   in that mode, so it never overwrites live stock with the bundled seed. The
   `/health` endpoint still reports snapshot freshness.

Both are a few lines; I can land them in one commit and they deploy with the
normal workflow.

---

## Extraction from BUSY — one choice, same endpoint either way

BUSY stores everything in **Microsoft SQL Server**. Two feasible paths:

- **Option A — Scheduled export (recommended to start).** BUSY exports its
  **Stock Status** to CSV/XLSX (BUSY can auto-export on a timer, or a tiny macro
  does it). The connector reads the newest file and pushes. **No DB credentials,
  no schema knowledge, works on any BUSY edition.** Fastest to production.
- **Option B — Direct SQL Server (upgrade for near-real-time).** A **read-only**
  SQL login runs a stock query on the LAN; the connector maps + pushes. Live-ish
  stock. Needs the correct BUSY stock query (BUSY support/your vendor can provide
  it) and a read-only login.

Start on A, graduate to B later with **no cloud changes** — both POST the same
rows to the same endpoint.

---

## Phases

| Phase | Work | Owner | Blocks on |
|---|---|---|---|
| **P1 — Cloud prereqs** | Add `POST /inventory/push` (API worker) + push-mode cron guard; deploy | me | — (can start now) |
| **P2 — Connector** | PowerShell connector: read (CSV/SQL) → map → push; config file; logging | me | a sample BUSY export **or** the SQL query |
| **P3 — BUSY hookup** | Set up the scheduled Stock-Status export (or read-only SQL login + query); confirm real column names + location→store map | you / BUSY vendor | BUSY access |
| **P4 — Schedule + observe** | Register the Task Scheduler job; surface last-sync time / row counts / errors on the Command Centre; alert if stale | me + you | P2–P3 |

---

## What I need from you to build the connector (P2)

1. **A sample of BUSY's Stock-Status export** — the header row + a few example
   rows (any category). That lets me map the real column names exactly.
   *(If you'd rather go the SQL route, share the stock query instead.)*
2. **The store/location labels BUSY uses** (so I map them to the 7 store slugs).
3. Connector language preference — **PowerShell** (no install; recommended) or
   Python.

Nothing sensitive needs to go in the repo: the `ADMIN_TOKEN` lives in a local
config file on the BUSY machine, and only stock rows (no PII) ever leave it.

---

## Why it stays low-maintenance

- No inbound network exposure, no VPN, no static IP.
- Full-snapshot each run → self-healing (a missed run just means slightly stale
  stock; the next run fully corrects it).
- Token in local config; rotate anytime.
- Observability is already there: `GET /catalog/health` (counts + freshness),
  the `audit_log` (every push recorded), and `/health` on the sync worker.
