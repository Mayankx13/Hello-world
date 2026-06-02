# Outreach Template — 15-minute conversation ask

> Three templates, ranked by warmth. The principle is the same in all
> three: **you are asking for 15 minutes of their perspective, not a
> job, not a referral, not a CV review.** That ask gets answered;
> the others get archived.

---

## Why this works (read once, then use the templates)

Senior people **enjoy advising** when:
1. The ask is specific (you've narrowed it for them).
2. The ask is bounded (15 minutes, one topic).
3. The ask flatters their expertise without being unctuous.
4. They can say no without guilt.

Senior people **archive** asks that:
1. Are open-ended ("would love to connect and learn about your journey").
2. Are vague about what you actually want.
3. Come with a CV attached — that signals you actually want a job and dressed it up.
4. Don't give them an out.

The templates below honour all four "do"s and avoid all four "don't"s.

**Hard rule:** Never attach your CV to a 15-min-ask email. If they want it, they'll ask in the call. Sending it unprompted converts the ask into a job ask in their head, and the reply rate halves.

---

## Template 1 — Warm contact (ex-colleague, mutual, someone who knows you)

> **When to use:** People you've worked with directly, or who you've met more than once. People you can sign off as "Mayank" without a re-introduction.

**Subject:** Quick brain on enterprise GenAI — 15 mins?

> Hey {First name},
>
> Hope you're well. Quick one — I've been deep into how enterprises are putting GenAI on top of their existing data stack (Azure/Power BI/warehouse), and you're one of the few people whose read on this I trust.
>
> I'm building a reference implementation (RAG + NL2SQL over a retail dataset, full eval harness) to think through what *actually* ships vs what stays a demo. Would value 15 minutes of your perspective on what you're seeing at {their firm} — not a sales call, not a job ask, genuinely just want to compare notes.
>
> Three Calendly slots next week, or send me one that works: {link}
>
> Either way — would love to hear what you're working on.
>
> Mayank

**What's doing the work:**
- Subject is a specific, bounded request. Recipients with senior calendars scan subjects in 0.5s — "Quick brain on X — 15 mins?" parses as a yes/no question.
- The "you're one of the few people whose read I trust" line is a soft compliment that *also* tells them why you're asking *them*. Without it, they wonder if it's a copy-paste blast.
- The project mention does double duty: (a) credibility — you're not job-hunting from zero, you're building something, (b) gives them a concrete topic so the call doesn't drift into small talk.
- "Not a sales call, not a job ask" disarms the two reasons they'd otherwise archive.
- Calendly slots + "or send me one" gives them both lazy-pick and control options.
- The "either way" close removes pressure — replies go up when the recipient feels no obligation.

---

## Template 2 — Second-degree contact (someone at a target company you've met once)

> **When to use:** People you've met at a conference, had one Zoom with through a mutual, commented on each other's posts. They know your name but don't owe you a reply.

**Subject:** Building a GenAI overlay on enterprise data — 15 mins for your read?

> Hi {First name},
>
> We connected at {event/context} last {year/quarter}, and I've been following {something specific they've posted/spoken about — a paragraph of homework}.
>
> I'm working on a reference build for GenAI-on-enterprise-data — specifically how teams like {their team / their firm's practice} are handling the messy bit: governance, eval, the SQL-vs-RAG routing problem. The portfolio piece is here {GitHub link} if useful as context.
>
> Would 15 minutes in the next 2 weeks be possible? Happy to send specific questions ahead so it's a focused use of your time. If it's not the right moment, no worries at all — just thought it was worth asking given how few people are actually shipping this in enterprise.
>
> Best,
> Mayank
> {LinkedIn link}

**What's different from Template 1 and why:**
- The "we connected at X" line is non-negotiable — without a re-introduction, they'll squint and skim. Make the context concrete: "After your panel at the Tredence summit", not "we met a while back".
- "Following {specific thing}" proves you did 60 seconds of homework. The most cited reason senior people give for ignoring outreach is "they don't know who I am, they're just blasting".
- GitHub link does the credibility lift the body can't. Don't link the README — link a specific file or commit ("here's how I built the SQL validator: {url}"). It tells them you have substance.
- "Happy to send specific questions ahead" is the closer. It promises a high-leverage 15 minutes, which is what senior people protect.
- "If it's not the right moment, no worries" — the out. Reply rates measurably increase when this line is present.

---

## Template 3 — Cold-ish (talent leader, practice head, or recruiter at a target firm)

> **When to use:** People you've never met but who are publicly visible (head of an AI practice, talent partner at Fractal/Tredence/Tiger, senior MD at a Big 4). The ask is still NOT a job — but the conversation can naturally lead there.

