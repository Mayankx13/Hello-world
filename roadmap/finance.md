---
domain: finance
north_star: "Home admin closed + emergency fund + SIPs running + LLP live"
---

# Finance — Roadmap

## Phase 1: Admin closeout (May 2026)
- start: 2026-05-09
- due: 2026-05-31
- status: active
- dod:
  - Home-purchase TDS deposited; Form 26QB receipt filed in `journal log finance`
  - ITR FY25–26 filed
  - LLP registration completed (cross-linked to `roadmap/perfectghar.md`)
  - All three confirmation receipts archived (PDF) outside the repo

## Phase 2: Liquidity + protection (Jun 2026)
- start: 2026-06-01
- due: 2026-06-30
- status: planned
- depends_on: phase-1-admin-closed
- dod:
  - Emergency fund verified: ≥6 months of post-home-EMI living expenses in liquid form
  - Term life cover reviewed post-home-purchase: cover ≥ outstanding home loan + 5× annual income
  - Health insurance reviewed: existing policy adequate or top-up purchased
  - Disability income / critical illness reviewed (worth-it decision documented)
  - Existing fund balances + policy details added to this file (placeholder until provided)

## Phase 3: SIPs live (Jul 2026)
- start: 2026-07-01
- due: 2026-07-31
- status: planned
- depends_on: emergency-fund-verified
- dod:
  - Allocation defined: equity / debt / international split with rationale
  - Funds chosen (low expense ratio; index-first bias)
  - Auto-debits configured; first debit confirmed
  - Annual review date set (in calendar via v1.1 .ics export)

## Phase 4: Quarterly hygiene (Aug 2026 onward)
- start: 2026-08-01
- status: planned
- dod:
  - Quarterly review tied to weekly review (last Sunday of Mar/Jun/Sep/Dec)
  - LLP books current; quarterly P&L exported for visa file (cross-link `roadmap/growth.md`)
  - Tax-loss harvesting check at FY end

## Standing rules

- Never commit account numbers, PAN, or balance details to the repo. Use `journal log finance --private`
  for anything sensitive (goes to age-encrypted bucket).
- Big-ticket spend (>₹50k) requires a 24-hour cooling-off note in `journal log finance` before purchase.
- "Big purchase rule" exception: home essentials in move-in week (May 9–22).
