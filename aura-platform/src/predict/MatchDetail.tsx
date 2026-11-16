import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getMatch, eventName, type MatchDetail as Detail, type TeamDetail, type RecentMatch } from './api'
import { TeamLogo, Spinner, ThemedCard, LiveBadge, MapPips } from './ui'
import { usePoll } from './usePoll'
import { FlipCard, Burst } from './Celebrate'
import { dayAndClock, shortDate } from './time'

const pct = (x: number) => `${Math.round(x * 100)}%`
// Team colours: same hues as the probability bars, one step darker so lines
// pass the dark-surface lightness band (validated with the dataviz validator).
const COLOR_A = '#059669'
const COLOR_B = '#0284c7'

function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-sm font-semibold text-neutral-200">{children}</h2>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

const Panel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-white/[0.035] p-4 ${className}`}>{children}</div>
)

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ d }: { d: Detail }) {
  const finished = d.status === 'finished'
  const live = d.live
  // while live, show the odds re-priced from the current map score
  const shownProbA = live?.probA ?? d.probA
  const aWon = finished && d.winnerId != null && d.winnerId === d.teamA?.id
  const bWon = finished && d.winnerId != null && d.winnerId === d.teamB?.id
  const Side = ({ t, side }: { t: TeamDetail | null; side: 'a' | 'b' }) => {
    const prob = shownProbA == null ? null : side === 'a' ? shownProbA : 1 - shownProbA
    const won = side === 'a' ? aWon : bWon
    const fav = prob != null && prob >= 0.5
    const big = finished ? d.score?.[side === 'a' ? 0 : 1] ?? '–' : prob != null ? pct(prob) : '–'
    return (
      <div className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center`}>
        {t ? <TeamLogo name={t.name} logo={t.logo} size={72} /> : <div className="grid h-[72px] w-[72px] place-items-center rounded-xl border border-dashed border-white/15 text-2xl text-neutral-600">?</div>}
        <div className={`max-w-full truncate font-display text-lg font-bold ${t ? (finished ? (won ? 'text-white' : 'text-neutral-400') : 'text-white') : 'text-neutral-500'}`}>
          {t?.name ?? 'TBD'}
        </div>
        <div className="text-xs text-neutral-500">
          {t?.rank ? `#${t.rank} · ` : ''}{t?.elo != null ? `Elo ${t.elo}` : t ? 'Unrated' : ' '}
        </div>
        <div className={`font-display text-4xl font-bold tabular-nums ${
          finished ? (won ? 'text-white' : 'text-neutral-500') : fav ? (side === 'a' ? 'text-emerald-400' : 'text-sky-400') : 'text-neutral-500'
        }`}>
          {big}
        </div>
      </div>
    )
  }
  return (
    <ThemedCard
      league={d.league}
      event={`${eventName(d.league, d.serie)}${d.bo ? ` · BO${d.bo}` : ''}`}
      matchName={d.name}
      right={live ? <LiveBadge /> : d.scheduledAt ? dayAndClock(d.scheduledAt) : null}
      tone={d.correct == null ? 'neutral' : d.correct ? 'good' : 'bad'}
      bodyClassName="p-5"
    >
      <div className="flex items-start gap-3">
        <Side t={d.teamA} side="a" />
        {live ? (
          <div className="flex flex-col items-center gap-2 pt-5">
            <div className="font-display text-3xl font-bold tabular-nums text-white">
              {live.scoreA}<span className="mx-1.5 text-neutral-600">–</span>{live.scoreB}
            </div>
            <MapPips maps={live.maps} bo={d.bo ?? live.maps.length} />
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">maps</div>
          </div>
        ) : (
          <div className="pt-7 font-display text-sm font-medium text-neutral-600">{finished ? 'FINAL' : 'VS'}</div>
        )}
        <Side t={d.teamB} side="b" />
      </div>
      {shownProbA != null && (
        <div className="mt-5">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-800/80">
            <div className="bg-emerald-500/90 transition-all duration-700" style={{ width: `${shownProbA * 100}%` }} />
            <div className="bg-sky-500/90 transition-all duration-700" style={{ width: `${(1 - shownProbA) * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[11px] text-neutral-500">
            <span>
              {finished
                ? `Model's pre-match prediction: ${d.teamA?.name ?? 'TBD'} ${pct(d.probA!)} · ${d.teamB?.name ?? 'TBD'} ${pct(1 - d.probA!)}`
                : live && d.probA != null
                  ? `Live odds from the map score · pre-match ${d.teamA?.name ?? 'TBD'} ${pct(d.probA)} · ${d.teamB?.name ?? 'TBD'} ${pct(1 - d.probA)}`
                  : 'Model win probability'}
              {d.model ? ` · ${d.model}` : ''}
            </span>
            {!finished && d.streamUrl && (
              <a href={d.streamUrl} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-emerald-400 hover:text-emerald-300">Watch ↗</a>
            )}
          </div>
        </div>
      )}
    </ThemedCard>
  )
}

