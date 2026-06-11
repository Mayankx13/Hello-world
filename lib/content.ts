/**
 * All site copy lives here for fast iteration.
 * Strings are verbatim from the approved AiEZ mockup (hero variant A — Masthead).
 *
 * Media: every reel/photo slot accepts an optional `poster`/`src` (path under
 * /public or an allowed remote URL — see next.config.mjs) and reels accept an
 * optional `video` (self-hosted MP4 or Mux playback URL). Until provided, the
 * slot renders the mockup's cream placeholder. Video loads poster-first and
 * only mounts the <video> element on play.
 */

export const site = {
  name: "AiEZ",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  title: "AiEZ — Your clone publishes daily. You don't.",
  description:
    "AiEZ builds a studio-grade clone of you — voice and avatar, trained on one capture day — and turns it into a month of reels. Every script, every frame, approved by you before it ships.",
  tagline: "Bombay & the internet.",
  ogHeadline: "Your clone publishes daily. You don't.",
};

export const nav = {
  ariaLabel: "Site",
  sectionsAriaLabel: "Sections",
  links: [
    { num: "02", href: "#shift", label: "The shift" },
    { num: "03", href: "#how", label: "How it works" },
    { num: "04", href: "#system", label: "The system" },
    { num: "05", href: "#proof", label: "Proof" },
    { num: "06", href: "#sprint", label: "Sprint details" },
    { num: "07", href: "#faq", label: "FAQ" },
    { num: "08", href: "#book", label: "Book" },
  ],
  cta: "Book a Sprint",
};

export const hero = {
  kicker: "01 · AI clone content system — human-approved",
  headline:
    "Your face, your voice, your ideas — publishing daily. Without you filming daily.",
  lede: "AiEZ builds a studio-grade clone of you — voice and avatar, trained on one capture day — and turns it into a month of reels. Every script, every frame, approved by you before it ships.",
  primaryCta: "Book your Calibration Sprint",
  secondaryCta: "Watch a clone reel",
  trust: {
    audience: "For high-ticket coaches, consultants & agency founders",
    location: "Bombay & the internet.",
  },
  reel: {
    caption: "Clone Reel № 4 — avatar-led",
    duration: "0:42",
    placeholder: "clone reel · 9:16 poster",
    poster: undefined as string | undefined,
    video: undefined as string | undefined,
  },
};

export const shift = {
  num: "02",
  label: "The shift",
  heading:
    "You built a business on trust. Then the feed asked you to become a daily performer.",
  treadmill: {
    tag: "The founder-content treadmill",
    heading: "Filming yourself, forever",
    items: [
      "Block Thursday to film. Reschedule it for a client escalation. Again.",
      "Batch eight reels in one afternoon — and watch your energy die by take six.",
      "Skip two weeks during delivery season; watch reach fall off a cliff.",
      "Pay an editor who needs you on camera before they can do anything at all.",
      "Know exactly what you'd say — and never have the hours to say it.",
    ],
  },
  clone: {
    tag: "The clone system",
    heading: "Filming once, compounding daily",
    items: [
      "One capture day a month, on a good day, at your best.",
      "Your clone carries the delivery on the other twenty-nine.",
      "Scripts written from your transcripts and calls — not a prompt's idea of you.",
      "You approve every reel on WhatsApp before it exists publicly.",
      "Cadence holds through launches, travel, and delivery season.",
    ],
  },
  pullQuote:
    "The problem was never your ideas. It's that distribution demands a daily performance — and you already have a day job.",
};

