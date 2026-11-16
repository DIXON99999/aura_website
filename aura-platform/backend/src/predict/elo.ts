// Map-level Elo rating engine. One configurable model: V2_CONFIG is the model
// that shipped as `map-elo-h2h-v2` (~62.5% on held-out CS2 matches); extra
// parameters (tier-weighted K, provisional K, inactivity shrink, LAN rating,
// rating scale) are all off by default and only switched on in a config that
// the backtest (backtest.ts) has shown to be better.
import type { PSMatch } from './pandascore.js'

export const START = 1500
export const K_MAP = 24   // "class" rating — long-term strength, moves slowly
export const K_FORM = 64  // "form" rating — fast, tracks recent form, forgets old results
// Form is kept computed but OFF (weight 0): a walk-forward backtest over 11.5k
// held-out matches showed it did not improve accuracy and *worsened* calibration
// (Brier/log-loss). Head-to-head, by contrast, helped consistently and stays on.
export const FORM_WEIGHT = 0 // how much current form counts vs long-term class

const DAY = 86_400_000

export interface ModelConfig {
  /** K per map for the main rating */
  kMap: number
  /** Elo scale: a `scale`-point gap = 10:1 odds per map (classic Elo uses 400) */
  scale: number
  /** K multiplier by PandaScore tournament tier ('s'…'d'); missing tier → 1 */
  tierK: Record<string, number> | null
  /** larger K for a team's first `games` matches, so new teams converge fast */
  provisional: { games: number; mult: number } | null
  /** shrink a rating toward START after `graceDays` idle, halving the gap every `halfLifeDays` */
  inactivity: { graceDays: number; halfLifeDays: number } | null
  /** separate LAN rating (offline events): updated with K `k`, blended with `weight` into LAN predictions */
  lan: { k: number; weight: number } | null
  /** max weight of the head-to-head blend (see logic.h2hAdjust) */
  h2hMaxWeight: number
}

/** The shipped v2 model, exactly. */
export const V2_CONFIG: ModelConfig = {
  kMap: K_MAP, scale: 400, tierK: null, provisional: null, inactivity: null, lan: null, h2hMaxWeight: 0.30,
}

export interface Rating {
  elo: number
  formElo: number
  games: number
  name: string
  /** LAN-only rating; undefined until the team's first LAN match */
  lanElo?: number
  /** ms timestamp of the last applied match */
  lastPlayed?: number
}
export type Ratings = Map<number, Rating>

/** Effective rating used for prediction: blend of long-term class and recent form. */
export function blended(r: { elo: number; formElo: number }): number {
  return (1 - FORM_WEIGHT) * r.elo + FORM_WEIGHT * r.formElo
}

export function expected(ra: number, rb: number, scale = 400): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / scale))
}

/** P(team A wins a best-of-`bo`) from per-map win prob p (maps assumed iid). */
export function matchProbFromMap(p: number, bo: number): number {
  const n = Math.max(bo, 1)
  const need = Math.floor(n / 2) + 1
  let prob = 0
  for (let k = need; k <= n; k++) {
    let c = 1
    for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1)
    prob += c * Math.pow(p, k) * Math.pow(1 - p, n - k)
  }
  return prob
}

/** Match start as ms, or undefined when the match has no time. */
export function matchTime(m: Pick<PSMatch, 'scheduled_at' | 'begin_at'>): number | undefined {
  const t = Date.parse(m.scheduled_at || m.begin_at || '')
  return Number.isFinite(t) ? t : undefined
}

export const isLan = (m: Pick<PSMatch, 'tournament'>) => (m.tournament?.type || '').toLowerCase() === 'offline'

/** Fraction of a rating's distance from START that survives `idleDays` of inactivity. */
export function inactivityFactor(idleDays: number, cfg: ModelConfig): number {
  if (!cfg.inactivity || idleDays <= cfg.inactivity.graceDays) return 1
  return Math.pow(0.5, (idleDays - cfg.inactivity.graceDays) / cfg.inactivity.halfLifeDays)
}

/** A rating as it stands at time `t` (inactivity shrink applied, not stored). */
function effectiveElo(v: Rating, t: number | undefined, cfg: ModelConfig, lan: boolean): number {
  const f = t != null && v.lastPlayed != null ? inactivityFactor((t - v.lastPlayed) / DAY, cfg) : 1
  const shrink = (x: number) => START + (x - START) * f
  const base = shrink(blended(v))
  if (lan && cfg.lan && v.lanElo != null) return (1 - cfg.lan.weight) * base + cfg.lan.weight * shrink(v.lanElo)
  return base
}

