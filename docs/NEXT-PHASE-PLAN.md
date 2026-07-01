# LIQO — Next Phase Plan: Customer Education + Interactive Product Experience

Status: **PLAN (not yet built)**. Scope requested: (1) a module to *educate
customers about their product choices*, and (2) for each recommended product, a
*display/interactive page* to see more detail and the *look-and-feel of the
appliance placed in the customer's home*.

This builds on the existing stack — React + Vite PWA, two Cloudflare Workers,
D1, the pure deterministic engine — and reuses patterns already in the repo
(admin-editable config in D1, LLM copy via `worker-api/src/llm.ts`, the new
central `audit_log`).

---

## Module A — Customer Education ("Know before you buy")

**Goal:** help the shopper understand *why* a spec matters for *their* situation,
in plain warm language + visuals, so the recommendation is trusted and the
purchase is confident. Educated buyers convert better and return less.

### A.1 Where it appears
- **Inline in the guided flow** — each Profiler question gains a "Why we ask"
  explainer (one tap to expand) tying the choice to the outcome (e.g. *room size
  & sun → AC tonnage*, *family size → fridge litres*, *viewing distance → TV
  size*, *front vs top load → wash quality & water use*).
- **A per-category "Learn" surface** — short, visual explainers a salesperson can
  walk a customer through, or the customer can browse on the kiosk.
- **On the result card** — an expandable "What this means for you" that connects
  *this product's* specs to the customer's stated needs (deepens today's
  `fitLine`).

### A.2 Interactive learning aids (deterministic, client-side)
Small calculators that share the engine's own reference tables (single source of
truth — `CAPACITY_ORDINAL` in `src/engine/tags.ts`), so education and ranking can
never disagree:
- **AC:** room area + floor/sun → suggested tonnage.
- **Fridge:** household size + cooking habits → suggested litres.
- **TV:** viewing distance → comfortable screen size.
- **Washer:** family size + frequency → suggested kg + front/top guidance.

Each calculator can **pre-fill the questionnaire answers**, bridging *education →
recommendation* in one motion (the calculator's result maps to the same engine
tags the Profiler produces).

### A.3 Content model
- New admin-editable content, mirroring how `config`/`questionnaire` already live
  in D1 and are edited live from the admin screens.
- Table `education_topics(id, category, key, title_en, title_hi, body_en,
  body_hi, media_url, engine_tags, sort_order, active)`.
- **LLM assist:** reuse `llm.ts` (Haiku 4.5) to *draft & localise* topic copy
  from the product/category context; admin reviews & approves before publish
  (same guardrail as the D.3 questionnaire suggestions). Never auto-published.
- Edits are captured automatically by the new `audit_log` (who changed which
  topic, when).

---

## Module B — Interactive Product Detail + In-Home Visualization

**Goal:** every recommended product opens a rich detail page, culminating in a
"see it in your space" visualizer so the customer feels the *look and feel* of
the appliance at home before buying.

### B.1 Product detail page (`ProductDetail(sku)`)
A new screen reachable from every result card ("See details & try in your room"):
- Media gallery (images / 360° spin / short video).
- Full spec table (capacity, energy rating, dimensions, features, warranty).
- **Running-cost estimate** — energy label kWh × local tariff → ₹/year, so
  "5-star costs less" becomes a concrete number (deterministic, honest).
- EMI schedule + applicable live offers (reuse `offers` + engine boost data).
- "Why it fits you" (from the engine's `fitReasons`) + honest pros/con.
- **Fits-my-space check** — enter alcove W×H×D → green/red against the product's
  dimensions + clearance. High value for fridges, washers, ACs.
- CTAs wire back into the existing flow (`choose` → Attach → Summary), so nothing
  about the proven journey is lost.

### B.2 "See it in your home" — progressive visualization
Delivered in the browser (no app install), degrading gracefully so *every*
product has *some* visualization:
1. **Photo composite (MVP, universal):** customer photographs the wall/corner;
   overlay a scaled transparent PNG of the appliance; drag/resize against a
   known reference (e.g. a door width) for true scale. Pure `<canvas>`, works on
   every phone, needs only a cut-out image + real dimensions.
2. **3D + AR (`<model-viewer>`):** Google's `@google/model-viewer` web component
   renders a GLB and offers **"View in your room"** AR — WebXR on Android/Chrome,
   AR Quick Look (USDZ) on iOS/Safari — with no native app. This is the true
   "appliance placed in their home" experience, lazy-loaded only on the detail
   page to keep the PWA fast.
3. **Fallback:** static gallery + dimension fit-check when no 3D/photo asset
   exists yet.

### B.3 Data + assets
- `product_media(sku, kind ['image'|'spin'|'video'|'glb'|'usdz'], url,
  sort_order)`.
- Extend product attributes: `dimensions_mm_w/h/d`, `weight_kg`,
  `energy_kwh_year`, `warranty_months`, feature bullets (either new columns on a
  `product_specs(sku, …)` table or an attributes JSON — keep 3NF, FK to
  `inventory(sku)`).
- **Media hosting:** add a Cloudflare **R2** bucket (`liqo-media`) — same account,
  served via the Worker or a public bucket — with an admin upload flow. URLs only
  in D1; no PII, safe for the public repo.
- **Asset bootstrapping (the main dependency):** 3D/photo assets per SKU are the
  real cost at ~2,000 SKUs. Mitigations, in order: start with top-sellers / one
  hero model per brand-series; ingest brand asset feeds where available; use
  category placeholders; the photo-composite path needs only a transparent PNG +
  dimensions (far cheaper than GLB), so it can cover the long tail first.

---

## Suggested phasing (each independently shippable to dev)

| Phase | Deliverable | Notes |
|------|-------------|-------|
| **E1** | Product Detail page: specs + gallery + running-cost + EMI + fits-my-space | No AR yet; add `product_specs`/`product_media` + admin upload (R2) |
| **E2** | Education layer: per-question "why we ask", category Learn surface, calculators that pre-fill the questionnaire | `education_topics` table; LLM-drafted, admin-approved copy |
| **E3** | In-home visualization: photo-composite MVP → `<model-viewer>` 3D/AR where assets exist | lazy-loaded; graceful fallback chain |
| **E4** | Engagement analytics: detail views, visualizer use, education taps feed sessions + demand + audit; optionally nudge ranking | closes the loop; all edits already audit-logged |

## Cross-cutting
- **DBMS:** new tables normalized, FK'd to `inventory(sku)`/category, indexed;
  admin edits captured by `audit_log` automatically.
- **Performance:** heavy libs (`model-viewer`) load only on the detail route; PWA
  stays lean; assets on R2 + cache.
- **i18n:** every new string bilingual (en/hi), like the rest of the app.
- **Device coverage:** photo-composite is universal; AR is a progressive
  enhancement, never a hard dependency.
- **Governance:** media is non-PII (URLs); nothing dealer-confidential ships to
  the public repo.

## Open questions for product sign-off
1. Asset strategy: do brands provide 3D/USDZ models, or do we start photo-only?
2. Energy tariff: single ₹/kWh assumption vs per-region editable in config?
3. Education tone/depth: quick chips vs longer explainers — and how much LLM copy
   vs hand-written?
4. Do we gate the visualizer to in-store kiosks, or expose it to customers on
   their own phones (shareable link)?
