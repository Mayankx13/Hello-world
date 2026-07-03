# LIQO Sales Assistant — Pilot → Adoption Rollout Plan

A staged plan for LIQO to pilot the in-store recommendation assistant, prove it
lifts the numbers that matter, and adopt it across all stores with staff buy-in.
Written against the shipping product (React PWA + Cloudflare Workers/D1 + BUSY
sync + gamified staff layer).

**TL;DR timeline:** ~11 weeks from kickoff to network-wide adoption.
Prep (2w) → 1-store pilot (3w) → 2-store pilot (3w) → go/no-go → phased rollout (3w).

---

## 1. Objectives & success metrics

The product's north star is **items-per-bill** (attach rate); the secondary
proof is that customers **buy the recommended pick**. Everything else supports
those two.

| # | KPI | Baseline (measure first) | Pilot target | Source in-product |
|---|-----|--------------------------|--------------|-------------------|
| 1 | **Items per bill** | current avg | **+0.3** (e.g. 1.2 → 1.5) | Command Centre north-star, Leaderboard |
| 2 | **Bought-recommended rate** | n/a (new) | **≥ 60%** of assisted journeys | Leaderboard reco %, `/session` outcomes |
| 3 | **Assisted conversion** (journey → bill) | walk-in close rate | **≥ walk-in +5pts** | sessions vs sales |
| 4 | **Average ticket value** | current avg | **+8%** | `v_store_daily` revenue/bills |
| 5 | **Ageing/dead-stock movement** | current % ≥151d | **−10%** of aged units | Command Centre ageing |
| 6 | **Staff adoption** | 0 | **≥ 80%** of active staff run ≥5 journeys/day | sessions per user |
| 7 | **Data freshness** | n/a | inventory sync < 90 min stale, > 98% uptime | `/catalog/health` lastSyncedAt |

> Set targets *after* the Week-1 baseline read — don't guess the starting point.

---

## 2. Phases & go/no-go gates

### Phase 0 — Readiness (Weeks 1–2, no customers yet)
Get the plumbing and the people ready before a single customer sees it.

**Tech & data**
- Stand up Cloudflare stack via the one-shot deploy (`DEPLOY.md`): D1, API + Sync
  workers, PWA + marketing Pages. Use the **dev** environment first (`deploy-dev.yml`).
- Wire the **BUSY → LIQO connector** on the store's Windows/SQL box
  (`tools/busy-connector/`): run `-Discover`, map columns, confirm the hourly
  push lands (`/catalog/health` shows real SKUs/units per category).
- **Inventory data-quality pass** — this makes or breaks recommendations:
  category mapping (ac/tv/fridge/wm), price sanity (unit price, not totals),
  star/capacity/sub-category fields populated. Fix at source or in `columnMap`.
- Tune `config.json` price bands per category to LIQO's real ladder; set brand
  preference/exclusions; keep LLM rationale **off** for the pilot (turn on later).
- Seed **real staff** into `employees` (not demo accounts); set store assignments
  and roles (admin / manager / salesperson). Disable `DEMO_LOGIN`.

**Devices & environment**
- 1–2 tablets per store (Android), PWA installed, kiosk-friendly stand, reliable
  Wi-Fi. Test offline behaviour (PWA still runs; sessions log on reconnect).

**Compliance**
- DPDP: confirm the consent line + phone-recall opt-in copy with LIQO; anonymous
  session logging is always on, phone-keyed writes only on consent.

**Exit gate → Phase 1:** dev stack live, one store's inventory syncing cleanly,
staff accounts working, tablet in hand, baseline metrics captured.

### Phase 1 — Single-store pilot: **Zirakpur** (Weeks 3–5)
Prove it works with real customers and real staff at one flagship pilot store.

- Go live on **production** for Zirakpur only.
- **Train** the floor: 60-min session (assisted flow, attach step, outcome
  logging, customer recall, leaderboard). One "champion" salesperson per shift.
- Run **assisted journeys** for a defined share of walk-ins; log every outcome.
- Manager reviews the **Command Centre** daily; weekly check-in on the 7 KPIs.
- Weekly config tuning based on Engine Test + real outcomes (bands, brand order).

**Exit gate → Phase 2:** KPIs #1/#2/#6 trending to target, no data-integrity or
device blockers, staff sentiment positive (Feedback screen).

### Phase 2 — Two-store pilot: add **Panchkula** (Weeks 6–8)
Validate multi-store: cross-store leaderboard competition, store-scoped offers,
manager dashboards, and that the model generalizes to a second catalog.

- Second store live; enable **inter-store Leaderboard** + a monthly **incentive
  milestone** (items/bill, reco-rate) to drive adoption.
- Launch 1–2 **offers with engine boost** to test the promotions loop.
- A/B read: assisted journeys vs walk-in bills on items/bill and ticket value.

**Exit gate → Rollout (go/no-go):** documented lift on items/bill AND ticket
value across both stores, staff adoption ≥ 80%, sync uptime ≥ 98%, positive ROI
case. **If not met**, extend pilot or remediate the failing workstream.

