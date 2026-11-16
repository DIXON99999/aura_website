import { describe, expect, test } from 'bun:test'
import { START, V2_CONFIG, applyMatch, predict, inactivityFactor, isLan, type ModelConfig, type Ratings } from './elo'
import { recordH2H, pairKey, type H2HMap } from './logic'
import { brier, logLoss, accuracy, calibration } from './metrics'
import { walkForward, evaluate, isScorable } from './backtest'
import type { PSMatch } from './pandascore'

const DAY = 86_400_000
const t0 = Date.UTC(2026, 0, 1)

/** Team 1 vs team 2 at day `day`, team `winner` takes every map of a BO`bo`. */
function m(day: number, winner = 1, extra: Partial<PSMatch> = {}, bo = 3): PSMatch {
  const maps = Math.floor(bo / 2) + 1
  return {
    id: day, name: '', status: 'finished', begin_at: null,
    scheduled_at: new Date(t0 + day * DAY).toISOString(),
    winner_id: winner, number_of_games: bo,
    opponents: [{ type: 'Team', opponent: { id: 1, name: 'A' } }, { type: 'Team', opponent: { id: 2, name: 'B' } }],
    games: Array.from({ length: maps }, () => ({ finished: true, winner: { id: winner } })),
    ...extra,
  }
}
const cfg = (patch: Partial<ModelConfig>): ModelConfig => ({ ...V2_CONFIG, ...patch })

// ── Regression: V2_CONFIG must equal the shipped v2 model ────────────────────
describe('V2_CONFIG regression (synthetic season, values recorded from the pre-refactor model)', () => {
  test('probabilities and final ratings are unchanged', () => {
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const r: Ratings = new Map(); const probs: number[] = []
    for (let i = 0; i < 300; i++) {
      const a = 1 + Math.floor(rnd() * 6); let b = 1 + Math.floor(rnd() * 6); if (b === a) b = (a % 6) + 1
      const bo = [1, 3, 3, 5][Math.floor(rnd() * 4)]
      const pa = 0.5 + a * 0.08 - b * 0.08
      const games: PSMatch['games'] = []; let wa = 0, wb = 0; const need = Math.floor(bo / 2) + 1
      while (wa < need && wb < need) { const w = rnd() < pa ? a : b; if (w === a) wa++; else wb++; games.push({ finished: true, winner: { id: w } }) }
      const match: PSMatch = {
        id: i, name: '', status: 'finished', begin_at: null,
        scheduled_at: new Date(t0 + i * 2 * DAY).toISOString(),
        winner_id: wa > wb ? a : b, number_of_games: bo,
        tournament: { tier: ['s', 'a', 'b', 'c', 'd'][i % 5], type: i % 4 === 0 ? 'offline' : 'online' },
        opponents: [{ type: 'Team', opponent: { id: a, name: 'T' + a } }, { type: 'Team', opponent: { id: b, name: 'T' + b } }],
        games,
      }
      probs.push(predict(r, match)!.probA)
      applyMatch(r, match)
    }
    const sampled = probs.filter((_, i) => i % 25 === 0)
    const expected = [0.5, 0.437521941785, 0.181728801257, 0.319887510379, 0.879613744647, 0.909205226786,
      0.418242996443, 0.226447332308, 0.204988987546, 0.140622083293, 0.302143770654, 0.135043473723]
    sampled.forEach((p, i) => expect(p).toBeCloseTo(expected[i], 10))
    const finals = [...r.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v.elo)
    const expectedElo = [1328.684773218, 1473.728170755, 1419.598722142, 1427.408131916, 1611.241700018, 1739.33850195]
    finals.forEach((e, i) => expect(e).toBeCloseTo(expectedElo[i], 6))
  })
})

describe('tier-weighted K', () => {
  test('a win in a tier-S event moves ratings more than the same win in tier D', () => {
    const c = cfg({ tierK: { s: 2, d: 0.5 } })
    const rs: Ratings = new Map(), rd: Ratings = new Map()
    // BO1 = a single map update, so the step is exactly proportional to K
    applyMatch(rs, m(0, 1, { tournament: { tier: 's' } }, 1), c)
    applyMatch(rd, m(0, 1, { tournament: { tier: 'd' } }, 1), c)
    expect(rs.get(1)!.elo - START).toBeCloseTo(4 * (rd.get(1)!.elo - START), 9)
  })
  test('unknown tier → multiplier 1 (same as v2)', () => {
    const a: Ratings = new Map(), b: Ratings = new Map()
    applyMatch(a, m(0), cfg({ tierK: { s: 2 } }))
    applyMatch(b, m(0), V2_CONFIG)
    expect(a.get(1)!.elo).toBe(b.get(1)!.elo)
  })
})

describe('provisional K', () => {
  test('applies only during a team\'s first N matches', () => {
    const c = cfg({ provisional: { games: 1, mult: 2 } })
    const r: Ratings = new Map(), base: Ratings = new Map()
    applyMatch(r, m(0), c); applyMatch(base, m(0))
    expect(r.get(1)!.elo - START).toBeGreaterThan(base.get(1)!.elo - START)
    // second match: no longer provisional → same step as v2 from the same rating
    const before = r.get(1)!.elo
    const twin: Ratings = new Map([[1, { ...r.get(1)! }], [2, { ...r.get(2)! }]])
    applyMatch(r, m(1), c); applyMatch(twin, m(1))
    expect(r.get(1)!.elo - before).toBeCloseTo(twin.get(1)!.elo - before, 9)
  })
})

