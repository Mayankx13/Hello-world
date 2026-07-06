import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Timeseries } from '../api'
import { shortDay } from '../format'
import { CardSkeleton, EmptyState } from './bits'

const BLUE = 'var(--chart-blue)'
const AMBER = 'var(--chart-amber)'

export function VolumeCard({ ts }: { ts: Timeseries | null }) {
  if (!ts) return <CardSkeleton lines={6} />

  const total = ts.series.reduce((a, d) => a + d.dms_in + d.dms_out, 0)
  const data = ts.series.map((d) => ({ ...d, dms: d.dms_in + d.dms_out, day: shortDay(d.day) }))

  return (
    <div className="card">
      <h2>Daily DM volume</h2>
      <p className="sub">last {ts.days} days · all DMs vs handoffs</p>
      {total === 0 ? (
        <EmptyState title="No DM traffic yet" note="Daily volume appears here from day one." icon="📈" />
      ) : (
        <>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--line)' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--ink-3)', strokeDasharray: '3 3' }}
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                    fontSize: 12.5,
                    fontFamily: 'inherit',
                  }}
                  formatter={(value: number, name: string) => [value, name === 'dms' ? 'All DMs' : 'Handoffs']}
                />
                <Line type="monotone" dataKey="dms" stroke={BLUE} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line
                  type="monotone"
                  dataKey="handoffs"
                  stroke={AMBER}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            <span>
              <span className="dot" style={{ background: BLUE }} />
              All DMs
            </span>
            <span>
              <span className="dot" style={{ background: AMBER }} />
              Handoffs
            </span>
          </div>
        </>
      )}
    </div>
  )
}
