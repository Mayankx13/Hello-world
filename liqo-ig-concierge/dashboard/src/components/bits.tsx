// Small shared pieces: skeletons, error banner, empty states, proportion bars.

import type { CSSProperties } from 'react'

export function Skeleton({ h = 16, w = '100%', style }: { h?: number; w?: string | number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden />
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card" aria-busy>
      <Skeleton h={14} w="40%" style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} h={18} style={{ marginBottom: 8 }} />
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <span>
        Could not load the dashboard: <strong>{message}</strong>
      </span>
      <button className="btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

export function EmptyState({ title, note, icon = '📭' }: { title: string; note?: string; icon?: string }) {
  return (
    <div className="state">
      <div className="big" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {note ? <p>{note}</p> : null}
    </div>
  )
}

// Horizontal proportion bar row (funnel stages, intent shares).
export function HBar({
  label,
  value,
  max,
  valueLabel,
}: {
  label: string
  value: number
  max: number
  valueLabel: string
}) {
  const w = max > 0 ? Math.max((100 * value) / max, value > 0 ? 2 : 0) : 0
  return (
    <div className="hbar-row">
      <span className="hbar-label" title={label}>
        {label}
      </span>
      <div className="hbar-track">
        <div className={`hbar-fill${value === 0 ? ' zero' : ''}`} style={{ width: `${w}%` }} />
      </div>
      <span className="hbar-value">{valueLabel}</span>
    </div>
  )
}
