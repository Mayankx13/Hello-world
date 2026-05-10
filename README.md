# B.Sc Nursing Landing Pages — Punjab Campus

4 state-targeted lead-capture landing pages for North Indian aspirants.

**Routes:** `/himachal` · `/jammu` · `/haryana` · `/delhi`

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000/himachal
```

---

## Project Structure

```
app/
  (landing)/
    himachal/page.tsx      # Himachal Pradesh landing page
    jammu/page.tsx         # Jammu landing page
    haryana/page.tsx       # Haryana landing page
    delhi/page.tsx         # Delhi landing page
  api/leads/route.ts       # Lead capture API (stub — logs to console)
components/landing/
  LandingPage.tsx          # Assembler — reads StateConfig, renders all sections
  StickyHeader.tsx         # Fixed header with logo, nav, WhatsApp, Apply CTA
  Hero.tsx                 # Above-fold hero with animated counters
  WhyUs.tsx                # State-specific USP grid
  HostelShowcase.tsx       # Photo gallery + feature grid
  CourseDetails.tsx        # Curriculum, fees, scholarships
  Placements.tsx           # Career pathways, recruiters
  Testimonials.tsx         # 3 per state + video slot
  FAQ.tsx                  # 8-10 state-specific Q&As (with schema.org markup)
  LeadForm.tsx             # Full & mini variants, React Hook Form + Zod
  StickyMobileBar.tsx      # Fixed bottom: Call / WhatsApp / Apply
  ExitIntent.tsx           # Desktop exit-intent popup (mouse leaves viewport)
  Footer.tsx               # Address, social, links
config/
  states.ts                # Single source of truth — all 4 state configs
lib/
  analytics.ts             # GA4, Meta Pixel, console-log hooks
  whatsapp.ts              # URL builders for WhatsApp deep-links
  schema.ts                # Zod lead schema + TypeScript CRM interface
