import { useState } from 'react'
import type { Costs, Kpis, Quality } from '../api'
import { saveQaScore } from '../api'
import { inr, num, pctLabel } from '../format'
import { CardSkeleton } from './bits'

export function EconPanel({
  costs,
  quality,
  kpis,
  onQaSaved,
}: {
  costs: Costs | null
  quality: Quality | null
  kpis: Kpis | null
  onQaSaved: () => void
}) {
  const [qaInput, setQaInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!costs || !quality || !kpis) return <CardSkeleton lines={6} />

  async function submitQa() {
    const score = Number.parseFloat(qaInput)
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setSaveError('Enter a score between 0 and 100')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await saveQaScore(score)
      setQaInput('')
      onQaSaved()
    } catch {
      setSaveError('Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h2>Economics &amp; quality</h2>
      <p className="sub">
        last {costs.days} days · Haiku 4.5 at $1/$5 per MTok · ₹{costs.usd_inr}/USD
      </p>

      <div className="econ-grid">
        <div className="econ-item">
          <div className="label">API spend</div>
          <div className="value">{inr(costs.spend_inr)}</div>
        </div>
        <div className="econ-item">
          <div className="label">Cost / conversation</div>
          <div className="value">{inr(costs.cost_per_conversation_inr)}</div>
        </div>
        <div className="econ-item">
          <div className="label">Cost / lead</div>
          <div className="value">{inr(costs.cost_per_lead_inr)}</div>
        </div>
        <div className="econ-item">
          <div className="label">Cost / attributed bill</div>
          <div className="value">{inr(costs.cost_per_attributed_bill_inr)}</div>
        </div>
        <div className="econ-item">
          <div className="label">QA score</div>
          <div className="value">{quality.latest ? pctLabel(quality.latest.score) : '—'}</div>
        </div>
        <div className="econ-item">
          <div className="label">Missed 24h windows</div>
          <div className="value" style={kpis.missed_24h_window > 0 ? { color: 'var(--bad)' } : undefined}>
            {num(kpis.missed_24h_window)}
          </div>
        </div>
      </div>

      <div className="qa-row">
        <label htmlFor="qa-score">Log QA score</label>
        <input
          id="qa-score"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          placeholder="0–100"
          value={qaInput}
          onChange={(e) => setQaInput(e.target.value)}
        />
        <button className="btn" onClick={submitQa} disabled={saving || qaInput === ''}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <span className="qa-current" role={saveError ? 'alert' : undefined} style={saveError ? { color: 'var(--bad)' } : undefined}>
          {saveError ?? (quality.latest ? `latest: ${quality.latest.score} on ${quality.latest.day}` : 'no QA entries yet')}
        </span>
      </div>
    </div>
  )
}