### Phase 3 — Phased network rollout (Weeks 9–11)
Roll to the remaining stores in waves, ~2 stores/week: **Chandigarh → Kharar →
Pinjore → Solan** (and any others). Each store repeats a lightweight Phase-0
checklist (inventory mapping, staff seeding, device, 45-min training).

- Standing weekly network review in the Command Centre.
- Promote a per-store champion; use the Leaderboard for healthy competition.

### Phase 4 — Full adoption & optimization (ongoing)
- Turn on **LLM "why this fits you"** rationale (Haiku) once trust is established.
- Iterate the **questionnaire** live (admin editor + LLM suggestions) from drop-off
  data; tune ranking blend from logged outcomes.
- Fold in customer recall, exchange/EMI, and monthly incentive settlement into BAU.

---

## 3. Workstreams & owners (RACI)

| Workstream | Accountable | Responsible | Key artefacts |
|-----------|-------------|-------------|---------------|
| Tech & deploy | Founder/CTO | Eng | `DEPLOY.md`, workflows, `/catalog/health` |
| Inventory data & BUSY sync | Store IT / BUSY vendor | Eng | `tools/busy-connector/`, `docs/DATA-SOURCES.md` |
| Engine config & tuning | Founder | Admin (Config Editor) | `config.json`, Engine Test console |
| Ops & training | Regional/Store Manager | Store champions | training deck, kiosk setup |
| Change mgmt & incentives | Founder + Managers | HR/Managers | Milestones, Leaderboard, Incentives |
| Compliance (DPDP) | Founder | — | consent copy, erase-by-phone flow |
| Measurement | Founder | Managers | Command Centre, weekly KPI sheet |

---

## 4. Adoption levers (why staff will actually use it)

Adoption is the #1 risk in retail tools. The product already ships the levers —
use them deliberately:

- **Gamified Leaderboard** (weekly/monthly, within- and cross-store) — visible
  points that trace to real bills; healthy rep-vs-rep and store-vs-store competition.
- **Incentives ledger** tied to **milestones** (items/bill ≥1.5, reco-rate ≥70%,
  bills, revenue) with a rupee value (50 pts = ₹1) — money, not just badges.
- **Manager visibility** — Command Centre store comparison surfaces laggards early.
- **Make it faster than not using it** — recall by phone, one-tap attach, WhatsApp
  summary. Frame it as *"close bigger bills faster,"* not *"more admin."*
- **Champions per shift** — peer proof beats top-down mandates.

---

## 5. Measurement plan

- **Baseline first (Week 1):** current items/bill, avg ticket, close rate, aged-stock %.
- **During pilot:** assisted-journey cohort vs walk-in control on the same store/period.
- **Instruments:** Command Centre (north-star, store comparison, ageing, trading,
  demand conversion), Leaderboard (per-rep items/bill + reco%), `/session` outcomes,
  `/catalog/health` (data freshness), Feedback (staff sentiment).
- **Cadence:** daily glance (manager), weekly KPI review (founder + managers),
  end-of-phase go/no-go written decision.

---

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Poor inventory data (bad category/price/specs) | Bad recommendations, lost trust | Week-0 data-quality gate; fix at BUSY source; `/catalog/health` monitoring |
| Sync gaps / stale stock | Recommends out-of-stock items | Hourly cron + freshness alert; "confirm stock at billing" already on cards |
| Low staff adoption | No lift | Champions, leaderboard, incentive money, manager dashboards, fast UX |
| Connectivity drops on floor | Journeys stall | PWA offline mode (bundled engine); sessions sync on reconnect |
| Privacy/DPDP concerns | Compliance risk | Consent-gated phone capture, anonymous-by-default logging, erase-by-phone |
| Device loss/misuse | Cost, data | Kiosk lockdown, per-store device count, staff login (no shared creds) |
| Over-reliance on "stretch"/margin push | Customer distrust | Ranking is hidden; honest pros/cons; monitor reco-adoption & returns |

---

## 7. Rollback / contingency

- Per-store **kill switch:** point that store's staff back to normal selling; the
  app is additive, not a system-of-record, so nothing else breaks.
- **Data issue:** an empty/failed feed no longer wipes the catalog (atomic
  replace); Sync Worker retries hourly; manual `/sync` for ad-hoc refresh.
- **Config regression:** engine config is versioned and editable live (no redeploy);
  revert to the last-known-good config from the admin editor.

---

## 8. One-page checklist per store (rollout wave)

- [ ] BUSY connector mapped + hourly push verified (`/catalog/health`)
- [ ] Inventory data-quality pass (category, price, specs) signed off
- [ ] Price bands / brand order tuned for the store's catalog
- [ ] Real staff seeded with roles + store; demo login disabled
- [ ] Tablet(s) provisioned, PWA installed, Wi-Fi + kiosk stand tested
- [ ] DPDP consent copy confirmed
- [ ] 45–60 min staff training + champion named
- [ ] Baseline KPIs captured
- [ ] First-week daily Command Centre review scheduled
- [ ] Go/no-go criteria agreed in writing
