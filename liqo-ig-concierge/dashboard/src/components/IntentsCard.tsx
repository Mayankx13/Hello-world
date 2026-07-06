import type { Intents } from '../api'
import { label, pctLabel } from '../format'
import { CardSkeleton, EmptyState, HBar } from './bits'

export function IntentsCard({ intents }: { intents: Intents | null }) {
  if (!intents) return <CardSkeleton lines={5} />

  const max = intents.intents[0]?.count ?? 0
  return (
    <div className="card">
      <h2>Top intents</h2>
      <p className="sub">last {intents.days} days · share of classified inbound DMs</p>
      {intents.intents.length === 0 ? (
        <EmptyState title="No classified DMs yet" note="Intent mix appears once the concierge starts replying." icon="🧭" />
      ) : (
        intents.intents.map((i) => (
          <HBar
            key={i.intent}
            label={label(i.intent)}
            value={i.count}
            max={max}
            valueLabel={pctLabel(i.share_pct)}
          />
        ))
      )}
    </div>
  )
}
