import type { Kpis } from '../api'
import { inr, num, pctLabel, label } from '../format'
import { Skeleton } from './bits'

const STORE_AVG_IPB = Number.parseFloat((import.meta.env.VITE_STORE_AVG_IPB as string | undefined) ?? '1.4') || 1.4

function topOf(items: { n: number }[], key: 'category' | 'city'): string {
  const top = items.slice(0, 2) as ({ n: number } & Record<string, unknown>)[]
  if (top.length === 0) return 'none yet'
  return top.map((t) => `${label(String(t[key]))} ${t.n}`).join(' · ')
}

export function KpiRow({ kpis }: { kpis: Kpis | null }) {
  if (!kpis) {
    return (
      <div className="grid-kpi">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="card kpi" key={i} aria-busy>
            <Skeleton h={11} w="60%" style={{ marginBottom: 10 }} />
            <Skeleton h={26} w="45%" style={{ marginBottom: 8 }} />
            <Skeleton h={12} w="80%" />
          </div>
        ))}
      </div>
    )
  }

  const ipb = kpis.attribution.avg_items_per_bill
  return (
    <div className="grid-kpi">
      <div className="card kpi">
        <div className="label">DMs handled</div>
        <div className="value">{num(kpis.dms.handled)}</div>
        <div className="hint">
          <span className="up">{pctLabel(kpis.dms.pct_replied_under_2min)}</span> replied under 2 min
        </div>
      </div>

      <div className="card kpi">
        <div className="label">Auto-resolved</div>
        <div className="value">{pctLabel(kpis.auto_resolved_pct)}</div>
        <div className="hint">handoffs {pctLabel(kpis.handoff_pct)} · answered {pctLabel(kpis.pct_answered)}</div>
      </div>

      <div className="card kpi">
        <div className="label">Leads captured</div>
        <div className="value">{num(kpis.leads.total)}</div>
        <div className="hint">{topOf(kpis.leads.by_category, 'category')}</div>
      </div>

      <div className="card kpi">
        <div className="label">Visit commitments</div>
        <div className="value">{num(kpis.visits.committed)}</div>
        <div className="hint">{topOf(kpis.visits.by_city, 'city')}</div>
      </div>

      <div className="card kpi sales">
        <div className="label">DM-attributed sales</div>
        <div className="value">{inr(kpis.attribution.revenue_inr)}</div>
        <div className="hint">
          {num(kpis.attribution.bills)} bills
          {ipb != null ? ` · IPB ${ipb} vs ${STORE_AVG_IPB} store avg` : ''}
        </div>
      </div>
    </div>
  )
}
