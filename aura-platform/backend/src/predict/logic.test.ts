import { describe, expect, test } from 'bun:test'
import {
  h2hAdjust, H2H_MAX_WEIGHT, pairKey, modelProb, teamPopular, isTier1, shouldShow,
  scoreOf, staleUpcomingIds, orientProbA, type H2HMap,
} from './logic'
import type { Ratings } from './elo'
import type { PSMatch } from './pandascore'

const opp = (...names: (string | undefined)[]) =>
  names.map((name, i) => ({ type: 'Team', opponent: { id: i + 1, name } }))

describe('h2hAdjust', () => {
  test('no meetings → Elo probability unchanged', () => expect(h2hAdjust(0.7, 0, 0)).toBe(0.7))

  test('a dominant record pulls toward the winner, never past the cap', () => {
    const elo = 0.4
    const adj = h2hAdjust(elo, 10, 0)
    expect(adj).toBeGreaterThan(elo)
    // weight is capped, so at most H2H_MAX_WEIGHT of the gap to 1 can be closed
    expect(adj).toBeLessThanOrEqual(elo + H2H_MAX_WEIGHT * (1 - elo) + 1e-12)
  })

  test('one meeting barely moves it (prior + ramped weight)', () => {
    expect(Math.abs(h2hAdjust(0.5, 1, 0) - 0.5)).toBeLessThan(0.02)
  })

  test('symmetric in the two teams', () => {
    expect(h2hAdjust(0.6, 3, 1)).toBeCloseTo(1 - h2hAdjust(0.4, 1, 3), 12)
  })
})

describe('pairKey', () => {
  test('order independent', () => expect(pairKey(42, 7)).toBe(pairKey(7, 42)))
  test('lowest id first', () => expect(pairKey(42, 7)).toBe('7-42'))
})

describe('modelProb', () => {
  const r: Ratings = new Map([
    [1, { elo: 1600, formElo: 1600, games: 40, name: 'Alpha' }],
    [2, { elo: 1600, formElo: 1600, games: 40, name: 'Bravo' }],
  ])
  const m = { opponents: opp('Alpha', 'Bravo'), number_of_games: 1 } as PSMatch

  test('applies the H2H record from team A\'s point of view', () => {
    // lo = 1 (Alpha) has won 6 of 6
    const h2h: H2HMap = new Map([[pairKey(1, 2), { loId: 1, hiId: 2, loWins: 6, hiWins: 0 }]])
    expect(modelProb(r, h2h, m)!.probA).toBeGreaterThan(0.5)
    // same record, but listed with Bravo as team A → Bravo is the underdog
    const flipped = { ...m, opponents: [...m.opponents].reverse() } as PSMatch
    expect(modelProb(r, h2h, flipped)!.probA).toBeLessThan(0.5)
  })

  test('no record → plain Elo', () => expect(modelProb(r, new Map(), m)!.probA).toBeCloseTo(0.5, 12))
})

describe('teamPopular', () => {
  test.each(['Team Vitality', 'FaZe Clan', 'Natus Vincere', 'NAVI', 'MOUZ', 'G2 Esports', 'Virtus.pro'])(
    '%s is popular', (n) => expect(teamPopular(n)).toBe(true))

  test.each(['Vitality Academy', 'Spirit Academy Green', 'Aurora Young Blood', 'ex-ENCE', 'NAVI Junior'])(
    '%s is not a main roster', (n) => expect(teamPopular(n)).toBe(false))

  test('word-boundary tags do not match inside other words', () => {
    expect(teamPopular('Bigetron')).toBe(false) // \bbig\b
    expect(teamPopular('Dogma')).toBe(false)    // \bog\b
  })

  test('empty / missing names', () => {
    expect(teamPopular(null)).toBe(false)
    expect(teamPopular(undefined)).toBe(false)
    expect(teamPopular('')).toBe(false)
  })
})

describe('isTier1 / shouldShow', () => {
  test('tier comes from tournament.tier (S or A, any case)', () => {
    expect(isTier1({ tournament: { tier: 's' } })).toBe(true)
    expect(isTier1({ tournament: { tier: 'A' } })).toBe(true)
    expect(isTier1({ tournament: { tier: 'b' } })).toBe(false)
    expect(isTier1({ tournament: { tier: null } })).toBe(false)
    expect(isTier1({})).toBe(false)
  })

  test('tier-1 matches show even between unknown teams', () => {
    expect(shouldShow({ tournament: { tier: 's' }, opponents: opp('Nobody', 'Unknown') })).toBe(true)
  })

  test('tier-1 TBD matches (no opponents yet) still show', () => {
    expect(shouldShow({ tournament: { tier: 's' }, opponents: [] })).toBe(true)
  })

  test('lower tiers need a popular team', () => {
    expect(shouldShow({ tournament: { tier: 'c' }, opponents: opp('Nobody', 'FaZe') })).toBe(true)
    expect(shouldShow({ tournament: { tier: 'c' }, opponents: opp('Nobody', 'Unknown') })).toBe(false)
  })
})

describe('scoreOf', () => {
  const m = { results: [{ team_id: 10, score: 2 }, { team_id: 20, score: 1 }] }
  test('finds the team\'s score', () => {
    expect(scoreOf(m, 10)).toBe(2)
    expect(scoreOf(m, 20)).toBe(1)
  })
  test('null when missing', () => {
    expect(scoreOf(m, 99)).toBeNull()
    expect(scoreOf({}, 10)).toBeNull()
  })
})

describe('staleUpcomingIds', () => {
  const now = new Date('2026-11-20T12:00:00Z')
  const future = '2026-11-24T04:00:00Z'
  const past = '2026-11-20T10:00:00Z' // started 2h ago → live

  test('REGRESSION: live matches are kept so they can be settled', () => {
    // The original refresh deleted every upcoming row each run; a match that
    // had gone live (and so left the upcoming feed) was wiped before its result
    // came in, so nothing was ever graded and accuracy stayed at 0.
    expect(staleUpcomingIds([{ matchId: 1, scheduledAt: past }], [], now)).toEqual([])
  })

  test('future rows written this refresh are kept', () => {
    expect(staleUpcomingIds([{ matchId: 2, scheduledAt: future }], [2], now)).toEqual([])
  })

  test('future rows that dropped out of the feed are removed', () => {
    expect(staleUpcomingIds([{ matchId: 3, scheduledAt: future }], [], now)).toEqual([3])
  })

  test('rows without a time are left alone', () => {
    expect(staleUpcomingIds([{ matchId: 4, scheduledAt: null }], [], now)).toEqual([])
  })

  test('accepts Date objects (as pg returns them)', () => {
    expect(staleUpcomingIds([{ matchId: 5, scheduledAt: new Date(future) }], [], now)).toEqual([5])
  })
})

describe('orientProbA', () => {
  test('same team A → unchanged', () => expect(orientProbA(0.7, 10, 10)).toBe(0.7))
  test('REGRESSION: teams listed the other way round → complement', () => {
    expect(orientProbA(0.7, 10, 20)).toBeCloseTo(0.3, 12)
  })
  test('ids compare across string/number (pg BIGINT comes back as string)', () => {
    expect(orientProbA(0.7, '10', 10)).toBe(0.7)
  })
  test('no prediction → null', () => {
    expect(orientProbA(null, 10, 10)).toBeNull()
    expect(orientProbA(undefined, 10, 10)).toBeNull()
  })
})
