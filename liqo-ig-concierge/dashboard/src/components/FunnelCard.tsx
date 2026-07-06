import type { Funnel } from '../api'
import { num, pctLabel } from '../format'
import { CardSkeleton, EmptyState, HBar } from './bits'
import { Fragment } from 'react'

export function FunnelCard({ funnel }: { funnel: Funnel | null }) {
  if (!funnel) return <CardSkeleton lines={5} />

  const max = funnel.stages[0]?.count ?? 0
  return (
    <div className="card">
      <h2>Chat-to-sale funnel</h2>
      <p className="sub">last {funnel.days} days · conversion between stages</p>
      {max === 0 ? (
        <EmptyState title="No conversations in this window" note="The funnel fills in once DMs start arriving." icon="🪜" />
      ) : (
        funnel.stages.map((s, i) => {
          const prev = i > 0 ? funnel.stages[i - 1].count : null
          const conv = prev != null && prev > 0 ? Math.round((1000 * s.count) / prev) / 10 : null
          return (
            <Fragment key={s.key}>
              {i > 0 && (
                <div className="funnel-conv">
                  <span>{conv != null ? `↓ ${pctLabel(conv)}` : '↓ —'}</span>
                </div>
              )}
              <HBar label={s.label} value={s.count} max={max} valueLabel={num(s.count)} />
            </Fragment>
          )
        })
      )}
    </div>
  )
}
