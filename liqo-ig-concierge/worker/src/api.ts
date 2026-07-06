// Dashboard API. Every route here is mounted under /api/* and sits behind
// (1) Cloudflare Access on the zone and (2) the X-Api-Key check in index.ts,
// so it stays safe even if Access is misconfigured.
//
// Definitions used throughout (documented once, applied consistently):
//   * window       — rows with created_at >= datetime('now', '-<days> days')
//                    (attribution uses bill_date, the business date).
//   * conversation — a distinct ig_user_id with >= 1 inbound DM in the window.
//   * answered     — that user also has >= 1 outbound DM in the window.
//   * handoff      — that user has >= 1 row flagged handoff=1 in the window.
//   * auto-resolved— answered AND NOT handoff.

import { Hono } from 'hono'
import { type Env, LEAD_STATUSES, MATCH_METHODS, type LeadStatus } from './types'

export const api = new Hono<{ Bindings: Env }>()

// '-7 days' style modifier, bound as a parameter into datetime('now', ?).
function windowOf(daysRaw: string | undefined, fallback = 7): { days: number; mod: string } {
  const n = Number.parseInt(daysRaw ?? '', 10)
  const days = Number.isFinite(n) ? Math.min(Math.max(n, 1), 90) : fallback
  return { days, mod: `-${days} days` }
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((1000 * part) / whole) / 10 : 0)
const round2 = (x: number) => Math.round(x * 100) / 100

// Haiku 4.5 pricing per the cost formula: $1/MTok input, $5/MTok output.
const USD_PER_MTOK_IN = 1
const USD_PER_MTOK_OUT = 5
const spendInr = (tin: number, tout: number, usdInr: number) =>
  ((tin / 1e6) * USD_PER_MTOK_IN + (tout / 1e6) * USD_PER_MTOK_OUT) * usdInr

