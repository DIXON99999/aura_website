import { useEffect, useMemo, useState } from 'react'
import { getHistory, eventName, type HistoryRow, type TierFilter } from './api'
import { TeamLogo, Spinner, ErrorNote, ThemedCard, Segmented } from './ui'

const FILTERS: { value: TierFilter | undefined; label: string }[] = [
  { value: 'tier1', label: 'Tier 1' },
  { value: 'other', label: 'Other' },
  { value: undefined, label: 'All' },
]

function dayLabel(iso: string | null) {
  if (!iso) return 'Unknown date'
  const d = new Date(iso)
  const now = new Date()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function PredictionChip({ m }: { m: HistoryRow }) {
  if (m.probA == null) return <span className="text-neutral-600">not priced</span>
  const aFav = m.probA >= 0.5
  const fav = aFav ? m.teamA.name : m.teamB.name
  const pct = Math.round(Math.max(m.probA, 1 - m.probA) * 100)
  return (
    <span className="flex items-center gap-1.5">
      {m.pickSource === 'replay' && (
        <span
          className="text-neutral-600"
          title="Model replay: computed from ratings as they stood before this match, not a pick published at the time"
        >
          replay
        </span>
      )}
      <span
        className={`rounded-md px-1.5 py-0.5 font-medium ${
          m.correct ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
        }`}
      >
        {m.correct ? '✓' : '✗'} Picked {fav} {pct}%
      </span>
    </span>
  )
}

function ResultRow({ m }: { m: HistoryRow }) {
  const aWon = m.winnerId === m.teamA.id
  const Side = ({ team, won, align }: { team: HistoryRow['teamA']; won: boolean; align: 'left' | 'right' }) => (
    <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <TeamLogo name={team.name} logo={team.logo} size={32} />
      <span className={`truncate font-display font-semibold ${won ? 'text-white' : 'text-neutral-500'}`}>{team.name}</span>
    </div>
  )
  return (
    <ThemedCard
      league={m.league}
      event={`${eventName(m.league, m.serie)}${m.bo ? ` · BO${m.bo}` : ''}`}
      bodyClassName="px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <Side team={m.teamA} won={aWon} align="left" />
        <div className="shrink-0 font-display text-xl font-bold tabular-nums">
          <span className={aWon ? 'text-white' : 'text-neutral-500'}>{m.teamA.score ?? '–'}</span>
          <span className="mx-1.5 text-neutral-600">:</span>
          <span className={!aWon ? 'text-white' : 'text-neutral-500'}>{m.teamB.score ?? '–'}</span>
        </div>
        <Side team={m.teamB} won={!aWon} align="right" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-neutral-600">{m.forfeit ? 'Forfeit' : ''}</span>
        <PredictionChip m={m} />
      </div>
    </ThemedCard>
  )
}

export default function History() {
  const [tier, setTier] = useState<TierFilter | undefined>('tier1')
  const [data, setData] = useState<HistoryRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    getHistory(tier).then(setData).catch((e) => setErr(String(e)))
  }, [tier])

  // group consecutive rows by local day (rows arrive newest first)
  const groups = useMemo(() => {
    const out: { day: string; rows: HistoryRow[] }[] = []
    for (const m of data || []) {
      const day = dayLabel(m.finishedAt)
      if (out.at(-1)?.day === day) out.at(-1)!.rows.push(m)
      else out.push({ day, rows: [m] })
    }
    return out
  }, [data])

  if (err) return <ErrorNote msg={err} />

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Match history</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Final scores with the model's pre-match pick
            {data && data.length > 0 && (() => {
              const graded = data.filter((m) => m.correct != null)
              const hits = graded.filter((m) => m.correct).length
              return graded.length ? <span className="text-neutral-400"> · {hits}/{graded.length} correct ({Math.round((hits / graded.length) * 100)}%)</span> : null
            })()}
          </p>
        </div>
        <Segmented options={FILTERS} value={tier} onChange={setTier} />
      </div>

      {!data ? (
        <Spinner label="Loading results…" />
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-8 text-center text-sm text-neutral-400">
          No finished matches recorded yet — results are pulled in automatically as matches end.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{g.day}</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {g.rows.map((m) => <ResultRow key={m.matchId} m={m} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
