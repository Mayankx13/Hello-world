import { useCallback, useEffect, useState } from 'react'
import {
  getKpis,
  getFunnel,
  getTimeseries,
  getIntents,
  getCosts,
  getQuality,
  ApiError,
  type Kpis,
  type Funnel,
  type Timeseries,
  type Intents,
  type Costs,
  type Quality,
} from './api'
import { KpiRow } from './components/KpiRow'
import { FunnelCard } from './components/FunnelCard'
import { VolumeCard } from './components/VolumeCard'
import { IntentsCard } from './components/IntentsCard'
import { EconPanel } from './components/EconPanel'
import { LeadsPanel } from './components/LeadsPanel'
import { ErrorBanner, EmptyState } from './components/bits'

const RANGES = [7, 14, 30] as const

type Data = {
  kpis: Kpis
  funnel: Funnel
  ts: Timeseries
  intents: Intents
  costs: Costs
  quality: Quality
}

export default function App() {
  const [days, setDays] = useState<number>(7)
  const [tab, setTab] = useState<'overview' | 'leads'>('overview')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setData(null)
    setError(null)
    try {
      const [kpis, funnel, ts, intents, costs, quality] = await Promise.all([
        getKpis(days),
        getFunnel(days),
        getTimeseries(days),
        getIntents(days),
        getCosts(days),
        getQuality(days),
      ])
      setData({ kpis, funnel, ts, intents, costs, quality })
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status}: ${e.message}` : 'network error')
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const refreshQuality = useCallback(async () => {
    try {
      const quality = await getQuality(days)
      setData((d) => (d ? { ...d, quality } : d))
    } catch {
      /* panel keeps showing the previous value */
    }
  }, [days])

  const noDmsYet = data !== null && data.kpis.dms.handled === 0 && data.kpis.leads.total === 0

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <h1>
            LIQO <span className="accent">DM Command</span> Dashboard
          </h1>
          <div className="range" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r} aria-pressed={days === r} onClick={() => setDays(r)}>
                {r}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="shell">
        <div className="tabs" role="tablist" aria-label="Sections">
          <button role="tab" aria-pressed={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button role="tab" aria-pressed={tab === 'leads'} onClick={() => setTab('leads')}>
            Leads
          </button>
        </div>

        {error && <ErrorBanner message={error} onRetry={load} />}

        <section className="panel" hidden={tab !== 'overview'}>
          {noDmsYet ? (
            <div className="card" style={{ marginBottom: 14 }}>
              <EmptyState
                icon="🚀"
                title="No DMs yet"
                note="The concierge goes live after Meta App Review — this dashboard fills in from the first message."
              />
            </div>
          ) : (
            <KpiRow kpis={data?.kpis ?? null} />
          )}

          <div className="grid-2">
            <FunnelCard funnel={data?.funnel ?? null} />
            <VolumeCard ts={data?.ts ?? null} />
          </div>

          <div className="grid-2">
            <IntentsCard intents={data?.intents ?? null} />
            <EconPanel
              costs={data?.costs ?? null}
              quality={data?.quality ?? null}
              kpis={data?.kpis ?? null}
              onQaSaved={refreshQuality}
            />
          </div>
        </section>

        <section className="panel" hidden={tab !== 'leads'}>
          <LeadsPanel />
        </section>
      </main>

      <footer className="footer">
        Amaflip India Pvt. Ltd. · internal tool · LIQO discounted electronics
      </footer>
    </>
  )
}
