// Bracket page logic (pure): lay out a stage's matches from PandaScore's
// previous_matches links, and turn results into "moves" — a team chip going
// from the match it won/lost to the slot it lands in — for the replay animation.

export interface BTeam { id: number; name: string; logo: string | null }
export interface StageMatch {
  id: number; name: string; status: string
  scheduledAt: string | null; endAt: string | null; bo: number | null
  winnerId: number | null; forfeit: boolean
  prev: { type: 'winner' | 'loser'; matchId: number }[]
  teams: BTeam[]
  scores: Record<string, number>
}

/** A place a team chip can sit. `from` = the match link that fills it (null = seeded). */
export interface Slot { key: string; team: BTeam | null; from: { type: 'winner' | 'loser'; matchId: number } | null }
export interface LaidMatch {
  m: StageMatch
  slots: [Slot, Slot]
  /** where the winner goes when no later match takes them (champion / advances) */
  out: (Slot & { label: string }) | null
}
export interface Column { label: string; matches: LaidMatch[] }
export interface BracketLayout { upper: Column[]; lower: Column[] }

export interface Move {
  matchId: number
  /** ms timestamp the match ended (for ordering / "since your last visit") */
  at: number
  winner: { team: BTeam; from: string; to: string | null }
  loser: { team: BTeam; from: string; to: string | null } | null
}

const isDone = (m: StageMatch) => m.status === 'finished' && m.winnerId != null
const endTime = (m: StageMatch) => Date.parse(m.endAt || m.scheduledAt || '') || 0

function resolve(src: StageMatch | undefined, type: 'winner' | 'loser'): BTeam | null {
  if (!src || !isDone(src) || src.teams.length < 2) return null
  return src.teams.find((t) => (type === 'winner') === (t.id === src.winnerId)) ?? null
}

/** Column heading from match names: "Upper Bracket Semifinal 2: A vs B" → "Upper Bracket Semifinal". */
export function roundLabel(names: string[], fallback: string): string {
  const heads = names.map((n) => (n.includes(':') ? n.split(':')[0].replace(/\s*\d+\s*$/, '').trim() : ''))
  const first = heads[0]
  return first && heads.every((h) => h === first) ? first : fallback
}

