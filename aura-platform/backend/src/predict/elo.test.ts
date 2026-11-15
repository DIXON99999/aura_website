import { describe, expect, test } from 'bun:test'
import { START, K_MAP, expected, matchProbFromMap, applyMatch, predict, type Ratings } from './elo'
import type { PSMatch } from './pandascore'

/** Minimal finished/upcoming match between team 1 and team 2. */
function match(over: Partial<PSMatch> & { mapWinners?: number[] } = {}): PSMatch {
  const { mapWinners = [], ...rest } = over
  return {
    id: 1, name: 'A vs B', scheduled_at: null, begin_at: null, status: 'finished',
    winner_id: mapWinners.length ? mapWinners.filter((w) => w === 1).length * 2 > mapWinners.length ? 1 : 2 : null,
    number_of_games: 3,
    opponents: [
      { type: 'Team', opponent: { id: 1, name: 'Alpha' } },
      { type: 'Team', opponent: { id: 2, name: 'Bravo' } },
    ],
    games: mapWinners.map((w, i) => ({ position: i + 1, finished: true, winner: { id: w } })),
    ...rest,
  }
}

describe('expected', () => {
  test('equal ratings → 50%', () => expect(expected(1500, 1500)).toBe(0.5))
  test('400 points stronger → 10:1 odds', () => expect(expected(1900, 1500)).toBeCloseTo(10 / 11, 10))
  test('symmetric', () => expect(expected(1620, 1500) + expected(1500, 1620)).toBeCloseTo(1, 12))
})

describe('matchProbFromMap', () => {
  test('BO1 is just the map probability', () => expect(matchProbFromMap(0.62, 1)).toBeCloseTo(0.62, 12))
  test('a coin flip stays a coin flip at any length', () => {
    for (const bo of [1, 3, 5]) expect(matchProbFromMap(0.5, bo)).toBeCloseTo(0.5, 12)
  })
  test('BO3 = p² + 2p²(1-p)', () => {
    const p = 0.6
    expect(matchProbFromMap(p, 3)).toBeCloseTo(p * p + 2 * p * p * (1 - p), 12)
  })
  test('longer series favour the stronger team more', () => {
    expect(matchProbFromMap(0.6, 5)).toBeGreaterThan(matchProbFromMap(0.6, 3))
    expect(matchProbFromMap(0.6, 3)).toBeGreaterThan(matchProbFromMap(0.6, 1))
  })
  test('bo of 0 is treated as BO1', () => expect(matchProbFromMap(0.7, 0)).toBeCloseTo(0.7, 12))
})

describe('applyMatch', () => {
  test('per-map updates are zero-sum and favour the winner', () => {
    const r: Ratings = new Map()
    applyMatch(r, match({ mapWinners: [1, 1] }))
    const a = r.get(1)!, b = r.get(2)!
    expect(a.elo).toBeGreaterThan(START)
    expect(a.elo + b.elo).toBeCloseTo(2 * START, 9)
    // first map at even ratings moves exactly K/2
    expect(a.elo - START).toBeGreaterThan(K_MAP / 2)
    expect(a.games).toBe(1)
    expect(b.games).toBe(1)
  })

  test('forfeits, draws and non-team opponents are ignored', () => {
    for (const m of [
      match({ mapWinners: [1, 1], forfeit: true }),
      match({ mapWinners: [1, 1], draw: true }),
      match({ mapWinners: [1, 1], opponents: [{ type: 'Player', opponent: { id: 1 } }, { type: 'Team', opponent: { id: 2 } }] }),
    ]) {
      const r: Ratings = new Map()
      applyMatch(r, m)
      expect(r.size).toBe(0)
    }
  })

  test('unfinished maps do not move ratings', () => {
    const r: Ratings = new Map()
    const m = match({ mapWinners: [1] })
    m.games = [{ position: 1, finished: false, winner: { id: 1 } }]
    applyMatch(r, m)
    expect(r.get(1)!.elo).toBe(START)
  })
})

describe('predict', () => {
  test('unknown teams default to START → 50%', () => {
    const p = predict(new Map(), match({ status: 'not_started' }))!
    expect(p.probA).toBeCloseTo(0.5, 12)
    expect(p.teamA.games).toBe(0)
    expect(p.bo).toBe(3)
  })

  test('needs two opponents with ids', () => {
    expect(predict(new Map(), match({ opponents: [{ type: 'Team', opponent: { id: 1 } }] }))).toBeNull()
  })

  test('stronger team A is favoured, and probA + probB = 1 by construction', () => {
    const r: Ratings = new Map([
      [1, { elo: 1700, formElo: 1700, games: 50, name: 'Alpha' }],
      [2, { elo: 1500, formElo: 1500, games: 50, name: 'Bravo' }],
    ])
    const ab = predict(r, match())!
    expect(ab.probA).toBeGreaterThan(0.5)
    // swapping the order gives the complement
    const swapped = match()
    swapped.opponents = [...swapped.opponents].reverse()
    expect(predict(r, swapped)!.probA).toBeCloseTo(1 - ab.probA, 12)
  })
})
