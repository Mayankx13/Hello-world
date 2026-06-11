# AiEZ — landing page

Production build of the approved AiEZ landing mockup (Claude Design handoff,
hero variant A "Masthead"). Next.js 14 App Router + TypeScript, Tailwind design
tokens, Framer Motion for scroll-reveals and plate-number transitions, React
Hook Form + Zod for the booking form. Deploys to Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

`npm run build && npm start` for a production build.

## Environment variables

Documented in [`.env.example`](./.env.example):

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata/OG/JSON-LD/sitemap |
| `NEXT_PUBLIC_GTM_ID` | GTM container (omitted → no GTM injected) |
| `BOOKING_WEBHOOK_URL` | n8n webhook that receives bookings (server-only) |

## How it's wired

- **Copy** — every string lives in [`lib/content.ts`](./lib/content.ts).
  Reel posters/videos and testimonial photos are wired there too: set
  `poster`/`video`/`photo` to a `/public` path (or `image.mux.com` URL) and
  the placeholder swaps for real media with zero layout shift. Demo video is
  poster-first: the `<video>` element only mounts on play.
- **Booking** — `components/BookingForm` validates with the shared Zod schema
  ([`lib/schema.ts`](./lib/schema.ts), Indian WhatsApp numbers normalised to
  `+91XXXXXXXXXX`), POSTs to `app/api/book`, which forwards to
  `BOOKING_WEBHOOK_URL` with `submittedAt` + `source`. Success is an inline
  state — no redirect. A honeypot field silently drops bot submissions.
- **Analytics** — `lib/analytics.ts` pushes `view_sprint_details`,
  `cta_click` and `book_sprint` to the GTM dataLayer. Configure the Facebook
  Pixel inside the GTM container against those events; nothing
  pixel-specific ships in the bundle.
- **SEO** — Metadata API (title/description/canonical/OG/Twitter), generated
  OG image (`app/opengraph-image.tsx`), JSON-LD `ProfessionalService` in
  `app/page.tsx`, `robots.ts` + `sitemap.ts`.
- **Motion** — `components/Reveal` and `components/PlateHead` are the only
  animated pieces; both render static under `prefers-reduced-motion`.
- **Booking slots** — the month ledger in section 08 is placeholder copy in
  `content.ts`; wire it to the real calendar when ready.

---

# Hello-world
First repository

 Hello! Github

 I'm Mayank.I love programming and am greatly inspired.Computer systems and their develpment is my core passion.
 Currently i am a student pursuing B.Tech in computer science.
 I'm always keen to explore new technologies and learning them.
 Hopefully i will have a great time on Github learning them and start using to build my own projects.
