// Map-level Elo rating engine (the shipping model: ~62.5% on held-out CS2 matches).
import type { PSMatch } from './pandascore.js'

export const START = 1500
export const K_MAP = 24   // "class" rating — long-term strength, moves slowly
export const K_FORM = 64  // "form" rating — fast, tracks recent form, forgets old results
// Form is kept computed but OFF (weight 0): a walk-forward backtest over 11.5k
// held-out matches showed it did not improve accuracy and *worsened* calibration
// (Brier/log-loss). Head-to-head, by contrast, helped consistently and stays on.
// Revisit form only with richer inputs (map veto, player stats).
export const FORM_WEIGHT = 0 // how much current form counts vs long-term class

export interface Rating { elo: number; formElo: number; games: number; name: string }
export type Ratings = Map<number, Rating>

/** Effective rating used for prediction: blend of long-term class and recent form. */
export function blended(r: { elo: number; formElo: number }): number {
  return (1 - FORM_WEIGHT) * r.elo + FORM_WEIGHT * r.formElo
}

export function expected(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
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

function rating(r: Ratings, id: number, name: string): Rating {
  let v = r.get(id)
  if (!v) { v = { elo: START, formElo: START, games: 0, name }; r.set(id, v) }
  if (name && v.name !== name) v.name = name
  return v
}

/** Update ratings from one finished match (per-map updates). Mutates `r`. */
export function applyMatch(r: Ratings, m: PSMatch): void {
  if (m.draw || m.forfeit || !m.winner_id || m.opponents?.length !== 2) return
  const [oa, ob] = m.opponents
  if (oa.type !== 'Team' || ob.type !== 'Team' || !oa.opponent?.id || !ob.opponent?.id) return
  const a = oa.opponent.id, b = ob.opponent.id
  const ra = rating(r, a, oa.opponent.name || String(a))
  const rb = rating(r, b, ob.opponent.name || String(b))

  for (const g of m.games || []) {
    const w = g.winner?.id
    if (!g.finished || (w !== a && w !== b)) continue
    const wa = w === a ? 1 : 0
    // class rating (slow)
    const q = expected(ra.elo, rb.elo)
    ra.elo += K_MAP * (wa - q)
    rb.elo += K_MAP * ((1 - wa) - (1 - q))
    // form rating (fast) — uses its own current values
    const qf = expected(ra.formElo, rb.formElo)
    ra.formElo += K_FORM * (wa - qf)
    rb.formElo += K_FORM * ((1 - wa) - (1 - qf))
  }
  ra.games += 1; rb.games += 1
}

/** Predict an upcoming match from current ratings. Returns null if a side is unknown-id. */
export function predict(r: Ratings, m: PSMatch): {
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
  const pMap = expected(blended(ra), blended(rb))
  return {
    teamA: { id: a, name: oa.opponent.name || String(a), elo: blended(ra), games: ra.games },
    teamB: { id: b, name: ob.opponent.name || String(b), elo: blended(rb), games: rb.games },
    probA: matchProbFromMap(pMap, bo),
    bo,
  }
}
