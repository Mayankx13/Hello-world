// Indian number formatting: en-IN digit grouping, ₹ with lakh/crore
// abbreviation above 99,999.

export function inr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e7) return `${sign}₹${trim((abs / 1e7).toFixed(2))} Cr`
  if (abs > 99_999) return `${sign}₹${trim((abs / 1e5).toFixed(2))} L`
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: abs < 100 ? 2 : 0 })}`
}

const trim = (s: string) => s.replace(/\.?0+$/, '')

export function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN')
}

export function pctLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n % 1 === 0 ? n : n.toFixed(1)}%`
}

// '2026-07-06' -> '6 Jul'
export function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const LABELS: Record<string, string> = {
  new: 'New',
  called: 'Called',
  visit_committed: 'Visit committed',
  visited: 'Visited',
  converted: 'Converted',
  lost: 'Lost',
  ac: 'AC',
  tv: 'TV',
  fridge: 'Fridge',
  wm: 'Washing machine',
  other: 'Other',
}

export const label = (key: string | null | undefined): string => {
  if (!key) return '—'
  return LABELS[key] ?? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
