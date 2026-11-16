import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHistory, getBrackets, eventName, type BracketEvent, type HistoryRow, type TierFilter } from './api'
import { TeamLogo, Spinner, ErrorNote, ThemedCard, Segmented, CardLink } from './ui'
import { clock, dayLabel, melbourneDay } from './time'
import { currentStreak, windowRecord } from './streaks'

const FILTERS: { value: TierFilter | undefined; label: string }[] = [
  { value: 'tier1', label: 'Tier 1' },
  { value: 'other', label: 'Other' },
  { value: undefined, label: 'All' },
]


function ResultRow({ m }: { m: HistoryRow }) {
  const aWon = m.winnerId === m.teamA.id
  // same layout as the upcoming match cards, with the final score in place of the %
  const Side = ({ team, won, align }: { team: HistoryRow['teamA']; won: boolean; align: 'left' | 'right' }) => (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <TeamLogo name={team.name} logo={team.logo} />
      <div className="min-w-0">
        <div className={`truncate font-display font-semibold ${won ? 'text-white' : 'text-neutral-400'}`}>{team.name}</div>
        <div className={`font-display text-2xl font-bold tabular-nums ${won ? 'text-white' : 'text-neutral-500'}`}>
          {team.score ?? '–'}
        </div>
      </div>
    </div>
  )
  return (
    <CardLink to={`/match/${m.matchId}`} label={`${m.teamA.name} vs ${m.teamB.name}`}>
    <ThemedCard
      league={m.league}
      event={`${eventName(m.league, m.serie)}${m.bo ? ` · BO${m.bo}` : ''}`}
      matchName={m.name}
      tone={m.correct == null ? 'neutral' : m.correct ? 'good' : 'bad'}
      right={<>
        {m.forfeit && <span className="text-neutral-500">Forfeit</span>}
        {m.finishedAt && <span>{clock(m.finishedAt)}</span>}
      </>}
      bodyClassName="p-4"
    >
      <div className="flex items-center gap-2">
        <Side team={m.teamA} won={aWon} align="left" />
        <span className="font-display text-xs font-medium text-neutral-600">VS</span>
        <Side team={m.teamB} won={!aWon} align="right" />
      </div>
      {m.probA != null && (
        // pre-match split, same colours as the upcoming cards
        <div className="mt-3.5 flex items-center gap-2 font-display text-[11px] font-semibold tabular-nums">
          <span className={m.probA >= 0.5 ? 'text-emerald-400' : 'text-neutral-500'}>{Math.round(m.probA * 100)}%</span>
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800/80">
            <div className="bg-emerald-500/90" style={{ width: `${m.probA * 100}%` }} />
            <div className="bg-sky-500/90" style={{ width: `${(1 - m.probA) * 100}%` }} />
          </div>
          <span className={m.probA < 0.5 ? 'text-sky-400' : 'text-neutral-500'}>{Math.round((1 - m.probA) * 100)}%</span>
        </div>
      )}
    </ThemedCard>
    </CardLink>
  )
}

export default function History() {
  const [tier, setTier] = useState<TierFilter | undefined>('tier1')
  const [data, setData] = useState<HistoryRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [brackets, setBrackets] = useState<BracketEvent[]>([])
  useEffect(() => { getBrackets().then(setBrackets).catch(() => setBrackets([])) }, [])

  useEffect(() => {
    setData(null)
    getHistory(tier).then(setData).catch((e) => setErr(String(e)))
  }, [tier])

  // group consecutive rows by Melbourne day (rows arrive newest first)
  const groups = useMemo(() => {
    const out: { key: string; day: string; rows: HistoryRow[] }[] = []
    for (const m of data || []) {
      const key = melbourneDay(m.finishedAt)
      if (out.at(-1)?.key === key) out.at(-1)!.rows.push(m)
      else out.push({ key, day: m.finishedAt ? dayLabel(m.finishedAt, true) : 'Unknown date', rows: [m] })
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

      {tier === 'tier1' && brackets.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-neutral-500">Brackets</span>
          {brackets.map((b) => (
            <Link key={b.serieId} to={`/event/${b.serieId}`}
              className="rounded-lg bg-white/5 px-2.5 py-1 font-medium text-neutral-300 hover:bg-white/10 hover:text-white">
              {b.live && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500 align-middle" />}
              {eventName(b.league, b.serie)}
            </Link>
          ))}
        </div>
      )}

      {data && data.length > 0 && (() => {
        const week = windowRecord(data, 7)
        const streak = currentStreak(data)
        if (!week.total && !streak) return null
        return (
          <div className="mb-6 flex flex-wrap gap-3">
            {week.total > 0 && (
              <div className="rounded-xl bg-white/[0.035] px-4 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">This week</div>
                <div className="font-display text-lg font-bold tabular-nums text-white">
                  {week.hits}<span className="text-neutral-500">/{week.total}</span>
                  <span className="ml-1.5 text-sm font-medium text-neutral-400">{Math.round((week.hits / week.total) * 100)}%</span>
                </div>
              </div>
            )}
            {streak && streak.length >= 2 && (
              <div className={`rounded-xl px-4 py-2.5 ${streak.kind === 'correct' ? 'bg-emerald-500/[0.12] ring-1 ring-emerald-400/25' : 'bg-white/[0.035]'}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Current run</div>
                <div className={`font-display text-lg font-bold tabular-nums ${streak.kind === 'correct' ? 'text-emerald-300' : 'text-neutral-300'}`}>
                  {streak.length} {streak.kind === 'correct' ? 'correct' : 'misses'} in a row
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {!data ? (
        <Spinner label="Loading results…" />
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-8 text-center text-sm text-neutral-400">
          No finished matches recorded yet — results are pulled in automatically as matches end.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
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
