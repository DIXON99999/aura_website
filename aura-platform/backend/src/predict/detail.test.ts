import { describe, expect, test } from 'bun:test'
import { explainPrediction, formString, modelProb, recordH2H, isScorable, isLoggable, type H2HMap } from './logic'
import { applyMatch, V2_CONFIG, expected, matchProbFromMap, type Ratings } from './elo'
import { V3_CONFIG } from './model'
import type { PSMatch } from './pandascore'

const DAY = 86_400_000
function m(day: number, a: number, b: number, winner: number, bo = 3): PSMatch {
  const maps = Math.floor(bo / 2) + 1
  return {
    id: day, name: '', status: 'finished', begin_at: null,
    scheduled_at: new Date(Date.UTC(2026, 0, 1) + day * DAY).toISOString(),
    winner_id: winner, number_of_games: bo,
    opponents: [{ type: 'Team', opponent: { id: a, name: `T${a}` } }, { type: 'Team', opponent: { id: b, name: `T${b}` } }],
    games: Array.from({ length: maps }, () => ({ finished: true, winner: { id: winner } })),
  }
}

/** A small league history: 1 strongest … 4 weakest, with some upsets. */
function league(cfg = V2_CONFIG) {
  const r: Ratings = new Map(); const h2h: H2HMap = new Map()
  const games: [number, number, number][] = [
    [1, 2, 1], [3, 4, 3], [1, 3, 1], [2, 4, 2], [1, 4, 1], [2, 3, 3],
    [1, 2, 2], [3, 4, 3], [1, 3, 1], [2, 4, 2], [1, 2, 1], [1, 2, 1],
  ]
  games.forEach(([a, b, w], d) => { const x = m(d, a, b, w); applyMatch(r, x, cfg); recordH2H(h2h, x) })
  return { r, h2h }
}

describe('explainPrediction', () => {
  for (const [name, cfg] of [['v2', V2_CONFIG], ['v3', V3_CONFIG]] as const) {
    test(`${name}: final probability is exactly what the live model predicts`, () => {
      const { r, h2h } = league(cfg)
      for (const [a, b] of [[1, 2], [2, 1], [3, 4], [1, 4], [2, 3]]) {
        const up = m(100, a, b, a)
        expect(explainPrediction(r, h2h, up, cfg)!.finalProbA).toBeCloseTo(modelProb(r, h2h, up, cfg)!.probA, 12)
      }
    })
  }

  test('steps are consistent: gap → per-map → series → H2H → final', () => {
    const { r, h2h } = league()
    const e = explainPrediction(r, h2h, m(100, 1, 2, 1))!
    expect(e.gap).toBeCloseTo(e.eloA - e.eloB, 12)
    expect(e.mapProbA).toBeCloseTo(expected(e.eloA, e.eloB), 12)
    expect(e.seriesProbA).toBeCloseTo(matchProbFromMap(e.mapProbA, 3), 12)
    expect(e.finalProbA).toBeCloseTo(e.seriesProbA + e.h2h.shift, 12)
  })

  test('H2H record is from team A\'s point of view', () => {
    const { r, h2h } = league()
    expect(explainPrediction(r, h2h, m(100, 1, 2, 1))!.h2h).toMatchObject({ aWins: 3, bWins: 1 })
    expect(explainPrediction(r, h2h, m(100, 2, 1, 1))!.h2h).toMatchObject({ aWins: 1, bWins: 3 })
  })

  test('H2H pulls toward the (shrunk) H2H rate — which can LOWER a favourite who leads the record', () => {
    // Team 1 leads 3–1, but its rating already gives it more than the shrunk
    // H2H rate (3+2)/(4+4) = 62.5%, so the blend moves it down, not up.
    const { r, h2h } = league()
    const e = explainPrediction(r, h2h, m(100, 1, 2, 1))!
    const h2hRate = (e.h2h.aWins + 2) / (e.h2h.aWins + e.h2h.bWins + 4)
    expect(e.h2h.rate).toBeCloseTo(h2hRate, 12)
    expect(Math.sign(e.h2h.shift)).toBe(Math.sign(h2hRate - e.seriesProbA))
    expect(e.seriesProbA).toBeGreaterThan(h2hRate)
    expect(e.h2h.shift).toBeLessThan(0)
  })

  test('no meetings → no H2H shift', () => {
    const e = explainPrediction(new Map(), new Map(), m(0, 7, 8, 7))!
    expect(e.h2h).toEqual({ aWins: 0, bWins: 0, shift: 0, rate: null })
    expect(e.finalProbA).toBeCloseTo(0.5, 12)
  })

  test('provisional flags follow the config (v3: < 10 matches; v2: never)', () => {
    const { r, h2h } = league()
    const up = m(100, 1, 9, 1) // team 9 has never played
    expect(explainPrediction(r, h2h, up, V3_CONFIG)!.provisional).toEqual({ a: true, b: true }) // team 1 has 7 games
    expect(explainPrediction(r, h2h, up, V2_CONFIG)!.provisional).toEqual({ a: false, b: false })
  })

  test('null when a side is unknown (TBD)', () => {
    const tbd = { ...m(0, 1, 2, 1), opponents: [{ type: 'Team', opponent: { id: 1 } }] }
    expect(explainPrediction(new Map(), new Map(), tbd)).toBeNull()
  })
})

describe('formString', () => {
  test('W/L from the team\'s perspective, in the given order', () => {
    expect(formString([{ winnerId: 1 }, { winnerId: 2 }, { winnerId: '1' }], 1)).toBe('WLW')
  })
  test('skips matches without a winner', () => {
    expect(formString([{ winnerId: null }, { winnerId: 5 }], 5)).toBe('W')
  })
})

describe('isScorable (moved to logic.ts)', () => {
  test('decisive team-vs-team matches only', () => {
    expect(isScorable(m(0, 1, 2, 1))).toBe(true)
    expect(isScorable({ ...m(0, 1, 2, 1), forfeit: true })).toBe(false)
    expect(isScorable({ ...m(0, 1, 2, 1), winner_id: null })).toBe(false)
  })
})

describe('isLoggable (form / head-to-head log)', () => {
  test('includes forfeits — the H2H record the model uses counts them', () => {
    const ff = { ...m(0, 1, 2, 1), forfeit: true }
    expect(isLoggable(ff)).toBe(true)
    expect(isScorable(ff)).toBe(false) // …but ratings skip them
    const h: H2HMap = new Map()
    recordH2H(h, ff)
    expect(h.size).toBe(1)
  })
  test('excludes draws and undecided matches', () => {
    expect(isLoggable({ ...m(0, 1, 2, 1), draw: true })).toBe(false)
    expect(isLoggable({ ...m(0, 1, 2, 1), winner_id: null })).toBe(false)
  })
})
