// KPI SQL smoke test (acceptance criterion 4): the EXACT query strings the
// Worker runs (worker/src/sql.ts), executed against a real SQLite engine
// loaded with schema + reference seed + demo seed. Guards both the schema
// contract and the demo story: non-zero KPIs and a coherent funnel.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { beforeAll, describe, expect, it } from 'vitest'
import { SQL } from '../src/sql'

const SCHEMA_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'schema')
const WINDOW = '-30 days'

let db: DatabaseSync

beforeAll(() => {
  db = new DatabaseSync(':memory:')
  db.exec(readFileSync(join(SCHEMA_DIR, 'schema.sql'), 'utf8'))
  db.exec(readFileSync(join(SCHEMA_DIR, 'seed.sql'), 'utf8'))
  db.exec(readFileSync(join(SCHEMA_DIR, 'seed_demo.sql'), 'utf8'))
})

const one = <T>(sql: string): T => db.prepare(sql).get(WINDOW) as T
const all = <T>(sql: string): T[] => db.prepare(sql).all(WINDOW) as T[]

describe('KPI queries on seeded demo data', () => {
  it('sessions: every KPI is non-zero and internally consistent', () => {
    const s = one<{ sessions: number; answered: number; handoff: number; auto_resolved: number }>(SQL.kpiSessions)
    expect(s.sessions).toBe(12)
    expect(s.answered).toBe(11) // demo_u12 never got a reply
    expect(s.handoff).toBe(2) // complaint + bulk-order
    expect(s.auto_resolved).toBe(9) // answered minus the two handoffs
    expect(s.auto_resolved).toBeLessThanOrEqual(s.answered)
    expect(s.answered).toBeLessThanOrEqual(s.sessions)
  })

  it('fast replies: most but not all inbound answered under 2 minutes', () => {
    const f = one<{ dms_in: number; fast: number }>(SQL.kpiFastReplies)
    expect(f.dms_in).toBe(13)
    expect(f.fast).toBeGreaterThan(0)
    expect(f.fast).toBeLessThan(f.dms_in) // u06 was slow, u12 unanswered
  })

  it('leads and visit commitments are non-zero with breakdowns', () => {
    expect(one<{ n: number }>(SQL.kpiLeadsCount).n).toBe(6)
    expect(one<{ n: number }>(SQL.kpiVisits).n).toBe(4)
    const cats = all<{ category: string; n: number }>(SQL.kpiLeadsByCategory)
    expect(cats.map((c) => c.category)).toContain('ac')
    expect(cats.reduce((a, c) => a + c.n, 0)).toBe(6)
    const cities = all<{ city: string; n: number }>(SQL.kpiVisitsByCity)
    expect(cities.reduce((a, c) => a + c.n, 0)).toBe(4)
  })

  it('attribution: bills, revenue and IPB are non-zero', () => {
    const a = one<{ bills: number; revenue_inr: number; avg_items_per_bill: number }>(SQL.kpiAttribution)
    expect(a.bills).toBe(3)
    expect(a.revenue_inr).toBe(30490 + 46990 + 18999)
    expect(a.avg_items_per_bill).toBeCloseTo(5 / 3, 5)
  })

  it('missed 24h windows: exactly the one unanswered user', () => {
    expect(one<{ n: number }>(SQL.kpiMissed24h).n).toBe(1)
  })

  it('funnel is coherent: monotonically non-increasing, ending at conversions', () => {
    const counts = [
      one<{ n: number }>(SQL.funnelDmUsers).n,
      one<{ n: number }>(SQL.kpiLeadsCount).n,
      one<{ n: number }>(SQL.funnelCommitted).n,
      one<{ n: number }>(SQL.funnelVisited).n,
      one<{ n: number }>(SQL.funnelConverted).n,
    ]
    expect(counts).toEqual([12, 6, 4, 3, 2])
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1])
    expect(counts[0]).toBeGreaterThan(0)
    expect(counts.at(-1)).toBeGreaterThan(0)
  })

  it('timeseries covers multiple days with both DMs and handoffs', () => {
    const days = all<{ day: string; dms_in: number; dms_out: number; handoffs: number }>(SQL.timeseries)
    expect(days.length).toBeGreaterThanOrEqual(10)
    expect(days.reduce((a, d) => a + d.dms_in, 0)).toBe(13)
    expect(days.reduce((a, d) => a + d.handoffs, 0)).toBe(2)
  })

  it('intents: distribution sums to classified inbound DMs, price_query leads', () => {
    const rows = all<{ intent: string; n: number }>(SQL.intents)
    expect(rows[0].intent).toBe('price_query')
    expect(rows.reduce((a, r) => a + r.n, 0)).toBe(13)
  })

  it('costs: token sums power a non-zero spend', () => {
    const t = one<{ tin: number; tout: number; conversations: number }>(SQL.costTokens)
    expect(t.tin).toBeGreaterThan(0)
    expect(t.tout).toBeGreaterThan(0)
    expect(t.conversations).toBe(12)
    expect(one<{ n: number }>(SQL.costBills).n).toBe(3)
  })

  it('demo seed is idempotent: re-applying changes nothing', () => {
    const before = one<{ n: number }>(SQL.kpiLeadsCount).n
    db.exec(readFileSync(join(SCHEMA_DIR, 'seed_demo.sql'), 'utf8'))
    expect(one<{ n: number }>(SQL.kpiLeadsCount).n).toBe(before)
  })
})