export function layoutBracket(matches: StageMatch[], isLastStage: boolean): BracketLayout {
  const byId = new Map(matches.map((m) => [m.id, m]))
  // children: which match takes the winner / loser of each match
  const next = new Map<number, { winner?: [number, number]; loser?: [number, number] }>()
  for (const m of matches) m.prev.forEach((p, i) => {
    if (!byId.has(p.matchId)) return
    const e = next.get(p.matchId) ?? {}
    e[p.type] = [m.id, i]
    next.set(p.matchId, e)
  })

  // section: lower if fed by a loser, or by the winner of a lower match;
  // 'final' when the winners of an upper and a lower match meet (grand final)
  const section = new Map<number, 'upper' | 'lower' | 'final'>()
  const sectionOf = (id: number, seen = new Set<number>()): 'upper' | 'lower' | 'final' => {
    const known = section.get(id)
    if (known) return known
    if (seen.has(id)) return 'upper'
    seen.add(id)
    const m = byId.get(id)!
    const feeds = m.prev.filter((p) => byId.has(p.matchId))
    let s: 'upper' | 'lower' | 'final' = 'upper'
    if (feeds.some((p) => p.type === 'loser')) s = 'lower'
    else {
      const kinds = feeds.map((p) => sectionOf(p.matchId, seen))
      const fromLower = kinds.includes('lower')
      const fromUpper = kinds.some((k) => k !== 'lower')
      s = fromLower && fromUpper ? 'final' : fromLower ? 'lower' : 'upper'
    }
    section.set(id, s)
    return s
  }
  matches.forEach((m) => sectionOf(m.id))

  // round depth within the row (lower matches count only lower feeders)
  const round = new Map<number, number>()
  const roundOf = (id: number, seen = new Set<number>()): number => {
    if (round.has(id)) return round.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const s = section.get(id)!
    const feeders = byId.get(id)!.prev
      .filter((p) => p.type === 'winner' && byId.has(p.matchId))
      .filter((p) => (s === 'lower' ? section.get(p.matchId) === 'lower' : section.get(p.matchId) !== 'lower'))
    const r = feeders.length ? 1 + Math.max(...feeders.map((p) => roundOf(p.matchId, seen))) : 0
    round.set(id, r)
    return r
  }
  matches.forEach((m) => roundOf(m.id))

  // slots
  const laid = new Map<number, LaidMatch>()
  for (const m of matches) {
    const fed = m.prev.map((p) => ({ from: p, team: resolve(byId.get(p.matchId), p.type) }))
    const claimed = new Set(fed.map((f) => f.team?.id).filter((x) => x != null))
    const seeded = m.teams.filter((t) => !claimed.has(t.id))
    const raw: Omit<Slot, 'key'>[] = fed.map((f) => ({ team: f.team, from: f.from }))
    // a fed slot whose source is unresolved but the match already lists the team
    for (const s of raw) if (!s.team && seeded.length > 0 && m.teams.length === 2 && m.prev.length === 2) s.team = seeded.shift()!
    while (raw.length < 2) raw.push({ team: seeded.shift() ?? null, from: null })
    const slots = raw.slice(0, 2).map((s, i) => ({ ...s, key: `${m.id}:${i}` })) as [Slot, Slot]
    laid.set(m.id, { m, slots, out: null })
  }

  // outcome slots for matches whose winner goes nowhere else in this stage
  const terminals = matches.filter((m) => !next.get(m.id)?.winner)
  const upperTerminals = terminals.filter((m) => section.get(m.id) !== 'lower' && !/third|3rd/i.test(m.name))
  for (const m of terminals) {
    const label = /third|3rd/i.test(m.name) ? '3rd place'
      : isLastStage && upperTerminals.length === 1 && upperTerminals[0] === m ? 'Champion'
      : 'Advances'
    laid.get(m.id)!.out = { key: `out:${m.id}`, team: resolve(m, 'winner'), from: { type: 'winner', matchId: m.id }, label }
  }

  // order matches top-to-bottom: walk back from each row's terminal matches so a
  // match sits in line with the match it feeds
  const order = new Map<number, number>()
  let seq = 0
  const visit = (id: number, row: 'upper' | 'lower') => {
    if (order.has(id)) return
    order.set(id, seq++)
    for (const p of byId.get(id)!.prev) {
      if (p.type !== 'winner' || !byId.has(p.matchId)) continue
      const s = section.get(p.matchId)
      if ((row === 'lower') === (s === 'lower')) visit(p.matchId, row)
    }
  }
  const byName = (a: StageMatch, b: StageMatch) => a.name.localeCompare(b.name, undefined, { numeric: true })
  const rowOf = (m: StageMatch): 'upper' | 'lower' => (section.get(m.id) === 'lower' ? 'lower' : 'upper')
  for (const row of ['upper', 'lower'] as const) {
    const ends = matches.filter((m) => rowOf(m) === row && !matches.some((c) =>
      rowOf(c) === row && c.prev.some((p) => p.type === 'winner' && p.matchId === m.id)))
    ends.sort(byName).forEach((m) => visit(m.id, row))
  }
  matches.slice().sort(byName).forEach((m) => order.has(m.id) || order.set(m.id, seq++))

  const build = (row: 'upper' | 'lower'): Column[] => {
    const ms = matches.filter((m) => rowOf(m) === row)
    const depth = ms.length ? Math.max(...ms.map((m) => round.get(m.id)!)) : -1
    const cols: Column[] = []
    for (let r = 0; r <= depth; r++) {
      const inCol = ms.filter((m) => round.get(m.id) === r).sort((a, b) => order.get(a.id)! - order.get(b.id)!)
      if (!inCol.length) continue
      cols.push({ label: roundLabel(inCol.map((m) => m.name), `Round ${r + 1}`), matches: inCol.map((m) => laid.get(m.id)!) })
    }
    return cols
  }
  return { upper: build('upper'), lower: build('lower') }
}

/** Every finished match as a move: winner (and loser) chip from its slot in the
 *  match to where it lands. Oldest first. */
export function bracketMoves(layout: BracketLayout): Move[] {
  const all = [...layout.upper, ...layout.lower].flatMap((c) => c.matches)
  const dest = new Map<string, string>() // `${type}:${matchId}` → slot key it fills
  for (const lm of all) {
    for (const s of lm.slots) if (s.from) dest.set(`${s.from.type}:${s.from.matchId}`, s.key)
    if (lm.out) dest.set(`winner:${lm.m.id}`, lm.out.key)
  }
  const moves: Move[] = []
  for (const { m, slots } of all) {
    if (!isDone(m)) continue
    const w = slots.find((s) => s.team?.id === m.winnerId)
    const l = slots.find((s) => s.team && s.team.id !== m.winnerId)
    if (!w?.team) continue
    moves.push({
      matchId: m.id, at: endTime(m),
      winner: { team: w.team, from: w.key, to: dest.get(`winner:${m.id}`) ?? null },
      loser: l?.team ? { team: l.team, from: l.key, to: dest.get(`loser:${m.id}`) ?? null } : null,
    })
  }
  return moves.sort((a, b) => a.at - b.at)
}