```

---

## How to Swap Images

All images are referenced by path. Place real files in `/public/images/`:

| Image | Path | Recommended size |
|-------|------|-----------------|
| Hero — Himachal | `/public/images/hero-himachal.jpg` | 1200x675px, WebP |
| Hero — Jammu | `/public/images/hero-jammu.jpg` | 1200x675px, WebP |
| Hero — Haryana | `/public/images/hero-haryana.jpg` | 1200x675px, WebP |
| Hero — Delhi | `/public/images/hero-delhi.jpg` | 1200x675px, WebP |
| OG image each state | `/public/images/og-<slug>.jpg` | 1200x630px, JPEG |
| College logo | `/public/images/logo.png` | 200x200px, PNG |
| Hostel photos (6) | `/public/images/hostel/room.jpg` etc. | 800x500px, WebP |
| Testimonial photos | `/public/images/testimonials/<name>.jpg` | 300x300px, WebP |

Update `HOSTEL_PHOTOS` in `components/landing/HostelShowcase.tsx` to add/remove gallery photos.

---

## How to Update State Configs

All content lives in `config/states.ts`. Changes there auto-propagate to all 4 pages.

### Add a new USP for a state
```ts
himachal: {
  usps: [
    ...existing,
    { icon: 'your-emoji', title: 'New USP', desc: 'Description.' },
  ],
},
```

### Update college constants (fees, phone, address)
Edit the `COLLEGE` object at the top of `config/states.ts`. One change reflects everywhere.

### Add a new state
1. Add a new entry to `stateConfigs` in `config/states.ts`
2. Create `app/(landing)/<state>/page.tsx` (copy any existing page, change the config key)
3. Fill districts, USPs, testimonials, FAQs

---

## Lead Capture — Google Form (primary)

Leads are sent **directly to a Google Form** from the browser. No CRM, no
webhook server, no env vars. Free, instant, and connects to Google Sheets
in one click.

### Setup (5 minutes)

1. Open [forms.google.com](https://forms.google.com) and create a new form
   with these 17 questions (matching the names in `lib/googleForm.ts`):

   | Question | Type |
   |---|---|
   | Full Name | Short answer |
   | Mobile Number | Short answer |
   | WhatsApp Same | Multiple choice (Yes / No) |
   | Email | Short answer |
   | State | Short answer |
   | District | Short answer |
   | 12th Status | Multiple choice (appearing / passed / result_awaited) |
   | 12th Percentage | Short answer |
   | Hostel Required | Multiple choice (Yes / No) |
   | Best Time To Call | Multiple choice (morning / afternoon / evening) |
   | Form Position | Short answer |
   | UTM Source | Short answer |
   | UTM Medium | Short answer |
   | UTM Campaign | Short answer |
   | Page URL | Short answer |
   | Referrer | Short answer |
   | Timestamp | Short answer |

   In each question's settings, **uncheck "Required"** for the optional ones
   (email, percentage, best time to call, all UTM/tracking fields).

2. Click **Send → Link tab → copy URL**. The `FORM_ID` is the long string
   between `/d/e/` and `/viewform`. Paste it into `lib/googleForm.ts`:
   ```ts
   formId: 'PASTE_FORM_ID_HERE',
   ```

3. **Get each field's `entry.NNNNNNNNNN` ID** (the trick):
   - Open the live form
   - Right-click → **View Page Source**
   - `Ctrl-F` for `entry.` — each question has a unique numeric ID
   - Map each question to its entry ID in the `fields` object in
     `lib/googleForm.ts`

   *Alternative (easier):* Click the form's `⋮` menu → **Get pre-filled link**
   → fill each field with junk text → click **Get link**. The URL contains
   `entry.NNNNNNNNNN=junk` for every field.

4. Set `enabled: true` in `lib/googleForm.ts`:
   ```ts
   export const GOOGLE_FORM = {
     enabled: true,  // ← flip this
     formId: 'your_real_form_id',
     fields: { /* your real entry IDs */ },
   };
   ```

5. **Connect Google Form to Google Sheets** (optional but recommended):
   In the form, click **Responses → Link to Sheets**. Every submission
   appears as a row. You now have a free CRM-style view.

### Why Google Form
- **Zero backend** — no env vars, no API keys, no server costs
- **Email alerts** — turn on Form Settings → Email notifications for
  instant counsellor alerts
- **Sheets integration** — see all leads in a sortable spreadsheet
- **No CORS issues** — the client posts directly with `mode: 'no-cors'`

### What happens when `enabled: false` (default state)
- The form *appears* to submit successfully (good UX during dev/demo)
- Lead is logged to browser DevTools console + server `/api/leads` console
- A console warning reminds you to configure the form
- The thank-you screen + WhatsApp redirect still fires — **the user flow is
  fully testable without setup**

### Server log fallback (for QA)
The `/api/leads` route still receives every submission in parallel and logs
the full typed `LeadPayload` to the server console. This is purely for QA
visibility — it's non-blocking and not the source of truth.

---

## Replace Analytics IDs

### GA4
In `app/layout.tsx`, replace `G-XXXXXXXXXX` with your real Measurement ID.

### Meta Pixel
In `app/layout.tsx`, replace `XXXXXXXXXXXXXXXXX` with your real Pixel ID.

---

## Performance Notes

- **LCP target < 2s**: Hero images use `priority` prop (preloaded). Use WebP format.
- **Fonts**: Loaded via `next/font/google` (self-hosted, zero external request at render).
- **Images**: `next/image` handles lazy loading, WebP/AVIF conversion.
- **Mobile-first**: Form above fold on 6.1" screen. Sticky bottom bar has 3 thumb-reachable CTAs.
- **Bundle**: No heavy dependencies. Lucide icons tree-shaken per-import.

---

## Lighthouse Optimization Checklist

- [ ] Replace hero placeholder images with optimized WebP photos
- [ ] Set real GA4 + Pixel IDs
- [ ] Add `robots.txt` and `sitemap.xml`
- [ ] Test Lighthouse on throttled 4G (Moto G4 profile in DevTools)
- [ ] Enable Next.js image optimization CDN in production

---

## Out of Scope (Stubs)

| Feature | Status | To Implement |
|---------|--------|-------------|
| CRM integration | Stub (console.log) | Uncomment webhook in `api/leads/route.ts` |
| WhatsApp Business API | Payload documented | POST to WA API from same route |
| Payment gateway | Not built | Add Razorpay in a new `/api/payment` route |
| OTP verification | Not built | Add `/api/otp/send` + `/api/otp/verify` |
| Email confirmation | Not built | Use Resend/Nodemailer in `api/leads/route.ts` |
