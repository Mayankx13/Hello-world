// Typed client for the Worker API. The key travels in X-Api-Key; the bundle
// itself is served behind Cloudflare Access, so the key is the second lock.

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const KEY = (import.meta.env.VITE_DASH_API_KEY as string | undefined) ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'X-Api-Key': KEY,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

// --- response shapes (mirror worker/src/api.ts) ------------------------------

export type Kpis = {
  days: number
  dms: { handled: number; unique_users: number; pct_replied_under_2min: number }
  pct_answered: number
  auto_resolved_pct: number
  handoff_pct: number
  leads: { total: number; by_category: { category: string; n: number }[] }
  visits: { committed: number; by_city: { city: string; n: number }[] }
  attribution: { bills: number; revenue_inr: number; avg_items_per_bill: number | null }
  missed_24h_window: number
}

export type Funnel = {
  days: number
  stages: { key: string; label: string; count: number }[]
}

export type Timeseries = {
  days: number
  series: { day: string; dms_in: number; dms_out: number; handoffs: number }[]
}

export type Intents = {
  days: number
  total: number
  intents: { intent: string; count: number; share_pct: number }[]
}

export type Costs = {
  days: number
  usd_inr: number
  tokens: { input: number; output: number }
  conversations: number
  spend_inr: number
  cost_per_conversation_inr: number | null
  cost_per_lead_inr: number | null
  cost_per_attributed_bill_inr: number | null
  daily: { day: string; spend_inr: number }[]
}

export type Quality = {
  days: number
  latest: { day: string; score: number; note: string | null } | null
  history: { day: string; score: number; note: string | null }[]
}

export type Lead = {
  id: number
  ig_user_id: string | null
  name: string | null
  phone: string | null
  city: string | null
  product_category: string | null
  need: string | null
  status: string
  store_hint: string | null
  created_at: string
  updated_at: string
}

export const LEAD_STATUSES = ['new', 'called', 'visit_committed', 'visited', 'converted', 'lost'] as const

// --- calls -------------------------------------------------------------------

export const getKpis = (days: number) => req<Kpis>(`/api/kpis?days=${days}`)
export const getFunnel = (days: number) => req<Funnel>(`/api/funnel?days=${days}`)
export const getTimeseries = (days: number) => req<Timeseries>(`/api/timeseries?days=${days}`)
export const getIntents = (days: number) => req<Intents>(`/api/intents?days=${days}`)
export const getCosts = (days: number) => req<Costs>(`/api/costs?days=${days}`)
export const getQuality = (days: number) => req<Quality>(`/api/quality?days=${days}`)
export const getLeads = (status?: string) =>
  req<{ leads: Lead[] }>(`/api/leads${status ? `?status=${encodeURIComponent(status)}` : ''}`)
export const setLeadStatus = (id: number, status: string) =>
  req<{ lead: Lead }>(`/api/leads/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
export const saveQaScore = (score: number) =>
  req<{ ok: true }>(`/api/quality`, { method: 'POST', body: JSON.stringify({ score }) })