// ---- Swiss / no-bracket stages: teams grouped by record after each round ----

export const SWISS_WINS = 3 // CS Majors: three wins advance, three losses eliminate
export interface Pool { wins: number; losses: number; slots: Slot[] }
export interface SwissColumn { label: string; pools: Pool[] }
export interface SwissLayout { columns: SwissColumn[]; moves: Move[] }

export function swissLayout(matches: StageMatch[], stageTeams: BTeam[]): SwissLayout {
  const teams = new Map<number, BTeam>()
  for (const t of stageTeams) teams.set(t.id, t)
  for (const m of matches) for (const t of m.teams) if (!teams.has(t.id)) teams.set(t.id, t)

  const rec = new Map<number, { w: number; l: number }>([...teams.keys()].map((id) => [id, { w: 0, l: 0 }]))
  // records[r] = team ids with their record after r matches
  const at = new Map<number, Map<number, { w: number; l: number }>>([[0, new Map([...rec].map(([id, r]) => [id, { ...r }]))]])
  const moves: Move[] = []
  const done = matches.filter((m) => isDone(m) && m.teams.length === 2).sort((a, b) => endTime(a) - endTime(b))
  for (const m of done) {
    const [win, lose] = m.winnerId === m.teams[0].id ? [m.teams[0], m.teams[1]] : [m.teams[1], m.teams[0]]
    const rw = rec.get(win.id)!, rl = rec.get(lose.id)!
    const nw = rw.w + rw.l, nl = rl.w + rl.l
    moves.push({
      matchId: m.id, at: endTime(m),
      winner: { team: win, from: `sw:${nw}:${win.id}`, to: `sw:${nw + 1}:${win.id}` },
      loser: { team: lose, from: `sw:${nl}:${lose.id}`, to: `sw:${nl + 1}:${lose.id}` },
    })
    rw.w++; rl.l++
    for (const [id, r, n] of [[win.id, rw, nw + 1], [lose.id, rl, nl + 1]] as const) {
      if (!at.has(n)) at.set(n, new Map())
      at.get(n)!.set(id, { ...r })
    }
  }

  const columns: SwissColumn[] = [...at.keys()].sort((a, b) => a - b).map((r) => {
    const pools = new Map<string, Pool>()
    for (const [id, x] of at.get(r)!) {
      const k = `${x.w}-${x.l}`
      if (!pools.has(k)) pools.set(k, { wins: x.w, losses: x.l, slots: [] })
      pools.get(k)!.slots.push({ key: `sw:${r}:${id}`, team: teams.get(id)!, from: null })
    }
    const list = [...pools.values()].sort((a, b) => b.wins - a.wins)
    for (const p of list) p.slots.sort((a, b) => a.team!.name.localeCompare(b.team!.name))
    return { label: r === 0 ? 'Start' : `Round ${r}`, pools: list }
  })
  return { columns, moves }
}

// ---- What to replay on open ----

/** Results to animate when the page opens, oldest first: on a first visit the
 *  whole stage from round 1; afterwards only what finished since the last visit. */
export function pickReplay(moves: Move[], since: number | null, now: number): Move[] {
  return moves
    .filter((m) => m.at > 0 && m.at <= now && (since == null || m.at > since))
    .sort((a, b) => a.at - b.at)
}

/** Group moves (oldest first) into rounds that play at the same time: a new
 *  round starts when a move's team has to arrive from a move in the current one
 *  (e.g. a semifinal waits for the quarterfinal winners to land). */
export function batchMoves(moves: Move[]): Move[][] {
  const out: Move[][] = []
  let landing = new Set<string>()
  for (const mv of moves) {
    const waits = landing.has(mv.winner.from) || (mv.loser != null && landing.has(mv.loser.from))
    if (!out.length || waits) { out.push([]); landing = new Set() }
    out[out.length - 1].push(mv)
    if (mv.winner.to) landing.add(mv.winner.to)
    if (mv.loser?.to) landing.add(mv.loser.to)
  }
  return out
}

/** Stage to open by default: one with a live match, else the latest result, else the first. */
export function defaultStage<T extends { matches: StageMatch[] }>(stages: T[]): number {
  const live = stages.findIndex((s) => s.matches.some((m) => m.status === 'running'))
  if (live >= 0) return live
  let best = -1, bestAt = 0
  stages.forEach((s, i) => s.matches.forEach((m) => {
    if (isDone(m) && endTime(m) >= bestAt) { best = i; bestAt = endTime(m) }
  }))
  return best >= 0 ? best : 0
}