export const how = {
  num: "03",
  label: "How it works",
  heading: "Three steps. The first two are a pilot you can walk away from.",
  steps: [
    {
      num: "03·1",
      heading: "Capture Day",
      body: "One studio session in Bombay — or we bring the kit to you. Three hours on camera at your best: angles, outfits, energy, delivery. This footage trains your avatar and banks a library of your real presence.",
      note: { lead: "Your only on-camera commitment. ", strong: "3 hours, once." },
    },
    {
      num: "03·2",
      heading: "Calibration Sprint",
      body: "Within ten working days you receive three finished reels — one in each format: talking-head, screen-share with your voiceover, and avatar-led. You review every script and every frame on WhatsApp. Nothing publishes without your sign-off.",
      note: { lead: "The pilot. ", strong: "You approve everything." },
    },
    {
      num: "03·3",
      heading: "The Monthly System",
      body: "If the Sprint earns it, we run the machine: a steady cadence of reels across all three formats, a monthly strategy memo, and a performance report. Your calendar stays clear; your face stays in the feed.",
      note: {
        lead: "The retainer — continued ",
        strong: "only if the pilot convinces you.",
      },
    },
  ],
};

export const system = {
  num: "04",
  label: "The system, not videos",
  heading: "Anyone can sell you videos. We're building you an asset.",
  lede: "Each month the retainer produces three artifacts beyond the reels themselves. They accumulate. That's the point.",
  accrueNote: {
    strong: "The compounding logic:",
    body: " month one, the system learns what your audience responds to. Month six, it knows — and every reel starts from that knowledge instead of a blank page.",
  },
  // Body parts: plain strings, or { em } for italic display type (em.brand-em).
  artifacts: [
    {
      num: "04·1",
      heading: "The strategy memo",
      body: [
        "A monthly one-pager: what we're saying, to whom, and why — mapped to your offer and your sales conversations. You read it in five minutes; it steers everything we make.",
      ] as ArtifactPart[],
    },
    {
      num: "04·2",
      heading: "The performance report",
      body: [
        "Not vanity dashboards. Which hooks held attention, which formats drove profile visits, which reels were watched by people who later booked calls. Decisions, not screenshots.",
      ] as ArtifactPart[],
    },
    {
      num: "04·3",
      heading: "The compounding hook library",
      body: [
        "Every hook we test gets logged with its result. By month three you own a private database of openings proven to stop ",
        { em: "your" },
        " audience — an asset no agency can take with them.",
      ] as ArtifactPart[],
    },
  ],
};

export const proof = {
  num: "05",
  label: "Proof",
  rvc: {
    kicker: "The test we invite you to fail",
    heading: "One of these is filmed. One is the clone.",
    sub: "No labels, no watermarks. Watch both, then pick the one you think is generated. This is the standard every reel must clear before it reaches your audience.",
    // Which card is actually the clone. The verdict copy below assumes "B".
    cloneIs: "B" as "A" | "B",
    cards: [
      {
        id: "A" as const,
        caption: "Reel A",
        duration: "0:34",
        placeholder: "reel A · 9:16 poster",
        pick: "A is the clone",
        poster: undefined as string | undefined,
        video: undefined as string | undefined,
      },
      {
        id: "B" as const,
        caption: "Reel B",
        duration: "0:34",
        placeholder: "reel B · 9:16 poster",
        pick: "B is the clone",
        poster: undefined as string | undefined,
        video: undefined as string | undefined,
      },
    ],
    verdictCorrect: {
      heading: "Correct — and it took you a moment.",
      body: "Your audience scrolls past in under a second. Reel B was scripted from a podcast transcript, rendered in 41 minutes, and approved on WhatsApp before it ever existed publicly.",
    },
    verdictWrong: {
      heading: "That one's the real footage.",
      body: "The clone is B — scripted from a podcast transcript, rendered in 41 minutes, approved on WhatsApp. If it can pass with you looking for it, it passes in the feed.",
    },
    note: "placeholder media — your real A/B pair is produced during the Sprint",
  },
  testimonials: [
    {
      flag: "Illustrative example",
      quote:
        "My ops head approved three reels on WhatsApp while I was at a family wedding in Jaipur. Nobody in my audience noticed I'd been gone two weeks.",
      who: "Leadership coach",
      detail: "₹2L+ programs · Mumbai",
      photo: undefined as string | undefined,
    },
    {
      flag: "Illustrative example",
      quote:
        'I was terrified of getting caught using AI. Then a prospect told me my "recent videos" felt more like me than my old ones. The scripts are from my own sales calls — that\'s why.',
      who: "Fractional CFO",
      detail: "Advisory retainers · Bangalore",
      photo: undefined as string | undefined,
    },
    {
      flag: "Illustrative example",
      quote:
        "The hook library alone is worth the retainer. We reused our top three openings in a webinar funnel and cut our cost per booked call by a third.",
      who: "Agency founder",
      detail: "Performance marketing · Gurgaon",
      photo: undefined as string | undefined,
    },
  ],
  metrics: [
    {
      label: "Publishing cadence",
      before: "3–4/mo",
      after: "20/mo",
      note: "Illustrative — typical client target after the first full month.",
    },
    {
      label: "Founder hours on content",
      before: "10–12 h",
      after: "3 h",
      note: "Illustrative — capture day amortised, plus WhatsApp approvals.",
    },
    {
      label: "Approval turnaround",
      before: "days",
      after: "< 10 min",
      note: "Illustrative — review happens where you already live: WhatsApp.",
    },
  ],
};