function rating(r: Ratings, id: number, name: string): Rating {
  let v = r.get(id)
  if (!v) { v = { elo: START, formElo: START, games: 0, name }; r.set(id, v) }
  if (name && v.name !== name) v.name = name
  return v
}

function teamK(v: Rating, m: PSMatch, cfg: ModelConfig): number {
  let k = cfg.kMap
  if (cfg.tierK) k *= cfg.tierK[(m.tournament?.tier || '').toLowerCase()] ?? 1
  if (cfg.provisional && v.games < cfg.provisional.games) k *= cfg.provisional.mult
  return k
}

/** Update ratings from one finished match (per-map updates). Mutates `r`. */
export function applyMatch(r: Ratings, m: PSMatch, cfg: ModelConfig = V2_CONFIG): void {
  if (m.draw || m.forfeit || !m.winner_id || m.opponents?.length !== 2) return
  const [oa, ob] = m.opponents
  if (oa.type !== 'Team' || ob.type !== 'Team' || !oa.opponent?.id || !ob.opponent?.id) return
  const a = oa.opponent.id, b = ob.opponent.id
  const ra = rating(r, a, oa.opponent.name || String(a))
  const rb = rating(r, b, ob.opponent.name || String(b))
  const t = matchTime(m)

  // bake any inactivity shrink into the stored ratings before updating
  if (cfg.inactivity && t != null) {
    for (const v of [ra, rb]) {
      if (v.lastPlayed == null) continue
      const f = inactivityFactor((t - v.lastPlayed) / DAY, cfg)
      v.elo = START + (v.elo - START) * f
      if (v.lanElo != null) v.lanElo = START + (v.lanElo - START) * f
    }
  }

  const ka = teamK(ra, m, cfg), kb = teamK(rb, m, cfg)
  const lan = cfg.lan && isLan(m)
  if (lan) {
    // a team's LAN rating starts from its overall rating at its first LAN
    ra.lanElo ??= ra.elo
    rb.lanElo ??= rb.elo
  }

  for (const g of m.games || []) {
    const w = g.winner?.id
    if (!g.finished || (w !== a && w !== b)) continue
    const wa = w === a ? 1 : 0
    // class rating (slow)
    const q = expected(ra.elo, rb.elo, cfg.scale)
    ra.elo += ka * (wa - q)
    rb.elo += kb * ((1 - wa) - (1 - q))
    // form rating (fast) — uses its own current values
    const qf = expected(ra.formElo, rb.formElo)
    ra.formElo += K_FORM * (wa - qf)
    rb.formElo += K_FORM * ((1 - wa) - (1 - qf))
    // LAN rating
    if (lan) {
      const ql = expected(ra.lanElo!, rb.lanElo!, cfg.scale)
      ra.lanElo! += cfg.lan!.k * (wa - ql)
      rb.lanElo! += cfg.lan!.k * ((1 - wa) - (1 - ql))
    }
  }
  ra.games += 1; rb.games += 1
  if (t != null) { ra.lastPlayed = t; rb.lastPlayed = t }
}

/** Predict an upcoming match from current ratings. Returns null if a side is unknown-id. */
export function predict(r: Ratings, m: PSMatch, cfg: ModelConfig = V2_CONFIG): {
  teamA: { id: number; name: string; elo: number; games: number }
  teamB: { id: number; name: string; elo: number; games: number }
  probA: number; bo: number
} | null {
  if (m.opponents?.length !== 2) return null
  const [oa, ob] = m.opponents
  if (!oa.opponent?.id || !ob.opponent?.id) return null
  const a = oa.opponent.id, b = ob.opponent.id
  const ra = r.get(a) ?? { elo: START, formElo: START, games: 0, name: oa.opponent.name || String(a) }
  const rb = r.get(b) ?? { elo: START, formElo: START, games: 0, name: ob.opponent.name || String(b) }
  const bo = m.number_of_games || 1
  const t = matchTime(m)
  const lan = isLan(m)
  const ea = effectiveElo(ra, t, cfg, lan), eb = effectiveElo(rb, t, cfg, lan)
  const pMap = expected(ea, eb, cfg.scale)
  return {
    teamA: { id: a, name: oa.opponent.name || String(a), elo: ea, games: ra.games },
    teamB: { id: b, name: ob.opponent.name || String(b), elo: eb, games: rb.games },
    probA: matchProbFromMap(pMap, bo),
    bo,
  }
}
