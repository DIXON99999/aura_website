import { useEffect, useState } from 'react'
import { getAccuracy, type Accuracy as A } from './api'
import { Spinner, ErrorNote } from './ui'

export default function Accuracy() {
  const [data, setData] = useState<A | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { getAccuracy().then(setData).catch((e) => setErr(String(e))) }, [])

  if (err) return <ErrorNote msg={err} />
  if (!data) return <Spinner label="Loading results…" />

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Model accuracy</h1>
        <p className="mt-1 text-sm text-neutral-500">Every finished match the model priced beforehand, graded automatically</p>
      </div>

      {data.total === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-6 text-sm leading-relaxed text-neutral-400">
          No settled predictions yet. As today's matches finish, each one is graded against
          what the model said beforehand, and the running accuracy and calibration appear here.
          <div className="mt-3 inline-block rounded-lg bg-white/5 px-3 py-1.5 font-display text-neutral-300">
            Backtested baseline: <span className="font-bold text-emerald-400">62.5%</span> on held-out pro matches
          </div>
        </div>
      ) : (
        <>
          <div className="mb-7 grid grid-cols-2 gap-3 sm:max-w-sm">
            <Stat label="Hit rate" value={`${Math.round((data.accuracy ?? 0) * 100)}%`} accent />
            <Stat label="Correct calls" value={`${data.correct} / ${data.total}`} />
          </div>

          <h2 className="mb-1 font-display text-sm font-semibold text-neutral-200">Calibration</h2>
          <p className="mb-4 text-xs text-neutral-500">
            When the model says 70%, does the favourite win ~70% of the time? Closer bars = better-calibrated.
          </p>
          <div className="space-y-2">
            {data.calibration.map((b, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 font-display tabular-nums text-neutral-400">
                  said {Math.round(b.predicted * 100)}%
                </span>
                <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-neutral-800/70">
                  <div className="h-full rounded-md bg-gradient-to-r from-sky-600 to-sky-400" style={{ width: `${b.actual * 100}%` }} />
                  {/* marker for where the prediction sits */}
                  <div className="absolute top-0 h-full w-0.5 bg-white/60" style={{ left: `${b.predicted * 100}%` }} title="predicted" />
                </div>
                <span className="w-24 shrink-0 text-right font-display tabular-nums text-neutral-300">
                  won {Math.round(b.actual * 100)}% <span className="text-neutral-600">({b.n})</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-neutral-600">The white line marks what the model predicted; the bar shows what actually happened.</p>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-5 py-4">
      <div className={`font-display text-3xl font-bold tabular-nums ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  )
}