// ---------------------------------------------------------------------------
// GET /api/kpis?days=7
// ---------------------------------------------------------------------------
api.get('/kpis', async (c) => {
  const { days, mod } = windowOf(c.req.query('days'))
  const db = c.env.DB

  const [sessions, fast, leads, leadsByCat, visits, visitsByCity, attrib, missed] = await db.batch([
    // conversation-level coverage flags
    db
      .prepare(
        `SELECT count(*) AS sessions,
                coalesce(sum(answered), 0) AS answered,
                coalesce(sum(handoff), 0) AS handoff,
                coalesce(sum(CASE WHEN answered = 1 AND handoff = 0 THEN 1 ELSE 0 END), 0) AS auto_resolved
         FROM (
           SELECT u.ig_user_id,
                  EXISTS (SELECT 1 FROM conversations o
                          WHERE o.ig_user_id = u.ig_user_id AND o.direction = 'out'
                            AND o.created_at >= datetime('now', ?1)) AS answered,
                  EXISTS (SELECT 1 FROM conversations h
                          WHERE h.ig_user_id = u.ig_user_id AND h.handoff = 1
                            AND h.created_at >= datetime('now', ?1)) AS handoff
           FROM (SELECT DISTINCT ig_user_id FROM conversations
                 WHERE direction = 'in' AND ig_user_id IS NOT NULL
                   AND created_at >= datetime('now', ?1)) u
         )`,
      )
      .bind(mod),
    // inbound volume + replies within 2 minutes
    db
      .prepare(
        `SELECT count(*) AS dms_in,
                coalesce(sum(EXISTS (
                  SELECT 1 FROM conversations o
                  WHERE o.ig_user_id = i.ig_user_id AND o.direction = 'out'
                    AND o.created_at > i.created_at
                    AND o.created_at <= datetime(i.created_at, '+2 minutes')
                )), 0) AS fast
         FROM conversations i
         WHERE i.direction = 'in' AND i.created_at >= datetime('now', ?1)`,
      )
      .bind(mod),
    db.prepare(`SELECT count(*) AS n FROM leads WHERE created_at >= datetime('now', ?1)`).bind(mod),
    db
      .prepare(
        `SELECT coalesce(product_category, 'other') AS category, count(*) AS n
         FROM leads WHERE created_at >= datetime('now', ?1)
         GROUP BY 1 ORDER BY n DESC`,
      )
      .bind(mod),
    db
      .prepare(
        `SELECT count(*) AS n FROM leads
         WHERE status IN ('visit_committed','visited','converted')
           AND created_at >= datetime('now', ?1)`,
      )
      .bind(mod),
    db
      .prepare(
        `SELECT coalesce(city, 'unknown') AS city, count(*) AS n
         FROM leads
         WHERE status IN ('visit_committed','visited','converted')
           AND created_at >= datetime('now', ?1)
         GROUP BY 1 ORDER BY n DESC`,
      )
      .bind(mod),
    db
      .prepare(
        `SELECT count(*) AS bills,
                coalesce(sum(bill_amount), 0) AS revenue_inr,
                avg(items_count) AS avg_items_per_bill
         FROM attribution WHERE bill_date >= date('now', ?1)`,
      )
      .bind(mod),
    // users whose LAST inbound DM aged past the 24h reply window with no reply
    db
      .prepare(
        `SELECT count(*) AS n FROM (
           SELECT ig_user_id, max(created_at) AS last_in
           FROM conversations
           WHERE direction = 'in' AND ig_user_id IS NOT NULL
             AND created_at >= datetime('now', ?1)
           GROUP BY ig_user_id
         ) li
         WHERE datetime(li.last_in, '+24 hours') < datetime('now')
           AND NOT EXISTS (
             SELECT 1 FROM conversations o
             WHERE o.ig_user_id = li.ig_user_id AND o.direction = 'out'
               AND o.created_at > li.last_in
               AND o.created_at <= datetime(li.last_in, '+24 hours')
           )`,
      )
      .bind(mod),
  ])

  const s = sessions.results[0] as { sessions: number; answered: number; handoff: number; auto_resolved: number }
  const f = fast.results[0] as { dms_in: number; fast: number }
  const a = attrib.results[0] as { bills: number; revenue_inr: number; avg_items_per_bill: number | null }

  return c.json({
    days,
    dms: {
      handled: f.dms_in,
      unique_users: s.sessions,
      pct_replied_under_2min: pct(f.fast, f.dms_in),
    },
    pct_answered: pct(s.answered, s.sessions),
    auto_resolved_pct: pct(s.auto_resolved, s.sessions),
    handoff_pct: pct(s.handoff, s.sessions),
    leads: {
      total: (leads.results[0] as { n: number }).n,
      by_category: leadsByCat.results,
    },
    visits: {
      committed: (visits.results[0] as { n: number }).n,
      by_city: visitsByCity.results,
    },
    attribution: {
      bills: a.bills,
      revenue_inr: round2(a.revenue_inr),
      avg_items_per_bill: a.avg_items_per_bill == null ? null : round2(a.avg_items_per_bill),
    },
    missed_24h_window: (missed.results[0] as { n: number }).n,
  })
})

// ---------------------------------------------------------------------------
// GET /api/funnel?days=7 — the 5-stage chat-to-sale funnel.
// ---------------------------------------------------------------------------
api.get('/funnel', async (c) => {
  const { days, mod } = windowOf(c.req.query('days'))
  const db = c.env.DB

  const [dmUsers, leads, committed, visited, converted] = await db.batch([
    db
      .prepare(
        `SELECT count(DISTINCT ig_user_id) AS n FROM conversations
         WHERE direction = 'in' AND ig_user_id IS NOT NULL AND created_at >= datetime('now', ?1)`,
      )
      .bind(mod),
    db.prepare(`SELECT count(*) AS n FROM leads WHERE created_at >= datetime('now', ?1)`).bind(mod),
    db
      .prepare(
        `SELECT count(*) AS n FROM leads
         WHERE status IN ('visit_committed','visited','converted') AND created_at >= datetime('now', ?1)`,
      )
      .bind(mod),
    db
      .prepare(
        `SELECT count(*) AS n FROM leads
         WHERE status IN ('visited','converted') AND created_at >= datetime('now', ?1)`,
      )
      .bind(mod),
    db
      .prepare(
        `SELECT count(*) AS n FROM leads
         WHERE status = 'converted' AND created_at >= datetime('now', ?1)`,
      )
      .bind(mod),
  ])

  const n = (r: D1Result) => (r.results[0] as { n: number }).n
  return c.json({
    days,
    stages: [
      { key: 'dms', label: 'DM conversations', count: n(dmUsers) },
      { key: 'leads', label: 'Leads captured', count: n(leads) },
      { key: 'visit_committed', label: 'Visit committed', count: n(committed) },
      { key: 'visited', label: 'Visited store', count: n(visited) },
      { key: 'converted', label: 'Converted', count: n(converted) },
    ],
  })
})

