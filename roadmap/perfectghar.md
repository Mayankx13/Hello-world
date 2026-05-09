---
domain: perfectghar
north_star: "Autonomous high-buy-intent B2C lead-gen pipeline"
segment_v1: B2C buyers
target_city: TBD-week-1
---

# PerfectGhar — Roadmap

## Phase 1: Foundation (May 2026)
- start: 2026-05-09
- due: 2026-05-31
- status: active
- dod:
  - LLP registration completed; PAN/TAN issued
  - Current account opened in LLP name
  - Domain registered + landing page live with waitlist email capture
  - Analytics: Plausible or GA4 wired; basic funnel events instrumented
  - Target city pinned (open question — fill into this file by 2026-05-16)
  - **Lead-handoff owner decided:** you / part-time VA / paused-until-Phase-3

## Phase 2: B2C buyer discovery (Jun – Jul 2026)
- start: 2026-06-01
- due: 2026-07-31
- status: planned
- depends_on: llp-live, target-city-pinned
- dod:
  - 5 buyer interviews completed (recorded with consent; transcripts in `journal log perfectghar`)
  - Written ICP: budget band, locality preference, decision timeline, decision-maker
  - 3 confirmed pain points written into `roadmap/perfectghar.md` Phase 3 brief
  - Competitor landscape: 5 incumbents and their lead-source mix documented
  - Honest answer: is "autonomous" feasible without a callback owner? If no, decide hire vs. pause.

## Phase 3: Lead-gen MVP (Aug – Sep 2026)
- start: 2026-08-01
- due: 2026-09-30
- status: planned
- depends_on: icp-defined, lead-handoff-owner-decided
- dod:
  - Single-channel funnel built: Meta ads → high-intent landing → WhatsApp → calendly slot → human callback
  - WhatsApp Business API or Cloud API integrated
  - Lead-scoring rubric (intent signals: budget, timeline, locality, decision-maker)
  - 10 qualified leads at <X CAC (X pinned during Phase 2)
  - Weekly experiments log: what was tested, spend, leads, CAC

## Phase 4: Iterate while job-switch in flight (Oct – Dec 2026)
- start: 2026-10-01
- due: 2026-12-31
- status: planned
- depends_on: phase-3-mvp-shipped
- dod:
  - **Decision gate** before signing any 40 LPA offer: continue solo / hire VA / pause-until-post-switch
  - Moonlighting clause of any new offer reviewed against PerfectGhar income flow
  - LLP financials updated through Q3; supports visa narrative

## Standing constraints

- No PII or sensitive lead data committed to the repo. Logs go to `journal log perfectghar`
  (which is gitignored by default). Aggregate metrics only in roadmap files.
- All ad spend logged in `journal log finance` AND `journal log perfectghar` (cross-link).
- Restricted-HP risk: if corp policy blocks Meta Ads Manager or WhatsApp web, run on personal hotspot
  on the Asus.
