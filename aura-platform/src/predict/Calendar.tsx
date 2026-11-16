import { useMemo, useState, type ReactNode } from 'react'
import type { Prediction, TourEvent } from './api'
import { eventName } from './api'
import { TeamLogo, orgTheme } from './ui'
import { TZ, dayLabel, melbourneDay } from './time'

// Calendar maths runs on Melbourne day keys ("2026-11-24"), treated as plain
// calendar dates (UTC midnight) so weekday/offset arithmetic is timezone-free.
const keyDate = (k: string) => new Date(`${k}T00:00:00Z`)
const addDays = (k: string, n: number) => new Date(keyDate(k).getTime() + n * 86_400_000).toISOString().slice(0, 10)
const weekday = (k: string) => (keyDate(k).getUTCDay() + 6) % 7 // Mon = 0
const dayNum = (k: string) => Number(k.slice(8, 10))
const monthShort = (k: string) => keyDate(k).toLocaleDateString('en-AU', { timeZone: 'UTC', month: 'short' })
/** an instant that falls on day `k` in Melbourne (≈ midday there) */
const middayOf = (k: string) => `${k}T02:00:00Z`

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3
const MIN_WEEKS = 4 // roughly a month ahead, even when the schedule is sparse
const MAX_WEEKS = 6

const chipTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '')

function MatchChip({ m }: { m: Prediction }) {
  const t = orgTheme(m.league)
  const title = `${m.teamA?.name ?? 'TBD'} vs ${m.teamB?.name ?? 'TBD'} — ${eventName(m.league, m.serie)}`
  return (
    <div
      className="flex items-center gap-1 rounded-md bg-white/[0.06] py-0.5 pl-1 pr-1.5"
      style={{ boxShadow: `inset 2px 0 0 ${t?.bg ?? 'rgba(255,255,255,0.2)'}` }}
      title={title}
    >
      {m.teamA ? <TeamLogo name={m.teamA.name} logo={m.teamA.logo} size={16} /> : <span className="w-4 text-center text-[9px] text-neutral-600">?</span>}
      {m.teamB ? <TeamLogo name={m.teamB.name} logo={m.teamB.logo} size={16} /> : <span className="w-4 text-center text-[9px] text-neutral-600">?</span>}
      {m.live ? (
        <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold tabular-nums text-rose-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />{m.live.scoreA}–{m.live.scoreB}
        </span>
      ) : (
        <span className="ml-auto truncate text-[10px] tabular-nums text-neutral-400">{chipTime(m.scheduledAt)}</span>
      )}
    </div>
  )
}

export default function CalendarView({ matches, events, renderCard }: {
  matches: Prediction[]
  events: TourEvent[]
  renderCard: (m: Prediction) => ReactNode
}) {
  const today = melbourneDay(new Date().toISOString())

  const byDay = useMemo(() => {
    const map = new Map<string, Prediction[]>()
    for (const m of matches) {
      const k = melbourneDay(m.scheduledAt)
      map.set(k, [...(map.get(k) || []), m])
    }
    return map
  }, [matches])

  // event spans as day-key ranges, for the coloured stripes
  const spans = useMemo(() => events
    .filter((e) => e.beginAt)
    .map((e) => ({
      e,
      from: melbourneDay(e.beginAt),
      to: e.endAt ? melbourneDay(e.endAt) : melbourneDay(e.beginAt),
      t: orgTheme(e.league),
    })), [events])

  // grid: Monday of this week → at least MIN_WEEKS weeks, extended to the week
  // holding the last match/event (capped at MAX_WEEKS)
  const weeks = useMemo(() => {
    const start = addDays(today, -weekday(today))
    const minEnd = addDays(start, MIN_WEEKS * 7 - 1)
    const last = [...byDay.keys(), ...spans.map((s) => s.to), minEnd].sort().at(-1)!
    const end = addDays(last, 6 - weekday(last))
    const out: string[][] = []
    for (let k = start; k <= end && out.length < MAX_WEEKS; k = addDays(k, 7)) {
      out.push(Array.from({ length: 7 }, (_, i) => addDays(k, i)))
    }
    return out
  }, [today, byDay, spans])

  const firstWithMatches = [...byDay.keys()].sort().find((k) => k >= today)
  const [selected, setSelected] = useState<string>(firstWithMatches ?? today)
  const dayMatches = byDay.get(selected) || []

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white/[0.035]">
        <div className="grid grid-cols-7 border-b border-white/5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7">
            {week.map((k) => {
              const ms = byDay.get(k) || []
              const past = k < today
              const isSel = k === selected
              const covering = spans.filter((s) => k >= s.from && k <= s.to)
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  className={`relative flex min-h-[64px] flex-col gap-1 border-b border-r border-white/5 p-1.5 text-left transition-colors sm:min-h-[104px] ${
                    isSel ? 'bg-white/[0.09]' : 'hover:bg-white/[0.05]'
                  } ${past ? 'opacity-40' : ''}`}
                >
                  {/* event stripes */}
                  {covering.length > 0 && (
                    <div className="absolute inset-x-0 top-0 flex flex-col">
                      {covering.map((s) => (
                        <div key={s.e.id} className="h-[3px]" style={{ background: s.t?.bg ?? '#a3a3a3' }} />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span
                      className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                        k === today ? 'bg-emerald-500 text-black' : 'text-neutral-300'
                      }`}
                    >
                      {dayNum(k)}
                    </span>
                    {dayNum(k) === 1 && <span className="text-[10px] uppercase text-neutral-500">{monthShort(k)}</span>}
                    {covering.filter((s) => s.from === k).map((s) => (
                      <span key={s.e.id} className="hidden truncate text-[9px] font-bold uppercase sm:inline" style={{ color: s.t?.bg ?? '#a3a3a3' }}>
                        {eventName(s.e.league, s.e.serie)}
                      </span>
                    ))}
                  </div>
                  {/* chips on wider screens, a count dot on phones */}
                  <div className="hidden flex-col gap-1 sm:flex">
                    {ms.slice(0, MAX_CHIPS).map((m) => <MatchChip key={m.matchId} m={m} />)}
                    {ms.length > MAX_CHIPS && <span className="pl-1 text-[10px] text-neutral-500">+{ms.length - MAX_CHIPS} more</span>}
                  </div>
                  {ms.length > 0 && (
                    <span className="mt-auto self-start rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-semibold text-emerald-300 sm:hidden">
                      {ms.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {dayLabel(middayOf(selected), true)}
          <span className="text-neutral-600"> · {dayMatches.length} match{dayMatches.length === 1 ? '' : 'es'}</span>
        </h2>
        {dayMatches.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.035] p-6 text-center text-sm text-neutral-500">
            No matches scheduled this day.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{dayMatches.map(renderCard)}</div>
        )}
      </section>
    </div>
  )
}
