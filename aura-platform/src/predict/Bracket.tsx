// Bracket page: an event's stages as a bracket (or Swiss record grid). On open,
// the latest results replay in order — the score lands, then the winner's chip
// slides into its next slot and the loser drops to the lower bracket or fades out.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBracket, eventName, type BracketStage, type EventBracket } from './api'
import {
  layoutBracket, bracketMoves, swissLayout, pickReplay, defaultStage, SWISS_WINS,
  type LaidMatch, type Move, type Slot, type BracketLayout, type SwissLayout, type BTeam,
} from './bracketGraph'
import { ThemedCard, TeamLogo, LiveBadge, Segmented, Spinner, ErrorNote } from './ui'
import { dayAndClock, shortDate } from './time'
import { usePoll } from './usePoll'

const pct = (x: number) => `${Math.round(x * 100)}%`
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ---- replay state ----------------------------------------------------------

interface ReplayState {
  /** slots whose team hasn't "arrived" yet */
  hidden: Set<string>
  /** matches whose result hasn't been revealed yet */
  pending: Set<number>
}
const EMPTY: ReplayState = { hidden: new Set(), pending: new Set() }

const seenKey = (tournamentId: string) => `csodds.bracket.seen.${tournamentId}`
function readSeen(id: string): number | null {
  try { const v = localStorage.getItem(seenKey(id)); return v ? Number(v) || null : null } catch { return null }
}
function writeSeen(id: string, at: number) {
  try { localStorage.setItem(seenKey(id), String(at)) } catch { /* private mode — fine */ }
}

