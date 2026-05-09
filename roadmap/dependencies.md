# Cross-domain dependencies

A dependency edge says "this milestone unblocks that work." Items below the line need to land
in roughly the order shown.

## High-leverage edges

| From (blocker) | To (unblocked) | Why it matters |
|---|---|---|
| Move-in complete (2026-05-22) | All domains | Bandwidth + gym access; stops being the excuse |
| Isotretinoin week-4 labs stable (~Jun 5) | Body Phase 2 build | Joint-stressful work after stable lipids/LFT |
| LLP live (2026-05-31 target) | Venture revenue path; Finance tax structure; Growth visa narrative | Single doc unlocks three domains |
| ITR filed (2026-05-31 target) | Visa file (Growth) | Visa file requires ITR ack + 26AS |
| 6-month bank statements | Visa file | DS-160 supporting docs |
| ≥3-month LLP financials (~2026-09) | Visa: ties-to-home-country case | Strengthens "I have something to come back to" |
| Emergency fund verified (Jun 2026) | SIPs live (Jul 2026) | Don't auto-debit before liquidity is real |
| ICP defined (Phase 2 PerfectGhar) | Lead-gen MVP (Phase 3) | Don't spend before you know who you're targeting |
| Lead-handoff owner decided | Any ad spend on PerfectGhar | "Autonomous" still needs a callback human |
| Job offer in hand | Moonlighting decision for PerfectGhar | Forces the conversation; you can't defer it forever |
| Resume v2 + target list | Pipeline build (Phase 2 Career) | No applications before positioning is right |

## Reverse blockers (things that go wrong if X doesn't happen)

- **Visa interview slot not booked in Q3 2026** → 2027 trip slips. India slots have been long; book early.
- **Job offer signed without moonlighting review** → forced PerfectGhar wind-down or contract violation.
- **SIPs auto-debit before emergency fund** → forced redemption at the wrong time on the next surprise expense.
- **Body Phase 2 volume push before week-4 labs** → tendinitis is the most common isotretinoin side effect.
- **PerfectGhar ad spend without ICP** → wasted spend; founder-burn signal.

## MacBook arrival

Not a date-pinned dependency; whenever it happens:
1. Clone the GitHub repo to MacBook.
2. Run `scripts/setup.sh`.
3. Set Anthropic key via `journal config set-key` (Keychain).
4. Re-import age identity: copy `~/.life-os/age.key` from old machine over a secure channel.
5. `python scripts/reindex.py` rebuilds SQLite from markdown.
6. Done.
