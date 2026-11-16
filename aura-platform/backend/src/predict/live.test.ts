import { describe, expect, test } from 'bun:test'
import { impliedMapProb, seriesProbGivenScore, liveStateFrom, liveProbA } from './logic'
import { matchProbFromMap } from './elo'
import type { PSMatch } from './pandascore'

/** Brute force: enumerate every remaining map sequence. */
function bruteForce(p: number, bo: number, a: number, b: number): number {
  const need = Math.floor(bo / 2) + 1
  if (a >= need) return 1
  if (b >= need) return 0
  return p * bruteForce(p, bo, a + 1, b) + (1 - p) * bruteForce(p, bo, a, b + 1)
}

describe('seriesProbGivenScore', () => {
  test('matches brute-force enumeration for every score in BO1/3/5', () => {
    for (const bo of [1, 3, 5]) {
      const need = Math.floor(bo / 2) + 1
      for (const p of [0.3, 0.5, 0.62, 0.9]) {
        for (let a = 0; a <= need; a++) for (let b = 0; b <= need; b++) {
          if (a >= need && b >= need) continue
          expect(seriesProbGivenScore(p, bo, a, b)).toBeCloseTo(bruteForce(p, bo, a, b), 12)
        }
      }
    }
  })
  test('0–0 equals the pre-match series probability', () => {
    for (const bo of [1, 3, 5]) expect(seriesProbGivenScore(0.6, bo, 0, 0)).toBeCloseTo(matchProbFromMap(0.6, bo), 12)
  })
  test('clinched series are certain', () => {
    expect(seriesProbGivenScore(0.2, 3, 2, 1)).toBe(1)
    expect(seriesProbGivenScore(0.9, 3, 0, 2)).toBe(0)
  })
  test('winning a map helps, losing one hurts', () => {
    const pre = seriesProbGivenScore(0.55, 3, 0, 0)
    expect(seriesProbGivenScore(0.55, 3, 1, 0)).toBeGreaterThan(pre)
    expect(seriesProbGivenScore(0.55, 3, 0, 1)).toBeLessThan(pre)
  })
  test('symmetric between the two teams', () => {
    expect(seriesProbGivenScore(0.7, 5, 2, 1)).toBeCloseTo(1 - seriesProbGivenScore(0.3, 5, 1, 2), 12)
  })
})

describe('impliedMapProb', () => {
  test('round-trips matchProbFromMap', () => {
    for (const bo of [1, 3, 5]) for (const p of [0.2, 0.45, 0.5, 0.71, 0.95]) {
      expect(impliedMapProb(matchProbFromMap(p, bo), bo)).toBeCloseTo(p, 9)
    }
  })
})

describe('liveProbA', () => {
  test('at 0–0 it is exactly the pre-match prediction', () => {
    for (const bo of [1, 3, 5]) expect(liveProbA(0.64, bo, 0, 0)).toBeCloseTo(0.64, 9)
  })
  test('an underdog who takes map 1 of a BO3 becomes the favourite only if close', () => {
    expect(liveProbA(0.45, 3, 1, 0)).toBeGreaterThan(0.5)  // near coin flip → now favoured
    expect(liveProbA(0.15, 3, 1, 0)).toBeLessThan(0.5)     // heavy underdog → still behind
  })
})

describe('liveStateFrom', () => {
  const match = (over: Partial<PSMatch> = {}) => ({
    opponents: [{ type: 'Team', opponent: { id: 10 } }, { type: 'Team', opponent: { id: 20 } }],
    results: [{ team_id: 10, score: 1 }, { team_id: 20, score: 0 }],
    games: [
      { position: 2, status: 'running', finished: false, winner: { id: undefined } },
      { position: 1, status: 'finished', finished: true, winner: { id: 10 } },
      { position: 3, status: 'not_started', finished: false, winner: { id: undefined } },
    ],
    ...over,
  }) as Pick<PSMatch, 'opponents' | 'results' | 'games'>

  test('score and maps in position order, oriented to our team A', () => {
    expect(liveStateFrom(match(), 10)).toEqual({
      scoreA: 1, scoreB: 0,
      maps: [
        { position: 1, status: 'finished', winner: 'a' },
        { position: 2, status: 'running', winner: null },
        { position: 3, status: 'not_started', winner: null },
      ],
    })
  })

  test('REGRESSION guard: our team A may be PandaScore\'s second opponent', () => {
    const s = liveStateFrom(match(), 20)
    expect([s.scoreA, s.scoreB]).toEqual([0, 1])
    expect(s.maps[0].winner).toBe('b')
  })

  test('falls back to counting finished maps when results are missing', () => {
    const s = liveStateFrom(match({ results: undefined }), 10)
    expect([s.scoreA, s.scoreB]).toEqual([1, 0])
  })
})
