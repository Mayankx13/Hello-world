import { useCallback, useEffect, useState } from 'react'
import { getLeads, setLeadStatus, LEAD_STATUSES, type Lead, ApiError } from '../api'
import { label, shortDay } from '../format'
import { CardSkeleton, EmptyState, ErrorBanner } from './bits'

// The store team's morning call-down list: phone (tap to call), what they
// need, city, and a status dropdown that writes straight back to the API.
export function LeadsPanel() {
  const [filter, setFilter] = useState<string>('new')
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLeads(null)
    setError(null)
    try {
      const res = await getLeads(filter === 'all' ? undefined : filter)
      setLeads(res.leads)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'network error')
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function changeStatus(lead: Lead, status: string) {
    const before = lead.status
    setRowError(null)
    setLeads((ls) => ls?.map((l) => (l.id === lead.id ? { ...l, status } : l)) ?? null)
    try {
      await setLeadStatus(lead.id, status)
    } catch {
      setLeads((ls) => ls?.map((l) => (l.id === lead.id ? { ...l, status: before } : l)) ?? null)
      setRowError(lead.id)
    }
  }

  return (
    <div className="card">
      <h2>Leads — call-down list</h2>
      <p className="sub">newest first · tap a phone number to call · status saves instantly</p>

      <div className="lead-filters" role="group" aria-label="Filter by status">
        {['all', ...LEAD_STATUSES].map((s) => (
          <button key={s} className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : label(s)}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : !leads ? (
        <CardSkeleton lines={5} />
      ) : leads.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No leads yet' : `No ${label(filter).toLowerCase()} leads`}
          note="Leads land here the moment the concierge captures a phone number."
          icon="📇"
        />
      ) : (
        <div className="table-wrap">
          <table className="leads">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Need</th>
                <th>City</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div>{l.name ?? 'Unknown'}</div>
                    {l.phone ? <a href={`tel:+91${l.phone}`}>{l.phone}</a> : <span className="lead-meta">no phone</span>}
                  </td>
                  <td className="need">
                    <div>{l.need ?? '—'}</div>
                    <div className="lead-meta">
                      {label(l.product_category)} · {shortDay(l.created_at.slice(0, 10))}
                      {l.store_hint ? ` · ${l.store_hint}` : ''}
                    </div>
                  </td>
                  <td>{l.city ?? '—'}</td>
                  <td>
                    <select
                      className={`status-select s-${l.status}`}
                      value={l.status}
                      aria-label={`Status for ${l.name ?? l.phone ?? `lead ${l.id}`}`}
                      onChange={(e) => void changeStatus(l, e.target.value)}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                    {rowError === l.id && (
                      <div className="lead-meta" role="alert" style={{ color: 'var(--bad)' }}>
                        save failed
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
