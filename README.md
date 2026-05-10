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

## Plug Real Lead Webhook

The API stub is in `app/api/leads/route.ts`. Uncomment and configure:

```ts
await fetch(process.env.CRM_WEBHOOK_URL!, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.CRM_API_KEY}`,
  },
  body: JSON.stringify(leadPayload),
});
```

### Required env vars — create `.env.local`
```env
CRM_WEBHOOK_URL=https://your-crm.com/api/leads
CRM_API_KEY=your_api_key_here
WHATSAPP_API_URL=https://api.whatsapp.business/v1/messages
WHATSAPP_API_TOKEN=your_wa_token_here
COLLEGE_WHATSAPP_NUMBER=919876543210
```

### WhatsApp Business API payload contract
```ts
// Defined in lib/analytics.ts -> WhatsAppLeadPayload
{
  to: "91XXXXXXXXXX",
  templateName: "nursing_lead_confirmation_v1",
  params: {
    studentName: string,
    state: string,
    district: string,
    mobileForCallback: string,
    collegeWhatsapp: string,
  },
  metadata: { utmSource, utmMedium, utmCampaign, pageUrl, referrer, timestamp }
}
```

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