// ---------------------------------------------------------------------------
// GET /api/timeseries?days=14 — daily DM volume vs handoffs, gaps zero-filled.
// ---------------------------------------------------------------------------
api.get('/timeseries', async (c) => {
  const { days, mod } = windowOf(c.req.query('days'), 14)

  const rows = await c.env.DB.prepare(
    `SELECT date(created_at) AS day,
            sum(CASE WHEN direction = 'in' THEN 1 ELSE 0 END) AS dms_in,
            sum(CASE WHEN direction = 'out' THEN 1 ELSE 0 END) AS dms_out,
            sum(CASE WHEN handoff = 1 THEN 1 ELSE 0 END) AS handoffs
     FROM conversations
     WHERE created_at >= datetime('now', ?1)
     GROUP BY day ORDER BY day`,
  )
    .bind(mod)
    .all<{ day: string; dms_in: number; dms_out: number; handoffs: number }>()

  const byDay = new Map(rows.results.map((r) => [r.day, r]))
  const today = new Date()
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400_000).toISOString().slice(0, 10)
    const r = byDay.get(d)
    series.push({ day: d, dms_in: r?.dms_in ?? 0, dms_out: r?.dms_out ?? 0, handoffs: r?.handoffs ?? 0 })
  }
  return c.json({ days, series })
})

// ---------------------------------------------------------------------------
// GET /api/intents?days=7 — inbound intent distribution.
// ---------------------------------------------------------------------------
api.get('/intents', async (c) => {
  const { days, mod } = windowOf(c.req.query('days'))

  const rows = await c.env.DB.prepare(
    `SELECT intent, count(*) AS n
     FROM conversations
     WHERE direction = 'in' AND intent IS NOT NULL AND intent != ''
       AND created_at >= datetime('now', ?1)
     GROUP BY intent ORDER BY n DESC LIMIT 15`,
  )
    .bind(mod)
    .all<{ intent: string; n: number }>()

  const total = rows.results.reduce((acc, r) => acc + r.n, 0)
  return c.json({
    days,
    total,
    intents: rows.results.map((r) => ({ intent: r.intent, count: r.n, share_pct: pct(r.n, total) })),
  })
})

