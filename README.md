# LIQO Sales Assistant — v0.1

A cross-platform, in-store product-recommendation app for **LIQO** (electronics
retailer — AC, TV, Refrigerator, Washing Machine; stores across North India).
It profiles a walk-in customer with a short questionnaire and recommends
**in-stock** products as **Good / Better / Best (+ one stretch)** with honest
pros and cons. Runs on an in-store tablet (staff-assisted or self-serve kiosk)
and installs on Android & iOS phones.

> Production-draft v0.1. The recommendation logic is **isolated** in a pure,
> parameterized function so it can be tuned over time **without a redeploy**.

---

## Architecture

```
┌─────────────────────┐     POST /recommend      ┌──────────────────────┐
│  web/  (React PWA)   │ ───────────────────────▶ │  worker-api/ (CF)    │
│  tablet · kiosk ·    │     /stores /session     │  reads D1 only       │
│  Android/iOS install │ ◀─────────────────────── │  GET/PUT /config     │
└─────────────────────┘                           └──────────┬───────────┘
        │ offline mode runs the SAME engine                  │ reads
        │ client-side against a bundled sample        ┌──────▼───────────┐
        ▼                                             │  Cloudflare D1   │
  src/engine/ (pure, deterministic, unit-tested)      │ inventory/config │
        ▲                                             │  /sessions       │
        │ same transform + engine                     └──────▲───────────┘
┌───────┴─────────────┐   hourly Cron: getRawInventory()     │ upsert
│ worker-sync/ (CF)   │   → transform → replace snapshot ─────┘
│ BUSY/DBMS → D1      │
└─────────────────────┘
```

- **Frontend** — React + Vite **PWA**. Responsive, tablet-first, also works on
  phones. Installable (web manifest + service worker), full-screen kiosk,
  offline app-shell. Plain CSS using LIQO design tokens (indigo `#1F3864`,
  amber `#F6A21E`; Bricolage Grotesque display, Public Sans body) extracted from
  the approved prototype.
- **Backend** — two **Cloudflare Workers** (TypeScript): the **API Worker**
  (recommendation + session + admin endpoints) and the **Sync Worker** (hourly
  Cron that refreshes inventory).
- **Data store** — **Cloudflare D1** (SQLite): `inventory` (current snapshot),
  `config` (engine parameters), `sessions` (outcome logs). See
  [`schema.sql`](./schema.sql).
- **Engine** — a **pure, deterministic, parameterized** function in
  [`src/engine/recommend.ts`](./src/engine/recommend.ts). **Not** an ML model.
  It takes `(config, inventorySnapshot, request)` and returns the cards.
  Framework-free and unit-tested so parameters can change without touching the
  app or redeploying logic.

## Repo layout

| Path | What |
| --- | --- |
| `web/` | React + Vite PWA (8 screens, EN/Hindi, installable). |
| `worker-api/` | API Worker — `/recommend`, `/stores`, `/catalog/health`, `/session`, `/config`, `/admin/sessions/export`. |
| `worker-sync/` | Sync Worker — hourly Cron `getRawInventory() → transform → D1`. |
| `src/engine/` | **Pure** engine + transform + tag taxonomy + **Vitest** tests. |
| `src/shared/` | D1 row mapping + config persistence shared by both workers. |
| `data/` | `questionnaire.json`, seed `liqo_inventory.json`, `config.json`, `stores.json`. |
| `schema.sql` | D1 DDL (three tables + indexes). |
| `liqo_inventory_mapper.py` | Reference Python mapper that `src/engine/mapper.ts` ports. |

> Each worker has its **own `wrangler.toml`** (two separate Workers, one shared
> D1). The legacy AiEZ Next.js app still lives in `app/ components/ lib/` and in
> git history; this branch delivers LIQO.

---

## Quick start (offline demo — no Cloudflare needed)

```bash
# 1. Engine tests (pure logic — all four categories + stretch + fallback)
npm install
npm test

# 2. Run the PWA. With no VITE_API_BASE set, it runs the SAME engine
#    client-side against a bundled inventory sample (Panchkula/Zirakpur/Chandigarh).
cd web && npm install && npm run dev      # http://localhost:5173
```

Open the dev URL on a phone (same network) to try the install / kiosk behaviour.

---

## Deploy (Cloudflare)

Prerequisites: a Cloudflare account and `npm i -g wrangler` (or use `npx`).

### 1. Create D1 and apply the schema

```bash
wrangler d1 create liqo
# Copy the printed database_id into BOTH worker-api/wrangler.toml and
# worker-sync/wrangler.toml (they bind the SAME database).

wrangler d1 execute liqo --file=./schema.sql            # local
wrangler d1 execute liqo --remote --file=./schema.sql   # production
```

### 2. Deploy the workers

```bash
# API
cd worker-api && npm install
wrangler secret put ADMIN_TOKEN        # gates /config + exports
wrangler deploy                        # → https://liqo-api.<sub>.workers.dev

# Sync (hourly Cron)
cd ../worker-sync && npm install
wrangler secret put ADMIN_TOKEN        # gates POST /sync
wrangler deploy
```

### 3. Seed inventory + config (first run)

The Sync Worker seeds both the `config` row and the `inventory` snapshot. Either
wait for the hourly Cron, or trigger it now:

```bash
curl -X POST https://liqo-sync.<sub>.workers.dev/sync \
     -H "authorization: Bearer $ADMIN_TOKEN"
# → { ok:true, raw:2128, written:2063, source:"seed:liqo_inventory.json", ... }
```

For production, set `INVENTORY_URL` (and optionally `INVENTORY_FORMAT=csv`) in
`worker-sync/wrangler.toml` to point at the BUSY-synced DBMS/HTTP feed; the
bundled seed is only the default.

