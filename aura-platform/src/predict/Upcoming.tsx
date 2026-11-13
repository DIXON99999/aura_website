import { useEffect, useState } from 'react'
import { getUpcoming, type Prediction } from './api'
import { TeamLogo, Spinner, ErrorNote } from './ui'

const pct = (x: number) => Math.round(x * 100)

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tmr = new Date(now); tmr.setDate(now.getDate() + 1)
  const day = sameDay ? 'Today' : d.toDateString() === tmr.toDateString() ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function MatchCard({ m }: { m: Prediction }) {
  const aFav = m.probA >= m.probB
  const cold = Math.min(m.teamA.games, m.teamB.games) < 5

  const Side = ({ team, prob, fav, align }: { team: Prediction['teamA']; prob: number; fav: boolean; align: 'left' | 'right' }) => (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <TeamLogo name={team.name} logo={team.logo} />
      <div className="min-w-0">
        <div className={`truncate font-display font-semibold ${fav ? 'text-white' : 'text-neutral-400'}`}>{team.name}</div>
        <div className={`font-display text-2xl font-bold tabular-nums ${fav ? (align === 'left' ? 'text-emerald-400' : 'text-sky-400') : 'text-neutral-500'}`}>
          {pct(prob)}<span className="text-sm font-medium">%</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="group rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.045]">
      <div className="mb-3.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        <span className="truncate">{m.league || 'CS2'} · BO{m.bo}</span>
        <span className="text-neutral-400">{timeLabel(m.scheduledAt)}</span>
      </div>

      <div className="flex items-center gap-2">
        <Side team={m.teamA} prob={m.probA} fav={aFav} align="left" />
        <span className="font-display text-xs font-medium text-neutral-600">VS</span>
        <Side team={m.teamB} prob={m.probB} fav={!aFav} align="right" />
      </div>

      {/* split probability bar */}
      <div className="mt-3.5 flex h-2 w-full overflow-hidden rounded-full bg-neutral-800/80">
        <div className="bg-emerald-500/90 transition-all" style={{ width: `${pct(m.probA)}%` }} />
        <div className="bg-sky-500/90 transition-all" style={{ width: `${pct(m.probB)}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="font-display tabular-nums text-neutral-500">
          Elo {m.teamA.elo} · {m.teamB.elo}
        </span>
        <div className="flex items-center gap-2">
          {m.maps?.length ? (
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-neutral-400">{m.maps.join(' · ')}</span>
          ) : null}
          {cold && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-400">low data</span>}
          {m.streamUrl && (
            <a href={m.streamUrl} target="_blank" rel="noreferrer"
               className="rounded-md px-1.5 py-0.5 font-medium text-emerald-400 hover:bg-emerald-400/10">
              Watch ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Upcoming() {
  const [data, setData] = useState<Prediction[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { getUpcoming().then(setData).catch((e) => setErr(String(e))) }, [])

  if (err) return <ErrorNote msg={err} />
  if (!data) return <Spinner label="Loading predictions…" />

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Upcoming matches</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Top teams only · {data.length} match{data.length === 1 ? '' : 'es'} priced
          {data[0] && <span className="text-neutral-600"> · model {data[0].model}</span>}
        </p>
      </div>
      {data.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-8 text-center text-sm text-neutral-400">
          No big matches scheduled right now. Check back when a tournament's live —
          predictions refresh automatically.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((m) => <MatchCard key={m.matchId} m={m} />)}
        </div>
      )}
    </div>
  )
}
