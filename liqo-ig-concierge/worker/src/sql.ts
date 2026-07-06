// Every analytics query in one place. api.ts binds these against D1; the
// KPI smoke test (worker/test/kpis.test.ts) runs the very same strings
// against node:sqlite on the seeded demo data, so handler SQL and tested
// SQL cannot drift apart.
//
// All take ?1 = '-<days> days' (SQLite datetime/date modifier).

export const SQL = {
  // conversation-level coverage flags (see api.ts header for definitions)
  kpiSessions: `
    SELECT count(*) AS sessions,
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

  kpiFastReplies: `
    SELECT count(*) AS dms_in,
           coalesce(sum(EXISTS (
             SELECT 1 FROM conversations o
             WHERE o.ig_user_id = i.ig_user_id AND o.direction = 'out'
               AND o.created_at > i.created_at
               AND o.created_at <= datetime(i.created_at, '+2 minutes')
           )), 0) AS fast
    FROM conversations i
    WHERE i.direction = 'in' AND i.created_at >= datetime('now', ?1)`,

  kpiLeadsCount: `SELECT count(*) AS n FROM leads WHERE created_at >= datetime('now', ?1)`,

  kpiLeadsByCategory: `
    SELECT coalesce(product_category, 'other') AS category, count(*) AS n
    FROM leads WHERE created_at >= datetime('now', ?1)
    GROUP BY 1 ORDER BY n DESC`,

  kpiVisits: `
    SELECT count(*) AS n FROM leads
    WHERE status IN ('visit_committed','visited','converted')
      AND created_at >= datetime('now', ?1)`,

  kpiVisitsByCity: `
    SELECT coalesce(city, 'unknown') AS city, count(*) AS n
    FROM leads
    WHERE status IN ('visit_committed','visited','converted')
      AND created_at >= datetime('now', ?1)
    GROUP BY 1 ORDER BY n DESC`,

  kpiAttribution: `
    SELECT count(*) AS bills,
           coalesce(sum(bill_amount), 0) AS revenue_inr,
           avg(items_count) AS avg_items_per_bill
    FROM attribution WHERE bill_date >= date('now', ?1)`,

  kpiMissed24h: `
    SELECT count(*) AS n FROM (
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

  funnelDmUsers: `
    SELECT count(DISTINCT ig_user_id) AS n FROM conversations
    WHERE direction = 'in' AND ig_user_id IS NOT NULL AND created_at >= datetime('now', ?1)`,

  funnelCommitted: `
    SELECT count(*) AS n FROM leads
    WHERE status IN ('visit_committed','visited','converted') AND created_at >= datetime('now', ?1)`,

  funnelVisited: `
    SELECT count(*) AS n FROM leads
    WHERE status IN ('visited','converted') AND created_at >= datetime('now', ?1)`,

  funnelConverted: `
    SELECT count(*) AS n FROM leads
    WHERE status = 'converted' AND created_at >= datetime('now', ?1)`,

  timeseries: `
    SELECT date(created_at) AS day,
           sum(CASE WHEN direction = 'in' THEN 1 ELSE 0 END) AS dms_in,
           sum(CASE WHEN direction = 'out' THEN 1 ELSE 0 END) AS dms_out,
           sum(CASE WHEN handoff = 1 THEN 1 ELSE 0 END) AS handoffs
    FROM conversations
    WHERE created_at >= datetime('now', ?1)
    GROUP BY day ORDER BY day`,

  intents: `
    SELECT intent, count(*) AS n
    FROM conversations
    WHERE direction = 'in' AND intent IS NOT NULL AND intent != ''
      AND created_at >= datetime('now', ?1)
    GROUP BY intent ORDER BY n DESC LIMIT 15`,

  costTokens: `
    SELECT coalesce(sum(input_tokens), 0) AS tin,
           coalesce(sum(output_tokens), 0) AS tout,
           count(DISTINCT CASE WHEN direction = 'in' THEN ig_user_id END) AS conversations
    FROM conversations WHERE created_at >= datetime('now', ?1)`,

  costDaily: `
    SELECT date(created_at) AS day,
           coalesce(sum(input_tokens), 0) AS tin,
           coalesce(sum(output_tokens), 0) AS tout
    FROM conversations WHERE created_at >= datetime('now', ?1)
    GROUP BY day ORDER BY day`,

  costBills: `SELECT count(*) AS n FROM attribution WHERE bill_date >= date('now', ?1)`,
} as const