/** The match ended while the page was open: flip from the last live view to
 *  the result, with a burst if the model called it. */
function CelebrateHero({ from, to }: { from: Detail; to: Detail }) {
  const [flipped, setFlipped] = useState(false)
  const [effect, setEffect] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 350)
    const t2 = setTimeout(() => setEffect(true), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  const good = to.correct === true
  return (
    <div className={`relative rounded-2xl ${effect ? (good ? "burst-ring" : to.correct === false ? "upset-shake" : "") : ""}`}>
      <FlipCard flipped={flipped} front={<Hero d={from} />} back={<Hero d={to} />} />
      {effect && good && <Burst />}
      {effect && to.correct != null && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-center text-sm font-semibold ${good ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
          {good ? "✓ Model called it" : "Upset — the model had the other team"}
        </div>
      )}
    </div>
  )
}

// ── Why this prediction ──────────────────────────────────────────────────────
function Why({ d }: { d: Detail }) {
  const e = d.explain!
  const a = d.teamA!, b = d.teamB!
  // tell the story from the favourite's side
  const favA = e.finalProbA >= 0.5
  const fav = favA ? a : b
  const f = (x: number) => (favA ? x : 1 - x)
  const shiftPts = Math.round(f(e.finalProbA) * 100) - Math.round(f(e.seriesProbA) * 100)
  const steps: { label: string; value: string; note: string }[] = [
    {
      label: 'Ratings',
      value: `${Math.round(e.eloA)} – ${Math.round(e.eloB)}`,
      note: Math.abs(e.gap) < 1 ? 'Dead even' : `${e.gap > 0 ? a.name : b.name} +${Math.round(Math.abs(e.gap))} pts`,
    },
    { label: 'One map', value: pct(f(e.mapProbA)), note: `${fav.name} to win a single map` },
    {
      label: `Best of ${e.bo}`,
      value: pct(f(e.seriesProbA)),
      note: e.bo > 1 ? 'Longer series favour the stronger team' : 'Single map — no series effect',
    },
    {
      label: 'Head-to-head',
      value: e.h2h.rate == null ? 'Never met' : `${favA ? e.h2h.aWins : e.h2h.bWins}–${favA ? e.h2h.bWins : e.h2h.aWins}`,
      note: e.h2h.rate == null
        ? 'No adjustment'
        : `Record pulls toward ${pct(f(e.h2h.rate))} · ${shiftPts === 0 ? 'no change' : `${shiftPts > 0 ? '+' : ''}${shiftPts} pts`}`,
    },
  ]
  const settling = [e.provisional.a && a, e.provisional.b && b].filter(Boolean) as TeamDetail[]
  return (
    <section>
      <SectionTitle sub={`How the model gets to ${fav.name} ${pct(f(e.finalProbA))}`}>Why this prediction</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-5">
        {steps.map((s, i) => (
          <div key={s.label} className="relative rounded-xl bg-white/[0.035] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{i + 1}. {s.label}</div>
            <div className="mt-1 font-display text-lg font-bold tabular-nums text-white">{s.value}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-neutral-400">{s.note}</div>
          </div>
        ))}
        <div className="rounded-xl bg-emerald-500/[0.12] p-3 ring-1 ring-emerald-400/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">Prediction</div>
          <div className="mt-1 font-display text-lg font-bold tabular-nums text-emerald-300">{pct(f(e.finalProbA))}</div>
          <div className="mt-0.5 truncate text-[11px] text-neutral-300">{fav.name} to win</div>
        </div>
      </div>
      {settling.length > 0 && (
        <p className="mt-2.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {settling.map((t) => `${t.name} (${t === a ? e.gamesA : e.gamesB} matches)`).join(' and ')}{' '}
          {settling.length > 1 ? 'are' : 'is'} still new to the model — {settling.length > 1 ? 'their ratings are' : 'its rating is'} settling, so treat this with extra caution.
        </p>
      )}
      {d.live && d.live.probA != null && (() => {
        const l = d.live!, lp = favA ? l.probA! : 1 - l.probA!
        const lead = l.scoreA === l.scoreB ? `Level at ${l.scoreA}–${l.scoreB}` : `${l.scoreA > l.scoreB ? a.name : b.name} leads ${Math.max(l.scoreA, l.scoreB)}–${Math.min(l.scoreA, l.scoreB)}`
        return (
          <p className="mt-2.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <b className="text-rose-300">Live:</b> {lead} → {fav.name} now {pct(lp)} (was {pct(f(e.finalProbA))} before the match). The breakdown above is the pre-match prediction.
          </p>
        )
      })()}
    </section>
  )
}

