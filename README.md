# B.Sc Nursing Admission Landing Pages — Netlify-Ready Static Site

Four state-targeted lead-capture landing pages for a Punjab-based B.Sc Nursing
college. Built as **plain HTML + CSS + JS** (no build step, no framework) so it
can be drag-and-dropped onto Netlify or hosted on any static CDN.

```
/                 → state chooser (links to the 4 routes)
/himachal/        → landing page for Himachal Pradesh
/jammu/           → landing page for Jammu / J&K
/haryana/         → landing page for Haryana
/delhi/           → landing page for Delhi NCR
```

Mobile-first, designed for Android / 4G / low-end-phone traffic. Target:
Lighthouse mobile > 90, LCP < 2s, form fillable within 10 seconds after a
pitch video.

---

## Deploy

### Option A — drag & drop (fastest)
1. Zip the entire folder.
2. Visit [app.netlify.com/drop](https://app.netlify.com/drop) and drop the zip.
3. Done. No build step needed.

### Option B — connect to Git
1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import from Git** → pick this repo.
3. **Build command:** (leave empty). **Publish directory:** `.` (root).
4. Deploy. `netlify.toml` already wires clean URLs and cache headers.

Clean URLs without trailing slash are redirected to the folder index (e.g.
`/himachal` → `/himachal/`). See `_redirects` and `netlify.toml`.

---

## File structure

```
/
├── index.html                      # state chooser
├── himachal/index.html             # ← state pages share the same template
├── jammu/index.html
├── haryana/index.html
├── delhi/index.html
├── assets/
│   ├── css/styles.css              # design system (one file, ~600 lines)
│   ├── js/states.js                # SINGLE SOURCE OF TRUTH for state copy/data
│   ├── js/main.js                  # form validation, FAQ, exit-intent, analytics
│   └── images/
│       ├── hero/{state}-hero.svg   # 4 hero placeholders
│       ├── hostel/*.svg            # 6 hostel gallery placeholders
│       ├── testimonials/*.svg      # 12 testimonial avatar placeholders
│       └── placeholder.svg         # source SVG used to seed all stubs
├── netlify.toml                    # deploy config + headers + redirects
├── _redirects                      # fallback for clean URLs
├── robots.txt
└── sitemap.xml
```

---

## How to swap content

### 1. State copy & districts
Open **`assets/js/states.js`**. This is the single source of truth — same data
that drives all 4 pages. Edit any of:

- `displayName`, `heroSubheadEnglish`, `heroSubheadRegional` (Hindi / Punjabi)
- `whatsappPrefill` (prefilled message when user taps WhatsApp)
- `districts[]` (used to populate the city dropdown for that state)
- `usps[]` (5–7 bullet points shown under the hero)
- `testimonials[]` (3 per state; one can include a `videoUrl` for a video card)
- `faqs[]` (8–10 Q&A per state)
- `ogTitle` / `ogDescription` (also set in the HTML `<head>` for crawlers)

Changes here update all pages on next reload — no build step.

### 2. Page-level meta (title, OG image, canonical)
The static `<head>` of each `*/index.html` carries the title, description, OG
tags, canonical URL, and the preload hint for the hero image. Edit per state.

### 3. Replace placeholder images
The hero/hostel/testimonial slots all reference `assets/images/*.svg`. To swap
in real photos:

1. Drop your photos into `assets/images/hero/`, `assets/images/hostel/`,
   `assets/images/testimonials/` (any extension: `.jpg`, `.png`, `.webp`).
2. Update the paths in **`assets/js/states.js`** (hero + testimonial photos)
   and **each `*/index.html`** for the 6 hostel gallery tiles.
3. Recommended sizes:
   - Hero: 1200×900 (4:3) — keep under 200 KB, prefer WebP
   - Hostel gallery: 600×600 (square)
   - Testimonial avatar: 200×200 (square)
4. Replace the `<link rel="preload" as="image" href="...">` in each page's
   `<head>` so the LCP image still preloads.

### 4. Phone / WhatsApp numbers
- Edit `WHATSAPP_NUMBER` and `CALL_NUMBER` at the top of `assets/js/main.js`.
- Update the `tel:` hrefs in the footer + mobile bar of each `*/index.html`.

---

## Lead form: where do submissions go?

Out of the box, **`submitLead()`** in `assets/js/main.js` just logs the lead
payload to the browser console and returns success. This keeps the success UX
testable locally before any backend is wired.

Pick one of the integrations below.

### Option 1 — Netlify Forms (simplest, no backend)
1. In each `<form class="lead-form">` add: `data-netlify="true" name="lead-form-{state}"`.
2. Add a hidden honeypot: `<input type="hidden" name="form-name" value="lead-form-himachal">`.
3. Replace the body of `submitLead()` with:
   ```js
   function submitLead(data) {
     var body = new URLSearchParams();
     body.append('form-name', 'lead-form-' + data.state);
     Object.keys(data).forEach(function (k) {
       body.append(k, typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
     });
     return fetch('/', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: body.toString(),
     }).then(function (r) {
       if (!r.ok) throw new Error('netlify_forms_failed');
       return r;
     });
   }
   ```
4. Submissions appear in **Netlify → Forms** dashboard.

### Option 2 — Netlify Function → your CRM
1. Create `netlify/functions/leads.js`:
   ```js
   exports.handler = async function (event) {
     const payload = JSON.parse(event.body);
     // forward to Zoho / Salesforce / HubSpot / Sheets here
     await fetch(process.env.CRM_WEBHOOK_URL, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(payload),
     });
     return { statusCode: 200, body: JSON.stringify({ ok: true }) };
   };
   ```
2. In `assets/js/main.js` replace `submitLead()` with a `fetch` to
   `/.netlify/functions/leads`.

### Option 3 — Direct webhook (Google Sheets / Make / Zapier)
Replace `submitLead()` with a single `fetch` to your webhook URL. CORS-safe
endpoints work directly from the browser.

### Fallback — WhatsApp deep-link (always on)
If the API call fails, `main.js` automatically deep-links the user to WhatsApp
with their form data pre-filled in the message. Nothing to configure.

---

## Lead payload contract

Every submission contains:

```ts
{
  fullName: string;
  mobile: string;            // 10 digits, validated against /^[6-9]\d{9}$/
  whatsappSameAsMobile: bool;
  whatsapp?: string;         // only if not same as mobile
  email?: string;
  city: string;              // from state's district dropdown
  twelfthStatus: 'Appearing' | 'Passed' | 'Result Awaited';
  twelfthPercentage?: string;
  hostelRequired: 'Yes' | 'No';
  bestTimeToCall?: 'Morning' | 'Afternoon' | 'Evening';
  consent: true;             // GDPR-style consent
  state: 'himachal' | 'jammu' | 'haryana' | 'delhi';
  formLocation: 'mid-page' | 'bottom' | 'quick-apply' | 'exit-intent';
  pageUrl: string;
  referrer: string;
  timestamp: string;         // ISO 8601
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}
```

## WhatsApp Business API webhook contract

When forwarding to a WhatsApp Business webhook (template message
acknowledgement to the student), POST this JSON:

```jsonc
{
  "to": "+91XXXXXXXXXX",                     // student's E.164 mobile
  "type": "template",
  "template": {
    "name": "lead_acknowledgement",          // pre-approved template
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "<student_name>" },
          { "type": "text", "text": "<state>" },
          { "type": "text", "text": "<counsellor_name>" }
        ]
      }
    ]
  },
  "metadata": {
    "lead_id": "<uuid>",
    "source_page": "/<state>/",
    "utm": { "source": "...", "medium": "...", "campaign": "..." },
    "submitted_at": "<iso8601>"
  }
}
```

---

## Analytics IDs — where to plug them

Each `*/index.html` has commented-out blocks in `<head>` for **GA4** and
**Meta Pixel**. Uncomment, replace `G-XXXXXXXXXX` (GA4 Measurement ID) and
`PIXEL_ID` (Meta Pixel ID), and you're done. The site already fires the
following events through `window.gtag` and `window.fbq`:

| Event                     | GA4                  | Meta Pixel    | Fires when                       |
|---------------------------|----------------------|---------------|----------------------------------|
| Page view                 | `page_view`          | `PageView`    | Page load                        |
| Form start                | `form_start`         | —             | First focus on any form field    |
| Field abandon             | `form_field_abandon` | —             | Field blurred empty for >5s      |
| Lead submitted            | `generate_lead`      | `Lead`        | Successful submit (any form)     |
| CTA click                 | `cta_click`          | —             | Any "Apply Now" / hero / fee CTA |
| WhatsApp click            | `whatsapp_click`     | `Contact`     | Any WhatsApp link or icon        |
| Exit-intent shown         | `exit_intent_open`   | —             | Desktop mouseleave (once/session)|

Every event is also `console.log`-ged for QA — open DevTools and submit a form
to verify.

---

## Performance / Lighthouse notes

- No JS framework. Single CSS file. Single JS file (+ `states.js`). Total
  page weight < ~30 KB minified + gzipped (excluding the hero image).
- Hero image is `<link rel="preload" as="image">` and `fetchpriority="high"`
  to win LCP on slow Android devices.
- Fonts are loaded from `fonts.googleapis.com` with `preconnect`. Swap to
  self-hosted woff2 for offline / India-edge performance gains.
- All non-critical images use `loading="lazy"`.
- Netlify cache headers in `netlify.toml` immutably cache `/assets/css` and
  `/assets/js` (busts on filename change — bump filenames if you edit them).
- iframes (YouTube embeds in testimonials + hero) are lazy-loaded so they
  don't block first paint.

---

## Conversion features baked in

- **Above-the-fold form on mobile** (`Quick Apply` 3-field tray) — student
  can finish the form within 10 seconds of the pitch video ending.
- **Forms render TWICE** (mid-page + bottom of page).
- **Exit-intent popup** on desktop only — 2 fields, fires once per session
  (sessionStorage gated).
- **WhatsApp fallback** when API fails — deep-link with form data prefilled.
- **Sticky mobile bottom bar** with full-width Call / WhatsApp / Apply
  buttons (≤768px only).
- **Trust badges** (INC / NMC / University) above the fold.
- **Counter strip** (placed / batches / hostel beds) above the fold.
- **Privacy microcopy** near every submit button.
- **Hidden UTM capture** + page URL + referrer + timestamp on every lead.
- **Field-level abandonment tracking** for funnel analysis.
- **JSON-LD structured data**: `EducationalOrganization` + `Course` on each
  state page for SEO.
- **OG / Twitter cards** with per-state title, description, and hero image.

---

## QA checklist

- [ ] Visit `/`, `/himachal/`, `/jammu/`, `/haryana/`, `/delhi/` — each renders
- [ ] Open DevTools console — see `[analytics] page_view` log
- [ ] Submit each form (mid-page, bottom, quick-apply, exit-intent) — see
      `[lead] payload` and `[analytics] generate_lead` logs
- [ ] Toggle "WhatsApp same as mobile" checkbox — WhatsApp field appears/hides
- [ ] Change "12th Status" to "Passed" — percentage field appears
- [ ] Submit with invalid mobile — inline error appears, focus moves
- [ ] Resize to mobile width — Quick Apply tray visible above the fold,
      sticky bottom bar appears
- [ ] Trigger exit intent on desktop (move cursor to top edge) — modal opens
      once, sessionStorage prevents repeat
- [ ] WhatsApp links open `wa.me/91…` with the prefilled state-specific message
- [ ] Run Lighthouse mobile — target > 90 (replace placeholders with real
      optimized images to reach this)

---

## Out of scope (intentional)

- Real CRM integration (a stub `submitLead()` is provided + integration
  recipes above)
- Real CMS (content lives in `assets/js/states.js`)
- Payment gateway
- Real OTP / SMS verification
- Real hero / hostel / testimonial photos (SVG placeholders ship; swap
  documented above)

---

## Licence

Internal admissions marketing site. All copy and imagery are placeholders —
verify your own facts before going live.