describe('inactivity shrink', () => {
  const c = cfg({ inactivity: { graceDays: 30, halfLifeDays: 60 } })
  test('factor: 1 within grace, halves every half-life after', () => {
    expect(inactivityFactor(10, c)).toBe(1)
    expect(inactivityFactor(90, c)).toBeCloseTo(0.5, 12)
    expect(inactivityFactor(150, c)).toBeCloseTo(0.25, 12)
    expect(inactivityFactor(500, V2_CONFIG)).toBe(1)
  })
  test('a long-idle favourite is predicted closer to 50%', () => {
    const r: Ratings = new Map()
    for (let d = 0; d < 10; d++) applyMatch(r, m(d), c)
    const fresh = predict(r, m(12), c)!.probA
    const stale = predict(r, m(400), c)!.probA
    expect(fresh).toBeGreaterThan(stale)
    expect(stale).toBeGreaterThan(0.5)
  })
})

describe('LAN rating', () => {
  const c = cfg({ lan: { k: 24, weight: 0.5 } })
  test('only offline matches create/move the LAN rating', () => {
    const r: Ratings = new Map()
    applyMatch(r, m(0, 1, { tournament: { type: 'online' } }), c)
    expect(r.get(1)!.lanElo).toBeUndefined()
    applyMatch(r, m(1, 2, { tournament: { type: 'offline' } }), c)
    expect(r.get(2)!.lanElo).toBeGreaterThan(r.get(1)!.lanElo!)
  })
  test('a LAN specialist is rated higher for LAN matches than online ones', () => {
    // The LAN rating starts as a copy of the overall rating and moves in step
    // with it on LAN matches; it diverges because ONLINE matches don't touch it.
    const r: Ratings = new Map()
    for (let d = 0; d < 6; d++) applyMatch(r, m(d, 2, { tournament: { type: 'offline' } }), c)   // team 2 dominates LAN
    for (let d = 6; d < 12; d++) applyMatch(r, m(d, 1, { tournament: { type: 'online' } }), c)   // then team 1 dominates online
    const online = predict(r, m(13, 1, { tournament: { type: 'online' } }), c)!.probA
    const lan = predict(r, m(13, 1, { tournament: { type: 'offline' } }), c)!.probA
    expect(lan).toBeLessThan(online)
  })
  test('isLan reads tournament.type', () => {
    expect(isLan({ tournament: { type: 'offline' } })).toBe(true)
    expect(isLan({ tournament: { type: 'online' } })).toBe(false)
    expect(isLan({})).toBe(false)
  })
})

describe('recordH2H', () => {
  test('counts wins per pair, order independent', () => {
    const h: H2HMap = new Map()
    recordH2H(h, m(0, 1)); recordH2H(h, m(1, 2)); recordH2H(h, m(2, 1))
    expect(h.get(pairKey(2, 1))).toEqual({ loId: 1, hiId: 2, loWins: 2, hiWins: 1 })
  })
  test('ignores undecided matches', () => {
    const h: H2HMap = new Map()
    recordH2H(h, { ...m(0), winner_id: null })
    expect(h.size).toBe(0)
  })
})

describe('metrics', () => {
  const xs = [{ p: 0.8, y: 1 as const }, { p: 0.3, y: 0 as const }, { p: 0.6, y: 0 as const }]
  test('brier', () => expect(brier(xs)).toBeCloseTo((0.04 + 0.09 + 0.36) / 3, 12))
  test('log-loss', () => expect(logLoss(xs)).toBeCloseTo(-(Math.log(0.8) + Math.log(0.7) + Math.log(0.4)) / 3, 12))
  test('accuracy', () => expect(accuracy(xs)).toBeCloseTo(2 / 3, 12))
  test('coin flip baselines', () => {
    const flip = [{ p: 0.5, y: 1 as const }, { p: 0.5, y: 0 as const }]
    expect(brier(flip)).toBeCloseTo(0.25, 12)
    expect(logLoss(flip)).toBeCloseTo(Math.LN2, 12)
  })
  test('log-loss survives p = 0 / 1', () => expect(Number.isFinite(logLoss([{ p: 0, y: 1 }]))).toBe(true))
  test('calibration buckets on favourite confidence', () => {
    const b = calibration([{ p: 0.55, y: 1 }, { p: 0.45, y: 1 }, { p: 0.95, y: 1 }], 5)
    expect(b[0].count).toBe(2)       // 55% fav won, 55% fav (team B) lost
    expect(b[0].actual).toBeCloseTo(0.5, 12)
    expect(b[4].count).toBe(1)
  })
})

describe('walkForward', () => {
  test('predicts each match BEFORE learning from it (no leakage)', () => {
    // team 1 wins everything; the very first prediction must still be 50%
    const rows = walkForward([m(0), m(1), m(2)], V2_CONFIG)
    expect(rows[0].p).toBeCloseTo(0.5, 12)
    expect(rows[1].p).toBeGreaterThan(0.5)
    expect(rows[2].p).toBeGreaterThan(rows[1].p)
  })
  test('skips forfeits and draws', () => {
    expect(isScorable({ ...m(0), forfeit: true })).toBe(false)
    expect(isScorable({ ...m(0), draw: true })).toBe(false)
    expect(walkForward([{ ...m(0), forfeit: true }, m(1)], V2_CONFIG)).toHaveLength(1)
  })
  test('evaluate splits tune / confirm by time and only scores warm matches', () => {
    const hist = Array.from({ length: 40 }, (_, d) => m(d, d % 3 ? 1 : 2))
    const e = evaluate(walkForward(hist, V2_CONFIG))
    expect(e.tune.n).toBe(10)
    expect(e.confirm.n).toBe(10)
  })
})
