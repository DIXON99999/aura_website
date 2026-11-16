import { describe, expect, test } from 'bun:test'
import { toStageMatch, stageNeedsRefresh, type StageMatch } from './logic'
import type { PSMatch } from './pandascore'

describe('toStageMatch', () => {
  const ps: PSMatch = {
    id: 9, name: 'Grand Final: A vs B', status: 'finished', scheduled_at: '2026-11-15T08:00:00Z',
    begin_at: null, end_at: '2026-11-15T11:00:00Z', winner_id: 2, number_of_games: 5,
    results: [{ team_id: 1, score: 1 }, { team_id: 2, score: 3 }],
    opponents: [
      { opponent: { id: 1, name: 'A', image_url: 'a.png' } },
      { opponent: { id: 2, name: 'B', image_url: 'b.png', dark_mode_image_url: 'b-dark.png' } },
    ],
    previous_matches: [{ type: 'winner', match_id: 7 }, { type: 'loser', match_id: 8 }],
  }

  test('keeps links, scores by team, dark logos', () => {
    const m = toStageMatch(ps)
    expect(m.prev).toEqual([{ type: 'winner', matchId: 7 }, { type: 'loser', matchId: 8 }])
    expect(m.scores).toEqual({ '1': 1, '2': 3 })
    expect(m.teams[1]).toEqual({ id: 2, name: 'B', logo: 'b-dark.png' })
    expect(m.bo).toBe(5)
  })

  test('TBD opponents are dropped; no links → empty list', () => {
    const m = toStageMatch({ ...ps, opponents: [{ opponent: undefined }], previous_matches: undefined, results: undefined })
    expect(m.teams).toEqual([])
    expect(m.prev).toEqual([])
    expect(m.scores).toEqual({})
  })
})

describe('stageNeedsRefresh', () => {
  const done = (endAt: string): StageMatch => ({
    id: 1, name: '', status: 'finished', scheduledAt: null, endAt, bo: 3, winnerId: 1,
    forfeit: false, prev: [], teams: [], scores: {},
  })
  test('never fetched → yes', () => expect(stageNeedsRefresh(undefined, null)).toBe(true))
  test('a match still to play → yes', () => {
    const m = { ...done('2026-11-01T00:00:00Z'), status: 'not_started' }
    expect(stageNeedsRefresh({ matches: [m], updatedAt: new Date('2026-11-10') }, null)).toBe(true)
  })
  test('all finished and fetched after the last match → no', () => {
    expect(stageNeedsRefresh({ matches: [done('2026-11-01T00:00:00Z')], updatedAt: new Date('2026-11-02') }, null)).toBe(false)
  })
  test('all finished but fetched before the last match ended → yes', () => {
    expect(stageNeedsRefresh({ matches: [done('2026-11-03T00:00:00Z')], updatedAt: new Date('2026-11-02') }, null)).toBe(true)
  })
})