// ── Rating trend chart ───────────────────────────────────────────────────────
const W = 640, H = 170, PAD = { l: 40, r: 110, t: 12, b: 22 }

function RatingTrend({ a, b }: { a: TeamDetail; b: TeamDetail }) {
  const series = [
    { team: a, color: COLOR_A, pts: a.eloTrend.map((p) => ({ t: Date.parse(p.t), elo: p.elo })) },
    { team: b, color: COLOR_B, pts: b.eloTrend.map((p) => ({ t: Date.parse(p.t), elo: p.elo })) },
  ].filter((s) => s.pts.length > 1)
  const all = series.flatMap((s) => s.pts)
  const [hover, setHover] = useState<number | null>(null) // hovered time
  const svgRef = useRef<SVGSVGElement>(null)

  const scale = useMemo(() => {
    if (!all.length) return null
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t))
    const lo = Math.min(...all.map((p) => p.elo)), hi = Math.max(...all.map((p) => p.elo))
    const padY = Math.max(10, (hi - lo) * 0.12)
    const y0 = lo - padY, y1 = hi + padY
    return {
      t0, t1, y0, y1,
      x: (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r),
      y: (e: number) => PAD.t + (1 - (e - y0) / (y1 - y0)) * (H - PAD.t - PAD.b),
      tAt: (px: number) => t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0),
    }
  }, [all])

  if (!scale || !series.length) return <p className="text-sm text-neutral-500">Not enough rated matches to draw a trend yet.</p>

  const ticks = [scale.y0 + (scale.y1 - scale.y0) * 0.2, (scale.y0 + scale.y1) / 2, scale.y0 + (scale.y1 - scale.y0) * 0.8].map(Math.round)
  const valueAt = (pts: { t: number; elo: number }[], t: number) => [...pts].reverse().find((p) => p.t <= t) ?? null
  // direct end labels, nudged apart if they would collide
  const ends = series.map((s) => ({ ...s, last: s.pts.at(-1)!, y: scale.y(s.pts.at(-1)!.elo) }))
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14) {
    const [top, bot] = ends[0].y < ends[1].y ? [ends[0], ends[1]] : [ends[1], ends[0]]
    const mid = (top.y + bot.y) / 2
    top.y = mid - 7; bot.y = mid + 7
  }

  const onMove = (ev: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const px = ((ev.clientX - r.left) / r.width) * W
    if (px < PAD.l || px > W - PAD.r) { setHover(null); return }
    setHover(scale.tAt(px))
  }

  return (
    <div>
      {/* legend (≥2 series) */}
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-neutral-300">
        {series.map((s) => (
          <span key={s.team.id} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />{s.team.name}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          role="img" aria-label={`Rating trend: ${series.map((s) => `${s.team.name} ${s.pts[0].elo} to ${s.pts.at(-1)!.elo}`).join(', ')}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={scale.y(v)} y2={scale.y(v)} stroke="rgba(255,255,255,0.06)" />
              <text x={PAD.l - 6} y={scale.y(v) + 3} textAnchor="end" className="fill-neutral-500 text-[10px]">{v}</text>
            </g>
          ))}
          <text x={PAD.l} y={H - 5} className="fill-neutral-600 text-[10px]">{shortDate(new Date(scale.t0).toISOString())}</text>
          <text x={W - PAD.r} y={H - 5} textAnchor="end" className="fill-neutral-600 text-[10px]">{shortDate(new Date(scale.t1).toISOString())}</text>
          {series.map((s) => (
            <polyline key={s.team.id} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              points={s.pts.map((p) => `${scale.x(p.t)},${scale.y(p.elo)}`).join(' ')} />
          ))}
          {ends.map((s) => (
            <g key={s.team.id}>
              <circle cx={scale.x(s.last.t)} cy={scale.y(s.last.elo)} r={4} fill={s.color} stroke="#141518" strokeWidth={2} />
              <text x={W - PAD.r + 8} y={s.y + 3} className="fill-neutral-300 text-[11px] font-medium">
                {s.team.name.length > 12 ? `${s.team.name.slice(0, 11)}…` : s.team.name} {s.last.elo}
              </text>
            </g>
          ))}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={scale.x(hover)} x2={scale.x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.25)" />
              {series.map((s) => {
                const v = valueAt(s.pts, hover)
                return v && <circle key={s.team.id} cx={scale.x(v.t)} cy={scale.y(v.elo)} r={4} fill={s.color} stroke="#141518" strokeWidth={2} />
              })}
            </g>
          )}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg bg-neutral-900/95 px-2.5 py-1.5 text-[11px] shadow-lg ring-1 ring-white/10"
            style={{ left: `${(scale.x(hover) / W) * 100}%`, transform: scale.x(hover) > W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}
          >
            <div className="mb-0.5 text-neutral-400">{shortDate(new Date(hover).toISOString())}</div>
            {series.map((s) => {
              const v = valueAt(s.pts, hover)
              return (
                <div key={s.team.id} className="flex items-center gap-1.5 text-neutral-200">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.team.name}
                  <span className="ml-auto pl-3 font-semibold tabular-nums">{v ? v.elo : '–'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none hover:text-neutral-300">View as table</summary>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {series.map((s) => (
            <table key={s.team.id} className="w-full text-left tabular-nums">
              <thead><tr className="text-neutral-400"><th className="py-1 font-medium">{s.team.name}</th><th className="py-1 text-right font-medium">Elo</th></tr></thead>
              <tbody>
                {[...s.pts].reverse().map((p, i) => (
                  <tr key={i} className="border-t border-white/5"><td className="py-0.5">{shortDate(new Date(p.t).toISOString())}</td><td className="py-0.5 text-right text-neutral-300">{p.elo}</td></tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </details>
    </div>
  )
}

// ── Form & head-to-head ──────────────────────────────────────────────────────
function FormPills({ form }: { form: string }) {
  if (!form) return <span className="text-xs text-neutral-600">No recent matches</span>
  return (
    <div className="flex gap-1" aria-label={`Recent form ${form}`}>
      {form.split('').map((c, i) => (
        <span key={i} className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${c === 'W' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{c}</span>
      ))}
    </div>
  )
}

function Score({ r }: { r: Pick<RecentMatch, 'score' | 'forfeit'> }) {
  if (r.forfeit) return <span className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] font-semibold text-neutral-400" title="Forfeit">FF</span>
  return <span className="shrink-0 font-display tabular-nums text-neutral-300">{r.score[0] ?? '–'}–{r.score[1] ?? '–'}</span>
}

function ResultLine({ r }: { r: RecentMatch }) {
  return (
    <Link to={`/match/${r.matchId}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.05]">
      <span className={`w-4 shrink-0 text-center text-[11px] font-bold ${r.won ? 'text-emerald-400' : 'text-rose-400'}`}>{r.won ? 'W' : 'L'}</span>
      <TeamLogo name={r.opponent.name} logo={r.opponent.logo} size={20} />
      <span className="min-w-0 flex-1 truncate text-neutral-200">{r.opponent.name}</span>
      <Score r={r} />
      <span className="hidden w-16 shrink-0 text-right text-[11px] text-neutral-500 sm:block">{shortDate(r.playedAt)}</span>
    </Link>
  )
}

function TeamForm({ t }: { t: TeamDetail }) {
  return (
    <Panel>
      <div className="mb-2.5 flex items-center gap-2.5">
        <TeamLogo name={t.name} logo={t.logo} size={28} />
        <span className="min-w-0 flex-1 truncate font-display font-semibold text-white">{t.name}</span>
        <FormPills form={t.form.slice(0, 5)} />
      </div>
      {t.recent.length === 0 ? (
        <p className="px-2 text-sm text-neutral-500">No recorded matches.</p>
      ) : (
        <div className="-mx-2">{t.recent.map((r) => <ResultLine key={r.matchId} r={r} />)}</div>
      )}
    </Panel>
  )
}

function HeadToHead({ d }: { d: Detail }) {
  const h = d.h2h!, a = d.teamA!, b = d.teamB!
  const n = h.aWins + h.bWins
  return (
    <Panel>
      {n === 0 ? (
        <p className="text-sm text-neutral-500">These teams haven't met in the last ~14 months of recorded matches.</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between font-display text-sm">
            <span className="flex items-center gap-2 text-white"><TeamLogo name={a.name} logo={a.logo} size={22} />{a.name} <b className="tabular-nums">{h.aWins}</b></span>
            <span className="flex items-center gap-2 text-white"><b className="tabular-nums">{h.bWins}</b> {b.name}<TeamLogo name={b.name} logo={b.logo} size={22} /></span>
          </div>
          <div className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
            <div className="rounded-l-full bg-emerald-500/90" style={{ width: `${(h.aWins / n) * 100}%` }} />
            <div className="rounded-r-full bg-sky-500/90" style={{ width: `${(h.bWins / n) * 100}%` }} />
          </div>
          <div className="-mx-2">
            {h.meetings.map((m) => (
              <Link key={m.matchId} to={`/match/${m.matchId}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.05]">
                <span className="w-16 shrink-0 text-[11px] text-neutral-500">{shortDate(m.playedAt)}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-200">{m.won ? a.name : b.name} won</span>
                <Score r={m} />
                <span className="hidden max-w-[40%] truncate text-right text-[11px] text-neutral-500 sm:block">{m.event}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setD(null); setErr(null); setCelebrateFrom(null)
    getMatch(id!).then(setD).catch((e) => setErr(String(e)))
    window.scrollTo(0, 0)
  }, [id])
  // live matches: refresh the score and odds every 30s
  // live matches: refresh the score and odds every 30s; if it finishes while
  // the page is open, flip the hero from the last live view to the result
  const [celebrateFrom, setCelebrateFrom] = useState<Detail | null>(null)
  usePoll(d?.status === "live", () => {
    getMatch(id!).then((next) => {
      if (d?.status === "live" && next.status === "finished") setCelebrateFrom(d)
      setD(next)
    }).catch(() => {})
  })

  const back = (
    <div className="mb-4 flex items-center justify-between gap-3 text-sm">
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="text-neutral-400 hover:text-white">← Back</button>
      {d?.bracket && (
        <Link to={`/event/${d.bracket.serieId}?stage=${d.bracket.tournamentId}`}
          className="rounded-lg bg-white/5 px-3 py-1.5 font-medium text-neutral-300 hover:bg-white/10 hover:text-white">View bracket →</Link>
      )}
    </div>
  )

  if (err) return <div>{back}<p className="rounded-xl bg-white/[0.035] p-6 text-sm text-neutral-400">{err.includes('404') ? 'Match not found.' : `Couldn't load this match (${err}).`}</p></div>
  if (!d) return <div>{back}<Spinner label="Loading match…" /></div>

  return (
    <div>
      {back}
      <div className="space-y-7">
        {celebrateFrom ? <CelebrateHero from={celebrateFrom} to={d} /> : <Hero d={d} />}
        {d.explain && d.teamA && d.teamB && <Why d={d} />}
        {d.teamA && d.teamB && (
          <section>
            <SectionTitle sub="Rating after each match, last 30 matches. Hover for values.">Rating trend</SectionTitle>
            <Panel><RatingTrend a={d.teamA} b={d.teamB} /></Panel>
          </section>
        )}
        {(d.teamA || d.teamB) && (
          <section>
            <SectionTitle sub="Last 10 matches, newest first">Recent form</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {d.teamA && <TeamForm t={d.teamA} />}
              {d.teamB && <TeamForm t={d.teamB} />}
            </div>
          </section>
        )}
        {d.h2h && d.teamA && d.teamB && (
          <section>
            <SectionTitle>Head-to-head</SectionTitle>
            <HeadToHead d={d} />
          </section>
        )}
      </div>
    </div>
  )
}