### 4. Deploy the PWA (Cloudflare Pages)

```bash
cd web
echo "VITE_API_BASE=https://liqo-api.<sub>.workers.dev" > .env.production
npm install && npm run build           # outputs web/dist
wrangler pages deploy dist --project-name liqo
```

Set `VITE_API_BASE` in the Pages project env for production builds. (Omit it and
the app still works offline using the bundled engine + sample.)

---

## How to tune parameters (no redeploy)

All commercial/behavioural knobs live in the D1 `config` row (`key='engine'`),
seeded from [`data/config.json`](./data/config.json). **Editing it changes
behaviour immediately** — the API reads it per request.

```bash
# Read current config
curl https://liqo-api.<sub>.workers.dev/config -H "authorization: Bearer $ADMIN_TOKEN" > config.json

# Edit, then push it back — takes effect on the next request, no deploy
curl -X PUT https://liqo-api.<sub>.workers.dev/config \
     -H "authorization: Bearer $ADMIN_TOKEN" \
     -H "content-type: application/json" \
     --data @config.json
```

Key levers:

| Parameter | Effect |
| --- | --- |
| `priceBands[cat]` | The Good/Better/Best budget bands per category. |
| `rankingBlend.volumeWeight` (α, 0..1) | Weight on available units (volume) vs margin. `0.5` default. |
| `rankingBlend.marginBasis` | `"amount"` (unit ₹ margin) or `"percent"` (margin %). |
| `rankingBlend.fitWeight` (0..1) | Let fit also tilt ranking, not just gate. `0` = commercials only. |
| `rankingBlend.ageingWeighted` | Weight volume by stock age — push older stock first. |
| `brandPreference[cat]` / `brandExclusions[cat]` | Tie-break order; hard exclusions. |
| `stretchThreshold` | Stretch card price ceiling above the band (`0.15` = +15%). |
| `fallbackRule` | `nearestPrice` \| `adjacentBand` \| `relaxFit` when a band is thin. |

> **The commercial blend only ORDERS results — it is never shown or explained.**
> The "why this fits you" line is generated **only** from matched fit tags.

---

## Recommendation logic v1 (replaceable)

Two stages — **fit gates, commercials rank**:

1. **Eligibility (hard gate)**: in stock at this store · unit price within band
   (+15% if stretch) · not an excluded brand · meets must-have features · **and
   genuine customer fit** (capacity/size match for the category + answered
   must-haves). Only genuinely suitable items pass.
2. **Commercial ranking** of the eligible set, normalised within the candidate
   set each request:
   ```
   normVolume = units / max(units in set)
   normMargin = skuMargin / max(skuMargin in set)      (skuMargin per marginBasis)
   commercialScore = volumeWeight*normVolume + (1-volumeWeight)*normMargin
   if ageingWeighted: scale normVolume by stock-age factor (older ranks higher)
   if fitWeight > 0:  finalScore = fitWeight*normFit + (1-fitWeight)*commercialScore
   ```
3. **Assemble**: present three across the price ladder (Good = lower, Better =
   mid, Best = higher) — each slot the highest-ranked SKU at that price level.
   Stretch = highest-ranked eligible item priced ≤ bandMax × 1.15.

**TODOs** (marked in code): real-time final stock check before billing;
EMI/exchange valuation API; ML-learned weights from logged session outcomes.

## Inventory pipeline (1-hour freshness)

Source of truth is a DBMS synced hourly from **BUSY ERP**. `getRawInventory()`
([`worker-sync/src/source.ts`](./worker-sync/src/source.ts)) abstracts it with
two implementations: an HTTP/DBMS endpoint (`INVENTORY_URL`) and a JSON/CSV
loader (the bundled seed). The Sync Worker runs `getRawInventory() → transform →
upsert into D1` hourly. The transform ([`src/engine/mapper.ts`](./src/engine/mapper.ts),
ported from [`liqo_inventory_mapper.py`](./liqo_inventory_mapper.py)) preserves
the BUSY rules exactly: unit price = `ValueWithGst / Qty`; exclude
scrap/demo/dummy & implausible (< ₹2000) prices; normalise star typos; strip
`(F)/(DPF)` codes; derive per-category tags; assign band from config; carry
`skuMargin`/`marginPct`; tag channel (only `retail` is recommendable). Each row
stores `last_synced_at`. **The API never reads BUSY live** (seam left for
Cloudflare Hyperdrive if ever needed).

## API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/recommend` | `{storeId, category, answers[], budgetBand, stretch, exchange}` → `{good,better,best,stretch,attach[]}` |
| GET | `/stores` | Retail stores for the picker / auto-detect |
| GET | `/catalog/health` | Per-category & per-store counts + last sync time |
| POST | `/session` | Log a journey outcome for weekly tuning |
| GET/PUT | `/config` | Read/update engine parameters (admin token) |
| GET | `/admin/sessions/export` | Sessions as JSON or `?format=csv` (admin token) |

## PWA / install

Installable on **Android** (Chrome "Install app") and **iOS** (Share → "Add to
Home Screen"). Full-screen kiosk display, keep-awake where supported, ≥48px
touch targets, WCAG-AA contrast, reduced-motion respected. No web-only hacks
that would block a later **Capacitor** wrap for the Play Store / App Store.

## Acceptance & scope

Full journey < 2 min · engine is a pure function with tests covering all four
categories + stretch + empty-band fallback · config changes take effect with no
redeploy · installs as a PWA · offline app-shell loads. **Out of scope:**
payments, live BUSY integration, auth beyond a simple admin token, ML.

---

# Hello-world
First repository

Hello! Github

I'm Mayank. I love programming and am greatly inspired. Computer systems and their development is my core passion.
Currently I am a student pursuing B.Tech in computer science.
I'm always keen to explore new technologies and learning them.
