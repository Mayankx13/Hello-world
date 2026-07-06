# liqo-ig-concierge

AI concierge for LIQO's Instagram DMs (**@liqo_discounted_electronics**) — Amaflip India Pvt. Ltd.

The DM message loop itself runs in **n8n** (built separately). This monorepo owns everything
around it:

| Path | What |
|---|---|
| `schema/` | D1 schema (`liqo_concierge`), migrations, reference + demo seeds |
| `worker/` | Hono Worker — Meta webhook verifier + dashboard API (D1 binding `DB`) |
| `dashboard/` | React 18 + Vite dashboard → **command.amaflip.in** (Cloudflare Pages) |
| `scripts/` | BUSY-ERP attribution importer (Python, pandas + requests) |

```
Instagram DM ──▶ Meta webhook ──▶ Worker /webhook (signature check)
                                        │ forwards raw payload
                                        ▼
                                   n8n DM loop ──▶ writes conversations/leads
                                                    to D1 via Cloudflare API
BUSY daily export ──▶ scripts/import_busy_bills.py ──▶ /api/attribution/import
command.amaflip.in (Pages + CF Access) ──▶ /api/* (X-Api-Key) ──▶ D1
```

---

## 1 · First-time setup

```bash
npm install                    # workspaces: worker + dashboard
npm run db:create              # once: creates the D1 database "liqo_concierge"
# paste the printed database_id into worker/wrangler.toml
npm run db:apply               # local dev DB: schema + reference seeds
npm run db:apply:remote        # production D1: schema + reference seeds
npm run db:demo                # OPTIONAL, local only: 14 days of demo data
```

Reference seeds put 11 material-centre placeholder rows in `stores` (fields marked
`EDIT:` are yours to fill) and one sample row in `offers`. Both are `INSERT OR IGNORE` —
re-running never duplicates or overwrites your edits.

**Schema changes** go through `schema/migrations/` (new numbered file + keep
`schema/schema.sql` in sync), applied with `npm run db:migrate[:remote]`.
The n8n workflow writes to these same tables — treat column names, types, and
CHECK enums as a stable contract.

## 2 · Secrets

Set each with `npx wrangler secret put <NAME>` from `worker/` (local dev: copy
`worker/.dev.vars.example` → `worker/.dev.vars`). **Nothing secret is ever committed.**

| Secret | What it is |
|---|---|
| `META_VERIFY_TOKEN` | random string you invent; also pasted in Meta's webhook config |
| `META_APP_SECRET` | Meta App Dashboard → Settings → Basic → App secret |
| `N8N_WEBHOOK_URL` | the n8n webhook URL verified payloads are forwarded to |
| `DASH_API_KEY` | random string you invent; dashboard + importer send it as `X-Api-Key` |

Vars (not secret): `USD_INR` in `worker/wrangler.toml` (default 87) for cost conversion.

Dashboard build-time env (Pages project → Settings → Environment variables):
`VITE_API_BASE` (empty when `/api/*` is routed on command.amaflip.in, else the
workers.dev URL), `VITE_DASH_API_KEY` (= `DASH_API_KEY`), `VITE_STORE_AVG_IPB`
(items-per-bill benchmark, default 1.4). The key lands inside the built bundle —
that is by design: the bundle itself sits behind Cloudflare Access, and the key is
the second lock for the case where Access is misconfigured.

## 3 · Deploy

```bash
npm run deploy:worker          # wrangler deploy → liqo-concierge.<account>.workers.dev
npm run deploy:dashboard       # builds and wrangler pages deploy → project liqo-command
npm run deploy                 # both
```

Then, one-time:

1. **Pages custom domain** — Pages project `liqo-command` → Custom domains →
   `command.amaflip.in`.
2. **Cloudflare Access** (Zero Trust → Access → Applications): protect
   `command.amaflip.in` (allow only Amaflip staff). Do **not** put Access in front of
   the workers.dev URL — Meta and the importer must reach it; those paths are
   protected by the Meta signature and the API key instead.