export const sprint = {
  num: "06",
  label: "The Calibration Sprint",
  heading: "A paid pilot, scoped so the only thing at risk is our reputation.",
  // `strong` substrings are emphasised inside the row copy by the component.
  included: [
    {
      term: "Duration",
      parts: ["One capture day, then ", { strong: "ten working days" }, " to finished reels."],
    },
    {
      term: "You receive",
      parts: [
        { strong: "Three finished reels" },
        " — talking-head, screen-share + voiceover, avatar-led — plus your trained voice and avatar models.",
      ],
    },
    {
      term: "Scripting",
      parts: [
        "Written from your transcripts, podcasts, and sales calls. You'll recognise your own phrasing — because it is.",
      ],
    },
    {
      term: "Approval rights",
      parts: [
        "You hold the kill switch. ",
        { strong: "Nothing publishes without your written sign-off" },
        " — script stage and final cut, both on WhatsApp.",
      ],
    },
    {
      term: "Disclosure-ready",
      parts: [
        "Every avatar-led reel is logged and labelled internally, so if a platform ever asks, the paper trail already exists. Quality so good the label doesn't matter — and a system that keeps your account safe either way.",
      ],
    },
    {
      term: "After the Sprint",
      parts: [
        "Continue to the monthly system, or stop. No retainer commitment is signed before the Sprint ends.",
      ],
    },
  ],
  priceNote: {
    strong: "Pricing is discussed on the call.",
    body: " The Sprint is priced as a pilot, not a project — low enough to be an easy yes, real enough that we both take it seriously.",
  },
  guarantee: {
    kicker: "Consent & deletion guarantee",
    heading: "Your likeness is yours. In writing, before we record a frame.",
    paragraphs: [
      "Before capture day you sign a consent scope that names exactly where your clone may be used — and nowhere else. The models are trained for you alone and never pooled, resold, or used to train anything for another client.",
      "Walk away at any point and we delete the voice model, the avatar model, and all raw footage within seven days — confirmed to you in writing, with a deletion log.",
    ],
    sigline: "Signed before capture. Honoured after exit.",
  },
};

