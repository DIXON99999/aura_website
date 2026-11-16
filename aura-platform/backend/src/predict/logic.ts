// Pure prediction/ingest decisions — no database, no network, no env — so they
// can be unit tested directly. ingest.ts and the routes call into these.
import type { PSMatch } from './pandascore.js'
import { predict, expected, V2_CONFIG, type ModelConfig, type Ratings } from './elo.js'

/** Matches the model can learn from: decisive, two real teams. */
export function isScorable(m: PSMatch): boolean {
  if (m.draw || m.forfeit || !m.winner_id || m.opponents?.length !== 2) return false
  return m.opponents.every((o) => o.type === 'Team' && o.opponent?.id)
}

/** Matches worth showing in form / head-to-head: anything with a winner between
 *  two real teams — INCLUDING forfeits, because the head-to-head record the
 *  model uses (recordH2H) counts them. Ratings skip forfeits (isScorable). */
export function isLoggable(m: PSMatch): boolean {
  if (m.draw || !m.winner_id || m.opponents?.length !== 2) return false
  return m.opponents.every((o) => o.type === 'Team' && o.opponent?.id)
}

// ── Head-to-head ─────────────────────────────────────────────────────────────
// Shrink the pair's historical match record toward 50% with a prior, then mix
// it into the Elo probability — weighted up to `maxWeight` (30% in v2) once two
// teams have met ~6+ times. Captures matchup effects Elo's transitivity misses.
export const H2H_PRIOR = 4       // pseudo-meetings pulling toward 50/50
export const H2H_MAX_WEIGHT = 0.30
export const H2H_FULL_AT = 6     // meetings needed for full weight

export function h2hAdjust(eloProbA: number, aWins: number, bWins: number, maxWeight = H2H_MAX_WEIGHT): number {
  const n = aWins + bWins
  if (n === 0) return eloProbA
  const h2hA = (aWins + H2H_PRIOR * 0.5) / (n + H2H_PRIOR)
  const weight = (Math.min(n, H2H_FULL_AT) / H2H_FULL_AT) * maxWeight
  return (1 - weight) * eloProbA + weight * h2hA
}

/** Order-independent key for a pair of team ids. */
export const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)

export type H2HMap = Map<string, { loId: number; hiId: number; loWins: number; hiWins: number }>

/** Add a finished match's result to the head-to-head record. Mutates `h2h`. */
export function recordH2H(h2h: H2HMap, m: Pick<PSMatch, 'winner_id' | 'opponents'>): void {
  if (!m.winner_id || m.opponents?.length !== 2) return
  const ids = m.opponents.map((o) => o.opponent?.id).filter(Boolean) as number[]
  if (ids.length !== 2) return
  const lo = Math.min(ids[0], ids[1]), hi = Math.max(ids[0], ids[1])
  const key = pairKey(lo, hi)
  const e = h2h.get(key) || { loId: lo, hiId: hi, loWins: 0, hiWins: 0 }
  if (m.winner_id === lo) e.loWins++
  else if (m.winner_id === hi) e.hiWins++
  h2h.set(key, e)
}

/** Full model: Elo match probability for opponents[0], with head-to-head blend. */
export function modelProb(r: Ratings, h2h: H2HMap, m: PSMatch, cfg: ModelConfig = V2_CONFIG): ReturnType<typeof predict> {
  const p = predict(r, m, cfg)
  if (!p) return null
  const he = h2h.get(pairKey(p.teamA.id, p.teamB.id))
  if (he) {
    const aWins = p.teamA.id === he.loId ? he.loWins : he.hiWins
    const bWins = p.teamA.id === he.loId ? he.hiWins : he.loWins
    p.probA = h2hAdjust(p.probA, aWins, bWins, cfg.h2hMaxWeight)
  }
  return p
}

// ── Which matches to show ────────────────────────────────────────────────────
// Lower-tier matches are shown only when at least one side is a recognizable
// org. Matched case-insensitively against team name; short/ambiguous tags use
// word boundaries. Add orgs here to widen the net.
export const POPULAR_TEAMS: RegExp[] = [
  /vitality/i, /mouz|mousesports/i, /natus vincere|\bnavi\b/i, /\bfaze\b/i, /\bg2\b/i,
  /team spirit|\bspirit\b/i, /astralis/i, /furia/i, /\bliquid\b/i, /falcons/i,
  /mongolz/i, /aurora/i, /heroic/i, /complexity/i, /virtus\.?\s?pro|\bvp\b/i,
  /cloud9|\bc9\b/i, /\bbig\b/i, /\bence\b/i, /eternal fire/i, /\bpain\b|paingaming/i,
  /3dmax/i, /gamerlegion/i, /\b9ine\b/i, /ninjas in pyjamas|\bnip\b/i, /fnatic/i,
  /\bog\b/i, /\bmibr\b/i, /imperial/i, /\bsaw\b/i, /betboom/i, /bc[\s.]?game/i,
  /passion ua/i, /monte/i, /apeks/i, /sangal/i, /tyloo/i, /lynn vision/i, /rare atom/i,
  /flyquest/i, /wildcard/i, /nemiga/i, /\bb8\b/i, /fluxo/i, /legacy/i, /\bsharks\b/i,
  /parivision/i, /betera/i, /amkal/i, /enterprise/i, /\bguild\b/i, /gentle mates|\bm0nesy\b/i,
  /\bnrg\b/i, /\bgamerlegion\b/i, /\becstatic\b/i, /zero tenacity/i, /\bsaints\b/i,
]
// Reject academy/youth/former-roster variants even when the brand matches —
// "Vitality Academy", "Spirit Academy Green", "Aurora Young Blood", "ex-ENCE".
const NOT_MAIN_ROSTER = [/academy/i, /young blood/i, /\byouth\b/i, /junior/i, /^\s*ex-/i, /\bex-/i]

