import { describe, expect, test } from 'bun:test'
import { pickFeatured, pickUpset } from './spotlight'

const now = Date.parse('2026-11-20T00:00:00Z')
const m = (id: string, at: string, probA: number | null, name = 'Round 1: A vs B', live: unknown = null) => ({
  matchId: id, name, scheduledAt: at, probA, live, teamA: { name: `A${id}` }, teamB: { name: `B${id}` },
})

describe('pickFeatured', () => {
  test('a scheduled grand final beats an earlier ordinary match', () => {
    const r = pickFeatured([m('1', '2026-11-21T00:00:00Z', 0.5), m('2', '2026-11-23T00:00:00Z', 0.5, 'Grand Final: X vs Y')], now)
    expect(r).toMatchObject({ reason: 'grand-final', match: { matchId: '2' } })
  })
  test('otherwise the soonest match that has not started', () => {
    const r = pickFeatured([m('3', '2026-11-22T00:00:00Z', 0.5), m('1', '2026-11-21T00:00:00Z', 0.5), m('0', '2026-11-19T00:00:00Z', 0.5)], now)
    expect(r).toMatchObject({ reason: 'next', match: { matchId: '1' } })
  })
  test('live matches are never featured', () => {
    expect(pickFeatured([m('1', '2026-11-21T00:00:00Z', 0.5, 'Grand Final: X vs Y', { scoreA: 1 })], now)).toBeNull()
  })
})

describe('pickUpset', () => {
  test('the clear-favourite match whose underdog has the best chance', () => {
    const r = pickUpset([
      m('1', '2026-11-21T00:00:00Z', 0.8),   // underdog 20%
      m('2', '2026-11-21T00:00:00Z', 0.35),  // fav B 65% → underdog A 35%
      m('3', '2026-11-21T00:00:00Z', 0.55),  // no clear favourite → skipped
    ], undefined, now)!
    expect(r.match.matchId).toBe('2')
    expect(r.underdog).toBe('a')
    expect(r.chance).toBeCloseTo(0.35, 12)
  })
  test('skips the featured match, unpriced and already-started matches', () => {
    expect(pickUpset([
      m('1', '2026-11-21T00:00:00Z', 0.7),
      m('2', '2026-11-21T00:00:00Z', null),
      m('3', '2026-11-19T00:00:00Z', 0.7),
    ], '1', now)).toBeNull()
  })
})