3. **Same-origin API (optional but recommended):** uncomment the `routes` block in
   `worker/wrangler.toml` so `command.amaflip.in/api/*` hits the Worker, and leave
   `VITE_API_BASE` empty. Until then, set `VITE_API_BASE` to the workers.dev URL.

## 4 · Point Meta's webhook at the Worker

In the Meta App Dashboard (the app that owns the Instagram professional account):

1. Products → **Webhooks** → subscribe to the **Instagram** object.
2. Callback URL: `https://liqo-concierge.<account>.workers.dev/webhook`
3. Verify token: the exact value of `META_VERIFY_TOKEN`.
4. Click *Verify and save* — Meta sends `GET /webhook?hub.mode=subscribe&…`; the
   Worker echoes `hub.challenge` only on a token match.
5. Subscribe to the `messages` field (add `messaging_postbacks` if you use ice-breakers).
6. Every `POST /webhook` is checked against `X-Hub-Signature-256`
   (HMAC-SHA256 of the raw body with `META_APP_SECRET`) and forwarded unchanged to
   `N8N_WEBHOOK_URL`; the Worker acks Meta immediately, so n8n can be swapped or
   restarted without Meta noticing. Message bodies are never logged in the Worker.

## 5 · Daily BUSY attribution import

```bash
pip install -r scripts/requirements.txt        # pandas, requests, openpyxl
export LIQO_API_BASE=https://liqo-concierge.<account>.workers.dev
export LIQO_DASH_API_KEY=<DASH_API_KEY value>
python3 scripts/import_busy_bills.py exports/sales-$(date +%F).xlsx --store "LIQO Zirakpur"
```

- Reads BUSY xlsx/csv exports; the header row is auto-detected (banner rows above are
  fine), `Total` footer rows are skipped.
- **code match**: narration mentions `LIQO-DM` / `LIQODM` / `LIQO DM` (any case).
- **phone match**: bill phone equals a lead phone on the last 10 digits.
- Matches are upserted on `bill_no` via `POST /api/attribution/import`
  (re-running the same file is safe); unmatched bills are only counted.
- `--dry-run` prints the reconciliation summary without posting.
- Schedule it right after the daily BUSY export lands (cron / Task Scheduler on the
  back-office PC). When the BUSY Cloudflare-Tunnel SQL bridge ships, implement
  `load_bills_from_sql()` — the fiscal-year database name (e.g. `BUSY_2627`) is a
  parameter, never hardcoded, because BUSY rolls a new database every April.

## 6 · Tests

```bash
npm test             # 16 tests: Meta signature verification + KPI SQL smoke test
npm run typecheck    # worker + dashboard
```

The KPI smoke test runs the exact SQL the Worker executes (shared module
`worker/src/sql.ts`) against `node:sqlite` loaded with schema + seeds + demo data,
asserting non-zero KPIs and a monotonic 5-stage funnel. Requires Node ≥ 22.5.

## 7 · Go-live checklist

- [ ] D1 created; `database_id` in `worker/wrangler.toml`; `npm run db:apply:remote` done
- [ ] Real store addresses/hours/phones edited into `stores` (rows marked `EDIT:`)
- [ ] Real current offers in `offers`; sample row deactivated (`active = 0`)
- [ ] All four secrets set via `wrangler secret put`; `.dev.vars` never committed
- [ ] Worker deployed; `GET /` on the workers.dev URL returns `{"ok":true}`
- [ ] Meta webhook verified (step 4) and `messages` field subscribed
- [ ] Test DM from a tester account flows: Meta → Worker → n8n → row in `conversations`
- [ ] Dashboard deployed; `command.amaflip.in` behind Cloudflare Access; renders on a phone
- [ ] Importer dry-run against yesterday's BUSY export reconciles sensibly
- [ ] Meta App Review passed for Instagram messaging permissions; go live 🚀
- [ ] Day 1: check `/api/costs` — spend should be a few ₹, not hundreds

---
Internal tool of **Amaflip India Pvt. Ltd.** · consumer brand: **LIQO**