**Subject:** How does {Firm} draw the line between data engineering and AI engineering?

> Hi {First name},
>
> I've spent five years building enterprise analytics at PwC and Accenture, and over the last six months I've been moving deliberately into GenAI on top of that same data layer — the lane I think {Firm} is one of the few places actually delivering at senior IC scale.
>
> One question I keep hitting that I can't resolve from outside: how does your team draw the line between a data-engineering role and an AI-engineering role on a real client engagement? I'm asking because I'm scoping my own positioning, and the answer changes how I write my next portfolio piece.
>
> Would 15 minutes in the next 3 weeks be possible? I'm not job-hunting at this exact moment — I'd rather have the right conversation than the wrong introduction.
>
> {LinkedIn} | {GitHub}
>
> Mayank Goyal

**What's different and why:**
- **The subject IS the question.** Cold recipients reply to *interesting questions*. "Quick chat" is dead on arrival from a stranger.
- The 5-year credentials line establishes you're not a junior asking for advice, which changes the perceived cost of the call from "mentoring" to "peer chat".
- The "{Firm} is one of the few places…" is genuine flattery — but also a positioning move. It signals you know the market and aren't blasting.
- The question is *real* and *non-trivial*. They'll have an opinion. Opinionated people enjoy expressing opinions. That's the whole game.
- "I'm not job-hunting at this exact moment" is a *deliberate* truth — it lowers their guard. Following up later when there's a role is normal and expected.
- The "rather have the right conversation than the wrong introduction" line frames you as a long-game candidate. Talent leaders prefer long-game candidates because referrals from them stick.

---

## Follow-up rules (this is where outreach actually works)

1. **One follow-up only.** Sent 7 days after the original, in the same thread (reply to your own send, don't start a new thread — recruiters' inboxes group threads).
2. **Follow-up body: 2 lines.**
   > Hi {First name} — gentle bump in case the first slid past. Still happy to grab 15 minutes whenever, or to wait if now's not the moment. — Mayank
3. **After follow-up, stop.** Continuing past 2 messages crosses the line from "candidate" to "annoyance". Mark the contact `responded_no` or `silent` in `target_companies.csv` and move on. You can re-approach them with a *different* ask in 6 months — never with the same ask.

---

## What to do on the call (15 minutes is short — don't waste it)

- **Minute 0–1:** Thank them for the time. Reconfirm the topic in one sentence ("I want to compare notes on enterprise GenAI delivery — I'll keep it to 15 minutes").
- **Minute 1–10:** Ask 2–3 prepared questions. NOT "what's your day like?". Real questions like:
  - "What's the failure mode you see most often when teams try to put GenAI on warehouses?"
  - "Where does the value actually land — the LLM, the retrieval, the prompt design, the integration?"
  - "If you were hiring a senior IC into this space tomorrow, what's the one signal you'd weight heaviest?"
- **Minute 10–13:** Share what you're building (the project), get their fast reaction. This is your "showing the work" moment — but only 2 minutes of it, not 10.
- **Minute 13–15:** Close with: *"Two asks — (a) anything I should be reading or watching that I'm probably not, and (b) if anyone in your network should be in this conversation, I'd value an intro."* That second ask is the warm referral question — phrased softly, easy to say no to, but it opens the door.
- **Within 24 hours:** Send a thank-you that includes the *one* most useful thing they said, attributed back to them. This is how 15 minutes becomes a relationship.

---

## Don'ts (the failure modes I've seen most)

- ❌ Don't attach your CV to the first email.
- ❌ Don't ask for a referral in the first message.
- ❌ Don't open with "I hope this finds you well" — flagged as templated.
- ❌ Don't list your skills. The project link does the talking.
- ❌ Don't mention salary, band, location, or visa anywhere in the outreach. Those are post-conversation topics.
- ❌ Don't blast the same template to 20 people same-day. Even with personalisation, the timing pattern is detectable in mutual connections' threads.
- ❌ Don't follow up on LinkedIn AND email AND WhatsApp. Pick one channel per follow-up.

---

## Tracking

In `target_companies.csv` set the `status` field to one of:
- `Not started`
- `Researching` (you're picking the right contact + writing the personalised line)
- `Sent` (with the date in a notes column you can add)
- `Replied — call scheduled`
- `Replied — declined politely`
- `Silent — followed up`
- `Silent — closed`

A weekly review = which `Sent` are 7+ days old and need the one allowed follow-up. Keep this discipline and the funnel runs itself.
