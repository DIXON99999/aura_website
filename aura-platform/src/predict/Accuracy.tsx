import { useEffect, useState } from 'react'
import { getAccuracy, type Accuracy as A, type ModelBacktest } from './api'
import { Spinner, ErrorNote } from './ui'

const pct = (x: number | null | undefined) => (x == null ? '–' : `${(x * 100).toFixed(1)}%`)

/** One backtested model version; `prev` is the version before it, for deltas. */
function ModelCard({ m, live, prev }: { m: ModelBacktest; live: boolean; prev?: ModelBacktest }) {
  const delta = (cur: number, old: number | undefined, lowerIsBetter = false, asPct = false) => {
    if (old == null) return null
    const d = cur - old
    const good = lowerIsBetter ? d < 0 : d > 0
    const txt = asPct ? `${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pt` : `${d > 0 ? '+' : ''}${d.toFixed(4)}`
    return <span className={`ml-1 text-[11px] font-semibold ${good ? 'text-emerald-400' : 'text-rose-400'}`}>{txt}</span>
  }
  return (
    <div className={`rounded-2xl p-4 ${live ? 'bg-emerald-500/[0.08] ring-1 ring-emerald-400/30' : 'bg-white/[0.035]'}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display font-semibold text-white">{m.version}</div>
          <div className="truncate text-xs text-neutral-500">{m.summary}</div>
        </div>
        {live && <span className="shrink-0 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-black">LIVE</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Accuracy</dt>
          <dd className="font-display font-bold tabular-nums text-white">{pct(m.accuracy)}{delta(m.accuracy, prev?.accuracy, false, true)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Tier 1</dt>
          <dd className="font-display font-bold tabular-nums text-white">{pct(m.tier1Accuracy)}{delta(m.tier1Accuracy, prev?.tier1Accuracy, false, true)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Brier</dt>
          <dd className="font-display tabular-nums text-neutral-200">{m.brier.toFixed(4)}{delta(m.brier, prev?.brier, true)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Log-loss</dt>
          <dd className="font-display tabular-nums text-neutral-200">{m.logLoss.toFixed(4)}{delta(m.logLoss, prev?.logLoss, true)}</dd>
        </div>
      </dl>
    </div>
  )
}

export default function Accuracy() {
  const [data, setData] = useState<A | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { getAccuracy().then(setData).catch((e) => setErr(String(e))) }, [])

  if (err) return <ErrorNote msg={err} />
  if (!data) return <Spinner label="Loading results…" />

  const sample = data.backtests.at(-1)

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Model accuracy</h1>
        <p className="mt-1 text-sm text-neutral-500">How each model version scores, and how live predictions have graded</p>
      </div>

      {/* backtest comparison */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-sm font-semibold text-neutral-200">Backtest</h2>
        <p className="mb-3 text-xs leading-relaxed text-neutral-500">
          Each version replays real match history in date order, predicting every match using only what was known before it.
          Scored on the most recent {sample?.n.toLocaleString() ?? '–'} matches ({sample?.tier1N ?? '–'} tier 1), which were never used to tune the model.
          Lower Brier / log-loss = better-calibrated percentages (a coin flip scores 0.25 / 0.693).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.backtests.map((m, i) => (
            <ModelCard key={m.version} m={m} live={m.version === data.currentModel} prev={data.backtests[i - 1]} />
          ))}
        </div>
      </section>

      {/* live grading */}
      <h2 className="mb-1 font-display text-sm font-semibold text-neutral-200">Live predictions</h2>
      {data.total === 0 ? (
        <div className="rounded-2xl bg-white/[0.035] p-6 text-sm leading-relaxed text-neutral-400">
          No settled predictions yet. As matches finish, each one is graded against what the model said beforehand,
          and the running accuracy and calibration appear here.
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-500">Every finished match the model priced beforehand, graded automatically</p>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-sm">
            <Stat label="Hit rate" value={`${Math.round((data.accuracy ?? 0) * 100)}%`} accent />
            <Stat label="Correct calls" value={`${data.correct} / ${data.total}`} />
          </div>

          {data.byModel.length > 1 && (
            <div className="mb-7 overflow-hidden rounded-2xl bg-white/[0.035] text-sm">
              {data.byModel.map((b) => (
                <div key={b.version} className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5 last:border-0">
                  <span className="font-display text-neutral-200">{b.version}</span>
                  <span className="tabular-nums text-neutral-400">
                    {pct(b.accuracy)} <span className="text-neutral-600">· Brier {b.brier.toFixed(3)} · {b.n} matches</span>
                  </span>
                </div>
              ))}
            </div>
          )}

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