export function teamPopular(name: string | null | undefined): boolean {
  if (!name) return false
  if (NOT_MAIN_ROSTER.some((re) => re.test(name))) return false
  return POPULAR_TEAMS.some((re) => re.test(name))
}

// Tier 1 = PandaScore tournament tier S or A (Majors, IEM, BLAST, top PGL...).
// NB: tier lives on `tournament` — `serie.tier` is always null.
export const TIER1 = ['s', 'a']
export const isTier1 = (m: Pick<PSMatch, 'tournament'>) =>
  TIER1.includes((m.tournament?.tier || '').toLowerCase())

/** Tier-1 matches are always shown; lower tiers only when a popular org plays. */
export function shouldShow(m: Pick<PSMatch, 'tournament' | 'opponents'>): boolean {
  return isTier1(m) || (m.opponents || []).some((o) => teamPopular(o.opponent?.name))
}

export const scoreOf = (m: Pick<PSMatch, 'results'>, teamId: number) =>
  m.results?.find((r) => r.team_id === teamId)?.score ?? null

// ── Upcoming-row pruning ─────────────────────────────────────────────────────
/** Which stored 'upcoming' predictions to delete after a refresh: only rows
 *  still in the future that this refresh didn't write (rescheduled / filtered
 *  out). Rows whose start has passed are live and must be KEPT so they can be
 *  settled — deleting them is what kept accuracy stuck at 0. */
export function staleUpcomingIds(
  rows: { matchId: number; scheduledAt: Date | string | null }[],
  written: Iterable<number>,
  now: Date = new Date(),
): number[] {
  const keep = new Set(written)
  return rows
    .filter((r) => !keep.has(r.matchId))
    .filter((r) => r.scheduledAt != null && new Date(r.scheduledAt).getTime() > now.getTime())
    .map((r) => r.matchId)
}

// ── History ──────────────────────────────────────────────────────────────────
/** A stored prediction is P(its own team A wins); a results row may list the
 *  teams the other way round. Re-orient it to the row's team A. */
export function orientProbA(
  predProbA: number | null | undefined,
  predTeamAId: string | number | null | undefined,
  rowTeamAId: string | number | null | undefined,
): number | null {
  if (predProbA == null) return null
  return String(predTeamAId) === String(rowTeamAId) ? predProbA : 1 - predProbA
}

// ── Match detail ─────────────────────────────────────────────────────────────
export interface Explanation {
  /** effective ratings used for the prediction */
  eloA: number
  eloB: number
  /** eloA − eloB */
  gap: number
  /** P(A wins a single map) */
  mapProbA: number
  bo: number
  /** P(A wins the series) from ratings alone */
  seriesProbA: number
  /** `rate` = the H2H record shrunk toward 50% — the value the blend pulls
   *  toward (null if they've never met). It can lower a favourite who leads. */
  h2h: { aWins: number; bWins: number; shift: number; rate: number | null }
  /** what the model actually predicts (= modelProb) */
  finalProbA: number
  /** team still in its provisional period (rating moving fast, less certain) */
  provisional: { a: boolean; b: boolean }
  gamesA: number
  gamesB: number
}

/** Step-by-step breakdown of modelProb for the match page. Built from the same
 *  functions as the live model, so finalProbA always equals modelProb(...). */
export function explainPrediction(r: Ratings, h2h: H2HMap, m: PSMatch, cfg: ModelConfig = V2_CONFIG): Explanation | null {
  const p = predict(r, m, cfg)
  if (!p) return null
  const he = h2h.get(pairKey(p.teamA.id, p.teamB.id))
  const aWins = he ? (p.teamA.id === he.loId ? he.loWins : he.hiWins) : 0
  const bWins = he ? (p.teamA.id === he.loId ? he.hiWins : he.loWins) : 0
  const finalProbA = h2hAdjust(p.probA, aWins, bWins, cfg.h2hMaxWeight)
  const provGames = cfg.provisional?.games ?? 0
  return {
    eloA: p.teamA.elo,
    eloB: p.teamB.elo,
    gap: p.teamA.elo - p.teamB.elo,
    mapProbA: expected(p.teamA.elo, p.teamB.elo, cfg.scale),
    bo: p.bo,
    seriesProbA: p.probA,
    h2h: {
      aWins, bWins, shift: finalProbA - p.probA,
      rate: aWins + bWins ? (aWins + H2H_PRIOR * 0.5) / (aWins + bWins + H2H_PRIOR) : null,
    },
    finalProbA,
    provisional: { a: p.teamA.games < provGames, b: p.teamB.games < provGames },
    gamesA: p.teamA.games,
    gamesB: p.teamB.games,
  }
}

/** "WWLWL" for `teamId` over `results` (in the order given — pass newest first). */
export function formString(results: { winnerId: string | number | null }[], teamId: string | number): string {
  return results
    .filter((x) => x.winnerId != null)
    .map((x) => (String(x.winnerId) === String(teamId) ? 'W' : 'L'))
    .join('')
}