/** Fly a clone of the chip at slot `from` to slot `to` (both inside `content`). */
function fly(content: HTMLElement, scroller: HTMLElement | null, overlay: HTMLElement, from: string, to: string, kind: 'win' | 'lose') {
  return new Promise<void>((done) => {
    const src = content.querySelector<HTMLElement>(`[data-slot="${from}"] [data-chip]`)
    const dstSlot = content.querySelector<HTMLElement>(`[data-slot="${to}"]`)
    const dst = dstSlot?.querySelector<HTMLElement>('[data-chip]') ?? dstSlot
    if (!src || !dst || !dstSlot) return done()
    // keep the landing spot in view when the bracket scrolls sideways (phones)
    if (scroller) {
      const s = scroller.getBoundingClientRect(), d = dst.getBoundingClientRect()
      if (d.right > s.right - 16 || d.left < s.left + 16)
        scroller.scrollBy({ left: d.left - s.left - s.width / 2 + d.width / 2, behavior: 'smooth' })
    }
    const c = content.getBoundingClientRect(), a = src.getBoundingClientRect(), b = dst.getBoundingClientRect()
    const ghost = src.cloneNode(true) as HTMLElement
    ghost.classList.remove('invisible')
    ghost.classList.add('bracket-ghost', kind === 'win' ? 'bracket-ghost-win' : 'bracket-ghost-lose')
    Object.assign(ghost.style, { left: `${a.left - c.left}px`, top: `${a.top - c.top}px`, width: `${a.width}px`, height: `${a.height}px` })
    overlay.appendChild(ghost)
    const dx = b.left - a.left, dy = b.top - a.top
    const anim = ghost.animate([
      { transform: 'translate(0, 0) scale(1)', width: `${a.width}px` },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 14}px) scale(1.08)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(1)`, width: `${b.width}px` },
    ], { duration: 850, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' })
    anim.onfinish = anim.oncancel = () => {
      ghost.remove()
      dstSlot.classList.add('slot-land')
      setTimeout(() => dstSlot.classList.remove('slot-land'), 700)
      done()
    }
  })
}

/** Runs the replay for one stage: what to hide, then reveals step by step. */
function useReplay(stageId: string, moves: Move[], refs: {
  content: RefObject<HTMLDivElement | null>; scroller: RefObject<HTMLDivElement | null>; overlay: RefObject<HTMLDivElement | null>
}) {
  const [state, setState] = useState<ReplayState>(EMPTY)
  const [info, setInfo] = useState<{ count: number; reason: string; running: boolean } | null>(null)
  const token = useRef(0)
  const lastList = useRef<Move[]>([])
  const known = useRef<Set<number> | null>(null)
  /** last-visit time, read once before we overwrite it (survives StrictMode's remount) */
  const since = useRef<number | null | undefined>(undefined)

  const run = useCallback(async (list: Move[], reason: string) => {
    const my = ++token.current
    lastList.current = list
    if (!list.length) { setState(EMPTY); setInfo({ count: 0, reason, running: false }); return }
    if (reducedMotion()) { setState(EMPTY); setInfo({ count: list.length, reason, running: false }); return }
    const hidden = new Set<string>(), pending = new Set<number>()
    for (const mv of list) {
      pending.add(mv.matchId)
      if (mv.winner.to) hidden.add(mv.winner.to)
      if (mv.loser?.to) hidden.add(mv.loser.to)
    }
    const push = () => setState({ hidden: new Set(hidden), pending: new Set(pending) })
    push()
    setInfo({ count: list.length, reason, running: true })
    await wait(800)
    for (const mv of list) {
      if (token.current !== my) return
      pending.delete(mv.matchId) // the score lands
      push()
      await wait(600)
      if (token.current !== my) return
      const { content, scroller, overlay } = refs
      if (content.current && overlay.current) {
        await Promise.all([
          mv.winner.to ? fly(content.current, scroller.current, overlay.current, mv.winner.from, mv.winner.to, 'win') : null,
          mv.loser?.to ? fly(content.current, scroller.current, overlay.current, mv.loser.from, mv.loser.to, 'lose') : null,
        ])
      }
      if (token.current !== my) return
      if (mv.winner.to) hidden.delete(mv.winner.to)
      if (mv.loser?.to) hidden.delete(mv.loser.to)
      push()
      await wait(300)
    }
    if (token.current === my) setInfo({ count: list.length, reason, running: false })
  }, [refs])

  // on open: results since the last visit; later polls: whatever is new
  useEffect(() => {
    const ids = new Set(moves.map((m) => m.matchId))
    if (!known.current) {
      known.current = ids
      if (since.current === undefined) {
        since.current = readSeen(stageId)
        writeSeen(stageId, Date.now())
      }
      const s = since.current
      const list = pickReplay(moves, s, Date.now())
      void run(list, s == null ? (list.length && list[0].at > Date.now() - 86_400_000 ? 'in the last 24 hours' : 'latest results') : 'since your last visit')
      return
    }
    const fresh = moves.filter((m) => !known.current!.has(m.matchId))
    known.current = ids
    if (fresh.length) { writeSeen(stageId, Date.now()); void run(fresh, 'just now') }
  }, [moves, stageId, run])

  // unmount: stop the replay. (React StrictMode unmounts + remounts once in dev,
  // so also forget what we've seen — the remount starts the same replay again.)
  useEffect(() => () => { token.current++; known.current = null }, [])

  const skip = useCallback(() => { token.current++; refs.overlay.current?.replaceChildren(); setState(EMPTY); setInfo((i) => i && { ...i, running: false }) }, [refs])
  const replay = useCallback(() => {
    const list = lastList.current.length ? lastList.current : pickReplay(moves, null, Date.now())
    void run(list, lastList.current.length ? (info?.reason ?? 'latest results') : 'latest results')
  }, [moves, run, info])
  return { state, info, skip, replay, canReplay: moves.length > 0 }
}

// ---- connectors --------------------------------------------------------------

interface Line { d: string; key: string; on: boolean }
const NO_LINKS: { from: number; to: string }[] = []
/** SVG connector paths from each match to the slots its winner fills,
 *  measured from the DOM so they follow whatever the flex layout did. */
function useConnectors(contentRef: RefObject<HTMLDivElement | null>, links: { from: number; to: string }[], hidden: Set<string>) {
  const [lines, setLines] = useState<Line[]>([])
  const measure = useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const c = content.getBoundingClientRect()
    const out: Line[] = []
    for (const l of links) {
      const a = content.querySelector(`[data-match="${l.from}"]`)?.getBoundingClientRect()
      const b = content.querySelector(`[data-slot="${l.to}"]`)?.getBoundingClientRect()
      if (!a || !b) continue
      const x1 = a.right - c.left, y1 = a.top + a.height / 2 - c.top
      const x2 = b.left - c.left, y2 = b.top + b.height / 2 - c.top
      if (x2 <= x1) continue
      const xm = x1 + Math.min(24, (x2 - x1) / 2)
      const r = Math.min(6, Math.abs(y2 - y1) / 2, (x2 - xm) / 2)
      const dir = y2 > y1 ? 1 : -1
      out.push({
        d: Math.abs(y2 - y1) < 1 ? `M${x1},${y1} H${x2}`
          : `M${x1},${y1} H${xm - r} Q${xm},${y1} ${xm},${y1 + dir * r} V${y2 - dir * r} Q${xm},${y2} ${xm + r},${y2} H${x2}`,
        key: l.to, on: false,
      })
    }
    setLines(out)
  }, [contentRef, links])
  useLayoutEffect(() => {
    measure()
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, contentRef])
  return lines.map((l) => ({ ...l, on: !hidden.has(l.key) }))
}

// ---- pieces ------------------------------------------------------------------

function Chip({ team, size = 20, invisible, className = '' }: { team: BTeam; size?: number; invisible?: boolean; className?: string }) {
  return (
    <span data-chip className={`flex min-w-0 flex-1 items-center gap-2 ${invisible ? 'invisible' : ''} ${className}`}>
      <TeamLogo name={team.name} logo={team.logo} size={size} />
      <span className="truncate">{team.name}</span>
    </span>
  )
}

function SlotRow({ slot, lm, probs, revealed, hidden }: {
  slot: Slot; lm: LaidMatch; probs: Record<string, number> | undefined; revealed: boolean; hidden: boolean
}) {
  const m = lm.m
  const t = slot.team
  const live = m.status === 'running'
  const won = revealed && t != null && m.winnerId === t.id
  const lost = revealed && t != null && m.winnerId != null && m.winnerId !== t.id
  const score = t && (revealed || live) ? m.scores[String(t.id)] : undefined
  const p = t && probs ? probs[String(t.id)] : undefined
  return (
    <div data-slot={slot.key} className={`slot flex h-8 items-center gap-2 px-2.5 text-[13px] transition-opacity duration-500 ${lost ? 'opacity-40' : ''}`}>
      {t ? <Chip team={t} invisible={hidden} className={won ? 'font-semibold text-white' : 'text-neutral-300'} />
        : <span data-chip className="flex-1 text-neutral-600">TBD</span>}
      {t && !hidden && (
        score != null ? <span className={`font-display tabular-nums ${won ? 'font-bold text-emerald-400' : 'text-neutral-400'}`}>{score}</span>
        : !revealed && m.status !== 'finished' && p != null ? <span className="text-[11px] tabular-nums text-neutral-500">{pct(p)}</span>
        : null
      )}
    </div>
  )
}

function MatchBox({ lm, probs, st }: { lm: LaidMatch; probs: Record<string, number> | undefined; st: ReplayState }) {
  const m = lm.m
  const revealed = m.status === 'finished' && m.winnerId != null && !st.pending.has(m.id)
  const live = m.status === 'running'
  const pick = probs && m.teams.length === 2 ? m.teams.reduce((a, b) => ((probs[String(a.id)] ?? 0) >= (probs[String(b.id)] ?? 0) ? a : b)) : null
  const called = revealed && pick ? pick.id === m.winnerId : null
  return (
    <div className="flex items-center gap-6">
      <Link
        to={`/match/${m.id}`}
        data-match={m.id}
        className={`block w-48 shrink-0 overflow-hidden rounded-xl bg-white/[0.04] ring-1 transition-colors hover:bg-white/[0.07] ${
          live ? 'ring-rose-500/50' : 'ring-white/10'
        }`}
      >
        <div className="flex h-6 items-center justify-between gap-2 border-b border-white/5 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {live ? <LiveBadge /> : revealed ? <span>Final{m.forfeit ? ' · FF' : ''}</span>
            : m.status === 'finished' ? <span className="normal-case tracking-normal">{shortDate(m.scheduledAt)}</span>
            : <span className="truncate normal-case tracking-normal">{m.scheduledAt ? dayAndClock(m.scheduledAt) : 'TBA'}</span>}
          {called != null && (
            <span className={called ? 'text-emerald-400' : 'text-rose-400'} title={called ? 'The model picked the winner' : 'The model picked the other team'}>
              {called ? '✓ called' : '✗ upset'}
            </span>
          )}
          {!revealed && m.bo && m.status !== 'finished' && <span className="shrink-0">BO{m.bo}</span>}
        </div>
        {lm.slots.map((s) => (
          <SlotRow key={s.key} slot={s} lm={lm} probs={probs} revealed={revealed} hidden={st.hidden.has(s.key)} />
        ))}
      </Link>
      {lm.out && <OutSlot slot={lm.out} hidden={st.hidden.has(lm.out.key) || (lm.out.team != null && !revealed)} />}
    </div>
  )
}

function OutSlot({ slot, hidden }: { slot: Slot & { label: string }; hidden: boolean }) {
  const champ = slot.label === 'Champion'
  return (
    <div className={`w-36 shrink-0 rounded-xl px-2.5 py-1.5 ring-1 ${champ ? 'bg-[#ffc93c]/[0.07] ring-[#ffc93c]/40' : 'bg-white/[0.03] ring-white/10'}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${champ ? 'text-[#ffc93c]' : 'text-neutral-500'}`}>{champ ? '🏆 ' : ''}{slot.label}</div>
      <div data-slot={slot.key} className="slot mt-1 flex h-7 items-center text-[13px] font-semibold text-white">
        {slot.team ? <Chip team={slot.team} invisible={hidden} /> : <span data-chip className="text-neutral-600">TBD</span>}
      </div>
    </div>
  )
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div>
      {label && <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>}
      <div className="flex items-stretch gap-10">{children}</div>
    </div>
  )
}

function Col({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col">
      <div className="mb-2 h-4 truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{label}</div>
      <div className="flex flex-1 flex-col justify-around gap-4">{children}</div>
    </div>
  )
}

// ---- stage views -------------------------------------------------------------

function ReplayBar({ info, skip, replay, canReplay }: ReturnType<typeof useReplay>) {
  if (!canReplay) return null
  const what = info && (info.reason === 'latest results'
    ? `the latest ${info.count === 1 ? 'result' : `${info.count} results`}`
    : `${info.count} result${info.count === 1 ? '' : 's'} ${info.reason}`)
  const text = !info ? '' : info.running ? `Replaying ${what}…`
    : info.count ? `Showing ${what}` : 'No new results since your last visit'
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
      {info?.running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
      <span>{text}</span>
      <button
        onClick={info?.running ? skip : replay}
        className="rounded-md bg-white/5 px-2.5 py-1 font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        {info?.running ? 'Skip' : '↺ Replay'}
      </button>
    </div>
  )
}

function useStageRefs() {
  const content = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  return useMemo(() => ({ content, scroller, overlay }), [])
}

function Canvas({ refs, lines, children }: { refs: ReturnType<typeof useStageRefs>; lines: Line[]; children: ReactNode }) {
  return (
    <div ref={refs.scroller} className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      <div ref={refs.content} className="relative inline-flex min-w-full flex-col gap-10 py-1">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {lines.map((l, i) => (
            <path key={i} d={l.d} fill="none" strokeWidth={1.5}
              className={`transition-[stroke] duration-500 ${l.on ? 'stroke-emerald-400/35' : 'stroke-white/10'}`} />
          ))}
        </svg>
        {children}
        <div ref={refs.overlay} className="pointer-events-none absolute inset-0 z-10" />
      </div>
    </div>
  )
}

function BracketView({ stage, isLast, probs }: { stage: BracketStage; isLast: boolean; probs: EventBracket['probs'] }) {
  const layout: BracketLayout = useMemo(() => layoutBracket(stage.matches, isLast), [stage.matches, isLast])
  const moves = useMemo(() => bracketMoves(layout), [layout])
  const refs = useStageRefs()
  const replay = useReplay(stage.tournamentId, moves, refs)
  const links = useMemo(() => {
    const all = [...layout.upper, ...layout.lower].flatMap((c) => c.matches)
    const ids = new Set(all.map((x) => x.m.id))
    return all.flatMap((lm) => [
      ...lm.slots.filter((s) => s.from?.type === 'winner' && ids.has(s.from.matchId)).map((s) => ({ from: s.from!.matchId, to: s.key })),
      ...(lm.out ? [{ from: lm.m.id, to: lm.out.key }] : []),
    ])
  }, [layout])
  const lines = useConnectors(refs.content, links, replay.state.hidden)
  const hasLower = layout.lower.length > 0
  const lowerLabel = layout.lower.some((c) => c.matches.some((x) => /lower/i.test(x.m.name))) ? 'Lower bracket' : undefined
  return (
    <>
      <ReplayBar {...replay} />
      <Canvas refs={refs} lines={lines}>
        <Row label={hasLower && lowerLabel ? 'Upper bracket' : undefined}>
          {layout.upper.map((c, i) => (
            <Col key={i} label={c.label}>
              {c.matches.map((lm) => <MatchBox key={lm.m.id} lm={lm} probs={probs[lm.m.id]} st={replay.state} />)}
            </Col>
          ))}
        </Row>
        {hasLower && (
          <Row label={lowerLabel}>
            {layout.lower.map((c, i) => (
              <Col key={i} label={c.label}>
                {c.matches.map((lm) => <MatchBox key={lm.m.id} lm={lm} probs={probs[lm.m.id]} st={replay.state} />)}
              </Col>
            ))}
          </Row>
        )}
      </Canvas>
    </>
  )
}

function SwissView({ stage, probs }: { stage: BracketStage; probs: EventBracket['probs'] }) {
  const sw: SwissLayout = useMemo(() => swissLayout(stage.matches, stage.teams), [stage.matches, stage.teams])
  const refs = useStageRefs()
  const replay = useReplay(stage.tournamentId, sw.moves, refs)
  const lines = useConnectors(refs.content, NO_LINKS, replay.state.hidden)
  const upcoming = stage.matches.filter((m) => m.status !== 'finished' && m.status !== 'canceled')
  return (
    <>
      <ReplayBar {...replay} />
      <Canvas refs={refs} lines={lines}>
        <div className="flex items-start gap-6">
          {sw.columns.map((col, i) => (
            <div key={i} className="flex w-44 shrink-0 flex-col gap-3">
              <div className="h-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">{col.label}</div>
              {col.pools.map((p) => {
                const through = p.wins >= SWISS_WINS, out = p.losses >= SWISS_WINS
                return (
                  <div key={`${p.wins}-${p.losses}`} className={`rounded-xl p-1.5 ring-1 ${
                    through ? 'bg-emerald-500/[0.07] ring-emerald-400/30' : out ? 'bg-rose-500/[0.06] ring-rose-400/20' : 'bg-white/[0.03] ring-white/10'
                  }`}>
                    <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-bold uppercase tracking-wider">
                      <span className="font-display text-xs tabular-nums text-neutral-300">{p.wins}–{p.losses}</span>
                      {through && <span className="text-emerald-400">Advanced</span>}
                      {out && <span className="text-rose-400">Out</span>}
                    </div>
                    {p.slots.map((s) => (
                      <div key={s.key} data-slot={s.key} className={`slot flex h-7 items-center rounded-md px-1.5 text-[12px] ${out ? 'text-neutral-500' : 'text-neutral-200'}`}>
                        <Chip team={s.team!} size={18} invisible={replay.state.hidden.has(s.key)} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Canvas>
      {upcoming.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Matches to play</h3>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {upcoming.map((m) => {
              const pr = probs[m.id]
              return (
                <Link key={m.id} to={`/match/${m.id}`} className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[13px] ring-1 ring-white/5 hover:bg-white/[0.06]">
                  {m.status === 'running' && <LiveBadge className="text-[10px]" />}
                  {m.teams.length === 2 ? (
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <Chip team={m.teams[0]} size={18} className="text-neutral-200" />
                      <span className="text-[11px] tabular-nums text-neutral-500">
                        {pr ? `${pct(pr[String(m.teams[0].id)] ?? 0.5)} – ${pct(pr[String(m.teams[1].id)] ?? 0.5)}` : 'vs'}
                      </span>
                      <Chip team={m.teams[1]} size={18} className="justify-end text-neutral-200" />
                    </span>
                  ) : <span className="flex-1 text-neutral-500">TBD</span>}
                  <span className="hidden shrink-0 text-[11px] text-neutral-500 sm:block">{m.scheduledAt ? dayAndClock(m.scheduledAt) : ''}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

// ---- page --------------------------------------------------------------------

export default function BracketPage() {
  const { serieId = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const [data, setData] = useState<EventBracket | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    getBracket(serieId).then((d) => { setData(d); setErr(null) }).catch((e) => setErr(String(e.message || e)))
  }, [serieId])
  useEffect(() => { setData(null); load() }, [load])
  const live = !!data?.stages.some((s) => s.matches.some((m) => m.status === 'running'))
  usePoll(live, load, 60_000)

  if (err) return err === '404'
    ? <p className="py-16 text-sm text-neutral-500">No bracket for this event yet — it appears once the organiser publishes the stages. <Link to="/" className="text-emerald-400">Back to matches</Link></p>
    : <ErrorNote msg={err} />
  if (!data) return <Spinner label="Loading bracket…" />

  const want = sp.get('stage')
  const idx = Math.max(0, want ? data.stages.findIndex((s) => s.tournamentId === want) : defaultStage(data.stages))
  const stage = data.stages[idx] ?? data.stages[0]
  const begin = data.stages.map((s) => s.beginAt).filter(Boolean).sort()[0] ?? null
  const end = data.stages.map((s) => s.endAt).filter(Boolean).sort().at(-1) ?? null

  return (
    <div className="min-w-0">
      <ThemedCard
        league={data.league}
        event={eventName(data.league, data.serie)}
        right={live ? <LiveBadge /> : `${shortDate(begin)} – ${shortDate(end)}`}
        bodyClassName="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <h1 className="font-display text-xl font-bold text-white">Bracket</h1>
        {data.stages.length > 1 && (
          <Segmented
            options={data.stages.map((s) => ({ value: s.tournamentId, label: s.name }))}
            value={stage.tournamentId}
            onChange={(v) => setSp((p) => { p.set('stage', v); return p }, { replace: true })}
          />
        )}
      </ThemedCard>
      <div className="mt-5">
        {stage.matches.length === 0
          ? <p className="py-10 text-sm text-neutral-500">{stage.name}: matches haven't been drawn yet.</p>
          : stage.hasBracket
            ? <BracketView key={stage.tournamentId} stage={stage} isLast={idx === data.stages.length - 1} probs={data.probs} />
            : <SwissView key={stage.tournamentId} stage={stage} probs={data.probs} />}
      </div>
      <p className="mt-6 text-[11px] text-neutral-600">
        Percentages are the model's pre-match odds (live odds while a match is on). ✓ called / ✗ upset = whether the model's pick won.
      </p>
    </div>
  )
}
