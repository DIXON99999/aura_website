import { useEffect, useState, type ReactNode } from 'react'
import { getUpcoming, getEvents, eventName, type Prediction, type TierFilter, type TourEvent, type Team } from './api'
import { TeamLogo, Spinner, ErrorNote, ThemedCard, Segmented, CardLink, LiveBadge, MapPips } from './ui'
import { stageOf } from './stage'

import { dayAndClock as timeLabel, shortDate } from './time'
import CalendarView from './Calendar'
import { usePoll } from './usePoll'

const pct = (x: number) => Math.round(x * 100)

/** "Round 1: 9z vs LVG" → "Round 1"; names without a round prefix → null */
const roundOf = (name: string) => (name.includes(':') ? name.split(':')[0].trim() : null)

function TbdLogo({ size = 44 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl border border-dashed border-white/15 font-display font-semibold text-neutral-600"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      ?
    </div>
  )
}

function MatchCard({ m }: { m: Prediction }) {
  const live = m.live
  // while live, the big numbers are the odds re-priced from the map score
  const probA = live?.probA ?? m.probA
  const probB = probA == null ? null : 1 - probA
  const priced = probA != null && probB != null && m.teamA && m.teamB
  const aFav = priced && probA! >= probB!
  const cold = priced && Math.min(m.teamA!.games, m.teamB!.games) < 5
  // playoff rounds get a header badge; show other rounds ("Round 1") in the footer
  const round = stageOf(m.name) ? null : roundOf(m.name)

  const Side = ({ team, prob, pre, fav, align }: { team: Team | null; prob: number | null; pre: number | null; fav: boolean; align: 'left' | 'right' }) => (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {team ? <TeamLogo name={team.name} logo={team.logo} /> : <TbdLogo />}
      <div className="min-w-0">
        <div className={`truncate font-display font-semibold ${team ? (fav || !priced ? 'text-white' : 'text-neutral-400') : 'text-neutral-500'}`}>
          {team?.name ?? 'TBD'}
        </div>
        {prob != null ? (
          <div className={`font-display text-2xl font-bold tabular-nums ${fav ? (align === 'left' ? 'text-emerald-400' : 'text-sky-400') : 'text-neutral-500'}`}>
            {pct(prob)}<span className="text-sm font-medium">%</span>
          </div>
        ) : (
          <div className="font-display text-2xl font-bold text-neutral-700">–</div>
        )}
        {live && pre != null && pct(pre) !== pct(prob ?? pre) && (
          <div className="text-[10px] tabular-nums text-neutral-500">was {pct(pre)}%</div>
        )}
      </div>
    </div>
  )

  return (
    <CardLink to={`/match/${m.matchId}`} label={`${m.teamA?.name ?? "TBD"} vs ${m.teamB?.name ?? "TBD"}${live ? ' (live)' : ''}`}>
    <ThemedCard
      league={m.league}
      event={`${eventName(m.league, m.serie)} · BO${m.bo}`}
      matchName={m.name}
      right={live ? <LiveBadge /> : timeLabel(m.scheduledAt)}
      bodyClassName="p-4"
    >
      <div className="flex items-center gap-2">
        <Side team={m.teamA} prob={probA} pre={m.probA} fav={!!aFav} align="left" />
        {live ? (
          <span className="shrink-0 font-display text-xl font-bold tabular-nums text-white">
            {live.scoreA}<span className="mx-1 text-neutral-600">–</span>{live.scoreB}
          </span>
        ) : (
          <span className="font-display text-xs font-medium text-neutral-600">VS</span>
        )}
        <Side team={m.teamB} prob={probB} pre={m.probB} fav={priced ? !aFav : false} align="right" />
      </div>

      {/* split probability bar (empty track until both teams are known) */}
      <div className="mt-3.5 flex h-2 w-full overflow-hidden rounded-full bg-neutral-800/80">
        {priced && <>
          <div className="bg-emerald-500/90 transition-all duration-700" style={{ width: `${pct(probA!)}%` }} />
          <div className="bg-sky-500/90 transition-all duration-700" style={{ width: `${pct(probB!)}%` }} />
        </>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <span className="flex min-w-0 items-center gap-2 truncate font-display tabular-nums text-neutral-500">
          {live ? (
            <><MapPips maps={live.maps} bo={m.bo} /><span className="truncate">Odds update after each map</span></>
          ) : (
            <span className="truncate">
              {priced ? `Elo ${m.teamA!.elo} · ${m.teamB!.elo}` : 'Teams to be determined'}
              {round && <span className="text-neutral-600"> · {round}</span>}
            </span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {m.maps?.length ? (
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-neutral-400">{m.maps.join(' · ')}</span>
          ) : null}
          {cold && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-400">low data</span>}
          {m.streamUrl && (
            <a href={m.streamUrl} target="_blank" rel="noreferrer"
               className="relative z-20 rounded-md px-1.5 py-0.5 font-medium text-emerald-400 hover:bg-emerald-400/10">
              Watch ↗
            </a>
          )}
        </div>
      </div>
    </ThemedCard>
    </CardLink>
  )
}

const MAX_LOGOS = 20 // events are full-width, so a whole Major field fits

function EventCard({ e }: { e: TourEvent }) {
  const extra = e.teams.length - MAX_LOGOS
  return (
    <ThemedCard
      league={e.league}
      event={eventName(e.league, e.serie)}
      right={e.live
        ? <span className="flex items-center gap-1.5 font-bold text-rose-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />LIVE</span>
        : `${shortDate(e.beginAt)} – ${shortDate(e.endAt)}`}
      bodyClassName="p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
        {e.region && <span>{e.region}</span>}
        {e.prizepool && <span className="font-medium text-neutral-300">{e.prizepool}</span>}
        <span>{e.teams.length ? `${e.teams.length} teams` : 'Teams TBD'}</span>
      </div>
      {e.stages.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {e.stages.map((s) => (
            <span key={s.name} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300">
              {s.name}<span className="text-neutral-500"> · {shortDate(s.beginAt)}</span>
            </span>
          ))}
        </div>
      )}
      </div>
      {e.teams.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {e.teams.slice(0, MAX_LOGOS).map((t) => (
            <span key={t.name} title={t.name}><TeamLogo name={t.name} logo={t.logo} size={30} /></span>
          ))}
          {extra > 0 && <span className="pl-1 text-xs text-neutral-500">+{extra} more</span>}
        </div>
      )}
    </ThemedCard>
  )
}

const FILTERS: { value: TierFilter; label: string }[] = [
  { value: 'tier1', label: 'Tier 1' },
  { value: 'other', label: 'Other' },
]

const COPY: Record<TierFilter, { sub: string; empty: string }> = {
  tier1: {
    sub: 'S & A-tier tournaments',
    empty: "No tier 1 matches scheduled right now. Check back when a big event's on — predictions refresh automatically.",
  },
  other: {
    sub: 'Lower-tier events featuring well-known teams',
    empty: 'No other matches scheduled right now — predictions refresh automatically.',
  },
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">{children}</h2>
}

type View = 'list' | 'calendar'
const VIEWS: { value: View; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'calendar', label: 'Calendar' },
]
const VIEW_KEY = 'csodds.matchesView'
/** ?view=list|calendar wins (shareable links), then the viewer's last choice. */
function loadView(): View {
  const q = new URLSearchParams(window.location.search).get('view')
  if (q === 'calendar' || q === 'list') return q
  try { return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list' } catch { return 'list' }
}

export default function Upcoming() {
  // default Tier 1; ?tier=other opens the Other tab (shareable links)
  const [tier, setTier] = useState<TierFilter>(() =>
    new URLSearchParams(window.location.search).get('tier') === 'other' ? 'other' : 'tier1')
  const [view, setViewState] = useState<View>(loadView)
  const setView = (v: View) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode — just don't remember */ }
  }
  const [data, setData] = useState<Prediction[] | null>(null)
  const [events, setEvents] = useState<TourEvent[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { getEvents().then(setEvents).catch(() => setEvents([])) }, [])
  useEffect(() => {
    setData(null)
    getUpcoming(tier).then(setData).catch((e) => setErr(String(e)))
  }, [tier])
  // while any match is live, refresh scores + odds every 30s (silently, no spinner)
  usePoll(!!data?.some((m) => m.live), () => { getUpcoming(tier).then(setData).catch(() => {}) })

  if (err) return <ErrorNote msg={err} />
  const copy = COPY[tier]
  const priced = data?.filter((m) => m.probA != null).length ?? 0
  const showEvents = tier === 'tier1' && events.length > 0

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Upcoming matches</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {copy.sub}
            {data && <> · {priced} match{priced === 1 ? '' : 'es'} priced</>}
            {data?.[0] && <span className="text-neutral-600"> · model {data[0].model}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented options={VIEWS} value={view} onChange={setView} />
          <Segmented options={FILTERS} value={tier} onChange={setTier} />
        </div>
      </div>

      {view === 'calendar' ? (
        !data ? <Spinner label="Loading predictions…" /> : (
          <CalendarView
            key={tier} // reset the selected day when switching tier
            matches={data}
            events={tier === 'tier1' ? events : []}
            renderCard={(m) => <MatchCard key={m.matchId} m={m} />}
          />
        )
      ) : <>
      {showEvents && (
        <section className="mb-7">
          <SectionTitle>Events</SectionTitle>
          <div className="space-y-3">
            {events.map((e) => <EventCard key={e.id} e={e} />)}
          </div>
        </section>
      )}

      {!data ? (
        <Spinner label="Loading predictions…" />
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-8 text-center text-sm text-neutral-400">
          {showEvents
            ? 'Matches appear here as soon as the schedule for these events is published.'
            : copy.empty}
          {tier === 'tier1' && (
            <button
              onClick={() => setTier('other')}
              className="mt-3 block w-full font-medium text-emerald-400 hover:text-emerald-300"
            >
              See other matches →
            </button>
          )}
        </div>
      ) : (
        <section>
          {showEvents && <SectionTitle>Matches</SectionTitle>}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((m) => <MatchCard key={m.matchId} m={m} />)}
          </div>
        </section>
      )}
      </>}
    </div>
  )
}
