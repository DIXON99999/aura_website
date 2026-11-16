// Scoring rules for probabilistic predictions. `p` = predicted P(team A wins),
// `y` = 1 if team A won else 0. Lower Brier / log-loss is better; a coin-flip
// model scores 0.25 Brier and ln 2 ≈ 0.693 log-loss.

export interface Scored { p: number; y: 0 | 1 }

const EPS = 1e-12
const clamp = (p: number) => Math.min(1 - EPS, Math.max(EPS, p))

export function brier(xs: Scored[]): number {
  if (!xs.length) return NaN
  return xs.reduce((s, { p, y }) => s + (p - y) ** 2, 0) / xs.length
}

export function logLoss(xs: Scored[]): number {
  if (!xs.length) return NaN
  return -xs.reduce((s, { p, y }) => s + (y ? Math.log(clamp(p)) : Math.log(1 - clamp(p))), 0) / xs.length
}

/** Share of matches where the favourite (p ≥ 0.5) won. */
export function accuracy(xs: Scored[]): number {
  if (!xs.length) return NaN
  return xs.filter(({ p, y }) => (p >= 0.5 ? 1 : 0) === y).length / xs.length
}

/** Reliability table on the favourite's confidence (0.5–1.0 in `n` buckets):
 *  how often favourites predicted at ~X% actually won. */
export function calibration(xs: Scored[], n = 5): { lo: number; hi: number; count: number; predicted: number; actual: number }[] {
  const out = Array.from({ length: n }, (_, i) => ({
    lo: 0.5 + (0.5 * i) / n, hi: 0.5 + (0.5 * (i + 1)) / n, count: 0, predicted: 0, actual: 0,
  }))
  for (const { p, y } of xs) {
    const conf = Math.max(p, 1 - p)
    const favWon = (p >= 0.5 ? 1 : 0) === y ? 1 : 0
    const b = out[Math.min(n - 1, Math.floor(((conf - 0.5) / 0.5) * n))]
    b.count++; b.predicted += conf; b.actual += favWon
  }
  for (const b of out) if (b.count) { b.predicted /= b.count; b.actual /= b.count }
  return out
}
