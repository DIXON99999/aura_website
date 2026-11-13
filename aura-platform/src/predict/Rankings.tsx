import { useEffect, useState } from 'react'
import { getRankings, type RankRow } from './api'
import { TeamLogo, Spinner, ErrorNote } from './ui'

const RANK_COLOR: Record<number, string> = {
  1: 'text-amber-300',
  2: 'text-neutral-300',
  3: 'text-orange-400',
}

export default function Rankings() {
  const [data, setData] = useState<RankRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { getRankings().then(setData).catch((e) => setErr(String(e))) }, [])

  if (err) return <ErrorNote msg={err} />
  if (!data) return <Spinner label="Loading rankings…" />

  const max = data[0]?.elo ?? 2000
  const min = Math.min(...data.map((d) => d.elo)) - 60

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Power rankings</h1>
        <p className="mt-1 text-sm text-neutral-500">Map-level Elo · teams with 20+ matches</p>
      </div>
      <div className="space-y-1.5">
        {data.map((t) => {
          const w = Math.max(6, ((t.elo - min) / (max - min)) * 100)
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
            >
              <span className={`w-6 text-center font-display text-sm font-bold tabular-nums ${RANK_COLOR[t.rank] ?? 'text-neutral-600'}`}>
                {t.rank}
              </span>
              <TeamLogo name={t.name} logo={t.logo} size={32} />
              <span className="w-32 shrink-0 truncate font-display font-medium sm:w-44">{t.name}</span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                  style={{ width: `${w}%` }}
                />
              </div>
              <span className="w-12 text-right font-display text-sm font-bold tabular-nums">{t.elo}</span>
              <span className="hidden w-10 text-right text-xs tabular-nums text-neutral-600 sm:block">{t.games}g</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
