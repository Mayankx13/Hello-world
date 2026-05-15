# Analysis Template — Behavioral Feedback Survey

A one-page guide for what to look at once responses come in. The point: separate **stated intent** (cheap, polite) from **revealed behavior** (expensive, honest). Most useful signal lives in telemetry + open-text specificity, not in the radio answers.

## 1 — Van Westendorp Price Sensitivity Meter (Q9–Q12)

Plot four cumulative-frequency curves on the same axes (x = ₹ price, y = % of respondents):

| Curve | Source | Direction |
|---|---|---|
| Too expensive | Q9 | % at-or-below this price feel it's too expensive (descending as price ↓) |
| Expensive | Q10 | % at-or-below this price feel it's getting expensive (descending) |
| Good deal | Q11 | % at-or-above this price feel it's a good deal (ascending) |
| Too cheap | Q12 | % at-or-below this price feel it's suspiciously cheap (descending) |

Read four intersections:
- **Optimal Price Point (OPP)**: intersection of "Too expensive" and "Too cheap". The price where the same fraction find it suspect on both ends.
- **Indifference Price Point (IPP)**: intersection of "Expensive" and "Good deal". The price the median respondent treats as neither cheap nor expensive.
- **Point of Marginal Cheapness (PMC)**: intersection of "Too cheap" and "Good deal". Floor.
- **Point of Marginal Expensiveness (PME)**: intersection of "Too expensive" and "Expensive". Ceiling.

Acceptable range = PMC → PME. Sweet spot is OPP, often near IPP.

**Watch for**: tiny sample size makes curves jagged — any reading from <30 respondents is directional, not conclusive. Outliers (someone wrote `1` or `10000000`) skew everything; either trim top/bottom 5% or median-impute.

## 2 — Drop-off heatmap

For each screen index 0–9, count:

- **Reached** (`max(screen_times_ms keys) >= idx`)
- **Completed** (`is_complete = true` AND `current_screen >= idx` at any partial)
- **Drop-off rate** = 1 − (next_screen_reached / this_screen_reached)

Render as a horizontal bar chart, one row per screen. Big drops on the same screen across respondents flag a UX or copy problem on that section.

**Especially watch**:
- § 2 (Their world) — if people bail here, the form is too long up front
- § 6 (Van Westendorp) — four ₹ inputs is the densest section; expected drop ~10–15%
- § 8 (Specificity) — required minimums on Q15/Q18 may bounce respondents; check `answer_changed.q15`/`q18` to see if they tried then erased

## 3 — Time-on-screen outliers

Compute per-screen `mean(dwell_ms)`, `median`, `stdev`. Flag responses where dwell is >2σ from the median.

**Long dwell readings** (depending on screen):
- § 4 (concept reveal) — long dwell = real consideration. **Good signal.**
- § 6 (PSM) — long dwell = struggling with the question. **Friction signal.**
- § 8 (Q15 specific Reel) — long dwell = thinking carefully. **Often correlates with high-quality answers.**

**Short dwell readings**:
- Open-text screens with <5s dwell = skimmed/dismissed answer. Treat their open-text answer as low-confidence.

## 4 — Recurring vs one-time (Q13 + Q14)

Q13 is the easy split — pie chart of the four options. The signal is in **Q14 reasoning**. Open-code into themes:

| Theme | Example phrase | What it tells you |
|---|---|---|
| Cash flow | "don't want recurring", "monthly adds up" | One-time preference is liquidity-driven, not value-driven |
| Commitment-aversion | "want to cancel anytime", "no lock-in" | Subscription preference — even at higher LTV |
| Skin-in-the-game | "want to feel I own it", "don't want a SaaS bill" | One-time, but signals premium willingness |
| Pay-as-you-use | "only when I post", "variable usage" | Pay-per-Reel — usually low-volume users |
| Risk-pricing | "don't trust it'll work yet" | Any model — they're discounting for uncertainty |

If Q14 themes contradict Q13 selection (e.g., they picked "monthly" but wrote "I hate recurring"), tag as low-confidence preference.

## 5 — Specificity rubric for Q15

Manually score each Q15 answer 1–4:

| Score | Label | Marker |
|---|---|---|
| 1 | Vague | "business content", "stuff about my work", "something useful" |
| 2 | Generic | Names a topic but no hook/format ("posts about my coaching") |
| 3 | Specific | Topic + audience or format ("Reels about positioning frameworks for B2B founders") |
| 4 | Very specific | Topic + audience + format + hook style + frequency ("contrarian-take Reels on positioning, talking head, weekly, for solo agency owners") |

**Specificity score correlates strongly with real intent.** A Q19=Yes from a Q15-score=1 respondent is mostly noise. A Q19=Maybe from a Q15-score=4 is a high-quality lead.

## 6 — Critical-question themes (Q18)

Open-code Q18 ("most likely reason this fails as a business") into the standard failure-mode taxonomy:

| Bucket | Signal |
|---|---|
| **Market** | "no one wants this", "TAM too small", "wrong audience" |
| **Founder** | "you'll lose interest", "you don't have the expertise", "needs full-time founder" |
| **Model** | "unit economics", "CAC > LTV", "wrong pricing", "wrong shape" |
| **Distribution** | "you can't reach them", "marketing is the problem", "no GTM" |
| **Product** | "tech won't work", "AI isn't good enough yet", "output will look fake" |
| **Timing** | "too early", "wave already passed", "competition will eat it" |
| **Trust** | "people won't put their face on AI", "ick factor", "platform risk" |

The most-cited bucket is your **biggest unaddressed risk.** Build the next iteration of the spec around mitigating it.

## 7 — Cross-cuts worth running

- **Compliance bias check**: filter responses where `answer_changed.q8` is false AND `q8` is short (<50 chars) AND `q19` = "Yes". This is the "polite supportive friend" signal — they didn't even reconsider their worry, but said yes anyway. Discount their commitment.
- **Genuine engagement check**: filter responses where `back_count > 0` AND `total_session_ms > 5min`. People who went back and took time = thinking carefully. Their open-text answers are gold.
- **UTM segmentation**: split by `utm_source`. WhatsApp DMs from close friends will skew compliant; LinkedIn cold-ish replies will be more honest. Compare Q19 conversion rates across sources.
- **Device skew**: mobile vs desktop dwell on Q15. Mobile thumb-typing produces shorter answers — adjust specificity-rubric expectations downward for mobile.

## 8 — What NOT to over-read

- **Q19 Yes count**: this is stated commitment, not money on the table. Multiply by ~0.3 to estimate actual deposit conversion.
- **Q6 slider mean**: friends will skew positive (3+). Compare distribution shape, not the mean.
- **Q11 "good deal" mean**: warm audiences anchor low. The OPP from the full Van Westendorp curve is more reliable than the raw Q11 mean.

## 9 — Headline numbers to publish in the writeup

- Sample size (completed, partial)
- Optimal Price Point with confidence interval
- Drop-off rate per section
- Top 3 critical-question themes from Q18
- % of respondents whose Q15 scored 3+ (the "real intent" cohort)
- Q19 Yes-rate within the real-intent cohort vs overall