// ---------------------------------------------------------------------------
// GET /api/leads?status=new — the morning call-down list.
// ---------------------------------------------------------------------------
api.get('/leads', async (c) => {
  const status = c.req.query('status')
  if (status && !LEAD_STATUSES.includes(status as LeadStatus)) {
    return c.json({ error: `invalid status; expected one of ${LEAD_STATUSES.join(', ')}` }, 400)
  }
  const rows = status
    ? await c.env.DB.prepare(`SELECT * FROM leads WHERE status = ?1 ORDER BY created_at DESC LIMIT 500`)
        .bind(status)
        .all()
    : await c.env.DB.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`).all()
  return c.json({ leads: rows.results })
})

// ---------------------------------------------------------------------------
// POST /api/leads/:id/status  { "status": "called" }
// ---------------------------------------------------------------------------
api.post('/leads/:id/status', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ error: 'invalid lead id' }, 400)

  const body = await c.req.json<{ status?: string }>().catch(() => null)
  const status = body?.status
  if (!status || !LEAD_STATUSES.includes(status as LeadStatus)) {
    return c.json({ error: `invalid status; expected one of ${LEAD_STATUSES.join(', ')}` }, 400)
  }

  const res = await c.env.DB.prepare(
    `UPDATE leads SET status = ?1, updated_at = datetime('now') WHERE id = ?2`,
  )
    .bind(status, id)
    .run()
  if (res.meta.changes === 0) return c.json({ error: 'lead not found' }, 404)

  const lead = await c.env.DB.prepare(`SELECT * FROM leads WHERE id = ?1`).bind(id).first()
  return c.json({ lead })
})

// ---------------------------------------------------------------------------
// GET /api/costs?days=7 — live spend computed from conversations token counts.
// (api_costs holds the nightly rollup history; live numbers come from source.)
// ---------------------------------------------------------------------------
api.get('/costs', async (c) => {
  const { days, mod } = windowOf(c.req.query('days'))
  const usdInr = Number.parseFloat(c.env.USD_INR ?? '87') || 87
  const db = c.env.DB

  const [tokens, daily, leads, bills] = await db.batch([
    db
      .prepare(
        `SELECT coalesce(sum(input_tokens), 0) AS tin,
                coalesce(sum(output_tokens), 0) AS tout,
                count(DISTINCT CASE WHEN direction = 'in' THEN ig_user_id END) AS conversations
         FROM conversations WHERE created_at >= datetime('now', ?1)`,
      )
      .bind(mod),
    db
      .prepare(
        `SELECT date(created_at) AS day,
                coalesce(sum(input_tokens), 0) AS tin,
                coalesce(sum(output_tokens), 0) AS tout
         FROM conversations WHERE created_at >= datetime('now', ?1)
         GROUP BY day ORDER BY day`,
      )
      .bind(mod),
    db.prepare(`SELECT count(*) AS n FROM leads WHERE created_at >= datetime('now', ?1)`).bind(mod),
    db.prepare(`SELECT count(*) AS n FROM attribution WHERE bill_date >= date('now', ?1)`).bind(mod),
  ])

  const t = tokens.results[0] as { tin: number; tout: number; conversations: number }
  const nLeads = (leads.results[0] as { n: number }).n
  const nBills = (bills.results[0] as { n: number }).n
  const spend = spendInr(t.tin, t.tout, usdInr)

  return c.json({
    days,
    usd_inr: usdInr,
    tokens: { input: t.tin, output: t.tout },
    conversations: t.conversations,
    spend_inr: round2(spend),
    cost_per_conversation_inr: t.conversations > 0 ? round2(spend / t.conversations) : null,
    cost_per_lead_inr: nLeads > 0 ? round2(spend / nLeads) : null,
    cost_per_attributed_bill_inr: nBills > 0 ? round2(spend / nBills) : null,
    daily: (daily.results as { day: string; tin: number; tout: number }[]).map((d) => ({
      day: d.day,
      spend_inr: round2(spendInr(d.tin, d.tout, usdInr)),
    })),
  })
})

// ---------------------------------------------------------------------------
// GET /api/quality?days=7 · POST /api/quality { "score": 92, "day"?, "note"? }
// Manual QA sampling score for the economics & quality panel.
// ---------------------------------------------------------------------------
api.get('/quality', async (c) => {
  const { days, mod } = windowOf(c.req.query('days'))
  const rows = await c.env.DB.prepare(
    `SELECT day, score, note FROM qa_scores
     WHERE day >= date('now', ?1) ORDER BY day DESC`,
  )
    .bind(mod)
    .all<{ day: string; score: number; note: string | null }>()
  return c.json({
    days,
    latest: rows.results[0] ?? null,
    history: rows.results,
  })
})

api.post('/quality', async (c) => {
  const body = await c.req.json<{ score?: number; day?: string; note?: string }>().catch(() => null)
  const score = Number(body?.score)
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return c.json({ error: 'score must be a number 0–100' }, 400)
  }
  const day = body?.day && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : null
  await c.env.DB.prepare(
    `INSERT INTO qa_scores (day, score, note) VALUES (coalesce(?1, date('now')), ?2, ?3)
     ON CONFLICT(day) DO UPDATE SET score = excluded.score, note = excluded.note,
                                    updated_at = datetime('now')`,
  )
    .bind(day, score, body?.note ?? null)
    .run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// POST /api/attribution/import — batch upsert from the BUSY importer.
// Body: { rows: [{ bill_no, bill_date, store, phone, mention_code,
//                  bill_amount, items_count, matched_lead_id, match_method }] }
// Upserts on bill_no; the whole batch is one transaction (all-or-nothing).
// ---------------------------------------------------------------------------
api.post('/attribution/import', async (c) => {
  const body = await c.req.json<{ rows?: unknown[] }>().catch(() => null)
  const rows = Array.isArray(body?.rows) ? body.rows : null
  if (!rows || rows.length === 0) return c.json({ error: 'rows[] required' }, 400)
  if (rows.length > 500) return c.json({ error: 'max 500 rows per batch' }, 400)

  type ImportRow = {
    bill_no: string
    bill_date: string | null
    store: string | null
    phone: string | null
    mention_code: string | null
    bill_amount: number | null
    items_count: number | null
    matched_lead_id: number | null
    match_method: string | null
  }
  const clean: ImportRow[] = []
  for (const raw of rows) {
    const r = raw as Record<string, unknown>
    const billNo = typeof r.bill_no === 'string' ? r.bill_no.trim() : ''
    if (!billNo) return c.json({ error: 'every row needs a non-empty bill_no' }, 400)
    const method = r.match_method == null ? null : String(r.match_method)
    if (method !== null && !MATCH_METHODS.includes(method as (typeof MATCH_METHODS)[number])) {
      return c.json({ error: `bill ${billNo}: match_method must be one of ${MATCH_METHODS.join(', ')}` }, 400)
    }
    const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
    clean.push({
      bill_no: billNo,
      bill_date: typeof r.bill_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.bill_date) ? r.bill_date : null,
      store: r.store == null ? null : String(r.store),
      phone: r.phone == null ? null : String(r.phone).replace(/\D/g, '').slice(-10) || null,
      mention_code: r.mention_code == null ? null : String(r.mention_code),
      bill_amount: num(r.bill_amount),
      items_count: num(r.items_count),
      matched_lead_id: num(r.matched_lead_id),
      match_method: method,
    })
  }

  // FK pre-check so one stale lead id doesn't roll back the whole batch
  // with an opaque constraint error.
  const leadIds = [...new Set(clean.map((r) => r.matched_lead_id).filter((x): x is number => x != null))]
  if (leadIds.length > 0) {
    const found = await c.env.DB.prepare(
      `SELECT id FROM leads WHERE id IN (${leadIds.map(() => '?').join(',')})`,
    )
      .bind(...leadIds)
      .all<{ id: number }>()
    const ok = new Set(found.results.map((r) => r.id))
    const missing = leadIds.filter((id) => !ok.has(id))
    if (missing.length > 0) {
      return c.json({ error: `matched_lead_id not found in leads: ${missing.join(', ')}` }, 400)
    }
  }

  const stmt = c.env.DB.prepare(
    `INSERT INTO attribution
       (bill_no, bill_date, store, phone, mention_code, bill_amount, items_count, matched_lead_id, match_method)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(bill_no) DO UPDATE SET
       bill_date = excluded.bill_date,
       store = excluded.store,
       phone = excluded.phone,
       mention_code = excluded.mention_code,
       bill_amount = excluded.bill_amount,
       items_count = excluded.items_count,
       matched_lead_id = excluded.matched_lead_id,
       match_method = excluded.match_method`,
  )
  await c.env.DB.batch(
    clean.map((r) =>
      stmt.bind(
        r.bill_no,
        r.bill_date,
        r.store,
        r.phone,
        r.mention_code,
        r.bill_amount,
        r.items_count,
        r.matched_lead_id,
        r.match_method,
      ),
    ),
  )
  return c.json({ ok: true, upserted: clean.length })
})