export const faq = {
  num: "07",
  label: "Objections, answered",
  items: [
    {
      q: "Will it look fake?",
      a: [
        {
          parts: [
            "That's what the Calibration Sprint exists to settle — with your face, not a demo account's. The real-vs-clone test above is the bar: ",
            {
              strong:
                "if your own team can reliably spot the clone, we haven't earned the retainer.",
            },
          ],
        },
        {
          parts: [
            'Two things make the difference: a proper capture day (most "AI clones" are trained on a webcam clip), and scripts built from your actual transcripts, so the words fit the face.',
          ],
        },
      ],
    },
    {
      q: "Am I committing to a retainer?",
      a: [
        {
          parts: [
            "No. The Sprint is a self-contained paid pilot. When it ends you own the three reels and we've both learned whether this works for your audience. ",
            { strong: "The retainer is offered, never assumed." },
          ],
        },
      ],
    },
    {
      q: "Why a paid pilot instead of a free trial?",
      a: [
        {
          parts: [
            "Because a real capture day, a trained model, and three finished reels cost real production hours — and free pilots attract tyre-kickers, which would mean a waitlist for the founders who are serious.",
          ],
        },
        {
          parts: [
            'You\'re not paying to "try AI." You\'re paying for a studio day and three deliverables you keep either way.',
          ],
        },
      ],
    },
    {
      q: "Who owns the content — and the clone?",
      a: [
        {
          parts: [
            { strong: "You do. Both." },
            " Every reel, every script, the hook library, and the trained models themselves are your property, transferred on exit. The consent agreement bars us from any use outside your account — including our own marketing, unless you separately say yes.",
          ],
        },
      ],
    },
    {
      q: "What about platform rules on AI content?",
      a: [
        {
          parts: [
            "Meta and YouTube both allow AI-generated likeness content with appropriate disclosure of realistic synthetic media. We keep an internal log of every avatar-led reel and apply platform disclosure flags where required — so compliance is handled by process, not by hoping nobody asks.",
          ],
        },
        {
          parts: [
            "This is the part most clone vendors skip. It's also why our clients' accounts don't get flagged.",
          ],
        },
      ],
    },
    {
      q: "How much of my time does this actually take?",
      a: [
        {
          parts: [
            "Three hours on capture day, once. After that, roughly ",
            { strong: "ten minutes per approval cycle on WhatsApp" },
            " — read the script, watch the cut, reply. You can delegate approvals to someone you trust; many clients do.",
          ],
        },
      ],
    },
  ],
};

export const book = {
  num: "08",
  label: "Begin",
  heading: "We run three capture days a month. That's the whole calendar.",
  scarcity: {
    body: "One studio, one crew, one founder per capture day — because the quality bar that makes a clone indistinguishable doesn't batch. ",
    strong: "When the month's days are taken, the next opening is next month.",
    tail: " No countdown timers; just a small calendar.",
  },
  slots: [
    { month: "June", state: "Fully booked", open: false },
    { month: "July", state: "1 capture day open", open: true },
    { month: "August", state: "3 capture days open", open: true },
  ],
  slotFoot: "Calendar updated weekly · placeholder counts — wire to your real booking calendar.",
  form: {
    heading: "Request a Calibration Sprint call",
    sub: "A 20-minute call to see if your offer and audience fit the system. No deck, no pressure.",
    fields: {
      name: { label: "Name" },
      email: { label: "Email" },
      whatsapp: { label: "WhatsApp number", placeholder: "+91" },
      niche: {
        label: "What do you sell?",
        placeholder: "Choose one",
        options: [
          { value: "coaching", label: "Coaching programs" },
          { value: "consulting", label: "Consulting / advisory" },
          { value: "agency", label: "Agency services" },
          { value: "other", label: "Something else" },
        ],
      },
      frequency: {
        label: "How often do you publish right now?",
        placeholder: "Choose one",
        options: [
          { value: "daily", label: "Daily — or close to it" },
          { value: "weekly", label: "1–3 times a week" },
          { value: "monthly", label: "A few times a month" },
          { value: "rarely", label: "Rarely — it keeps slipping" },
        ],
      },
    },
    submit: "Book your Calibration Sprint",
    submitting: "Booking…",
    fine: "We reply on WhatsApp within one working day, IST.",
    serverError:
      "Something went sideways on our end — try again in a minute, or just WhatsApp us.",
    success: {
      big: "Got it.",
      bodyBefore: "You'll hear from us on ",
      wa: "WhatsApp",
      bodyAfter: " within one working day (IST) to find a slot that fits.",
    },
  },
};

export const footer = {
  mark: "AiEZ",
  tag: "Bombay & the internet.",
  links: [
    { label: "Consent & deletion", href: "#sprint" },
    { label: "FAQ", href: "#faq" },
    { label: "Book a Sprint", href: "#book" },
  ],
  copyright: "© 2026 AiEZ. Your likeness stays yours.",
};

export type IncludedPart = string | { strong: string };
export type ArtifactPart = string | { em: string };
