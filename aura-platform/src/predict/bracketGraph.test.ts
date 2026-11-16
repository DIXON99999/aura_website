import { describe, expect, test } from 'bun:test'
import {
  layoutBracket, bracketMoves, swissLayout, pickReplay, batchMoves, defaultStage, roundLabel,
  type StageMatch, type BTeam, type Move,
} from './bracketGraph'

const T = (id: number): BTeam => ({ id, name: `T${id}`, logo: null })
let clock = Date.parse('2026-11-10T00:00:00Z')
/** match helper: teams [a,b], winner w (finished) or undefined (not started) */
function M(id: number, name: string, prev: StageMatch['prev'], teams: number[] = [], w?: number): StageMatch {
  clock += 3_600_000
  return {
    id, name, status: w ? 'finished' : 'not_started', scheduledAt: new Date(clock).toISOString(),
    endAt: w ? new Date(clock + 1800_000).toISOString() : null, bo: 3, winnerId: w ?? null, forfeit: false,
    prev, teams: teams.map(T), scores: w ? Object.fromEntries(teams.map((t) => [String(t), t === w ? 2 : 0])) : {},
  }
}
const W = (matchId: number) => ({ type: 'winner' as const, matchId })
const L = (matchId: number) => ({ type: 'loser' as const, matchId })

// BLAST Rivals playoffs shape: 2 QF → 2 SF (one seeded team each) → GF
const blast = () => [
  M(5, 'Quarterfinal 1: T1 vs T2', [], [1, 2], 1),
  M(6, 'Quarterfinal 2: T3 vs T4', [], [3, 4], 4),
  M(7, 'Semifinal 1: T9 vs T1', [W(5)], [9, 1], 9),
  M(8, 'Semifinal 2: T4 vs T10', [W(6)], [4, 10], 10),
  M(9, 'Grand Final: T9 vs T10', [W(7), W(8)], [9, 10], 10),
]

// IEM group shape: double elimination, upper final + lower final both advance
const iemGroup = () => [
  M(1, 'Upper Bracket Quarterfinal 1: a', [], [1, 2], 1),
  M(2, 'Upper Bracket Quarterfinal 2: a', [], [3, 4], 3),
  M(3, 'Upper Bracket Quarterfinal 3: a', [], [5, 6], 5),
  M(4, 'Upper Bracket Quarterfinal 4: a', [], [7, 8], 7),
  M(11, 'Upper Bracket Semifinal 1: a', [W(1), W(2)], [1, 3], 1),
  M(12, 'Upper Bracket Semifinal 2: a', [W(4), W(3)], [7, 5], 5),
  M(21, 'Lower Bracket Quarterfinal 1: a', [L(1), L(2)], [2, 4], 2),
  M(22, 'Lower Bracket Quarterfinal 2: a', [L(4), L(3)], [8, 6], 8),
  M(23, 'Lower Bracket Semifinal 1: a', [W(21), L(12)], [2, 7], 7),
  M(24, 'Lower Bracket Semifinal 2: a', [L(11), W(22)]),
  M(13, 'Upper Bracket Final: a', [W(12), W(11)], [5, 1]),
  M(25, 'Lower Bracket Final: a', [W(24), W(23)]),
]

describe('roundLabel', () => {
  test('shared prefix without the number', () => expect(roundLabel(['Semifinal 1: A vs B', 'Semifinal 2: C vs D'], 'R')).toBe('Semifinal'))
  test('no common name → fallback', () => expect(roundLabel(['A vs B', 'C vs D'], 'Round 1')).toBe('Round 1'))
})

describe('layoutBracket — single elimination with seeded semis', () => {
  const lay = layoutBracket(blast(), true)
  test('three upper columns, no lower bracket', () => {
    expect(lay.upper.map((c) => c.label)).toEqual(['Quarterfinal', 'Semifinal', 'Grand Final'])
    expect(lay.lower).toEqual([])
  })
  test('fed slot holds the QF winner; the other slot is the seeded team', () => {
    const sf1 = lay.upper[1].matches.find((x) => x.m.id === 7)!
    expect(sf1.slots[0].from).toEqual(W(5))
    expect(sf1.slots[0].team?.id).toBe(1)
    expect(sf1.slots[1].from).toBeNull()
    expect(sf1.slots[1].team?.id).toBe(9)
  })
  test('the grand final winner is Champion (last stage only)', () => {
    const gf = lay.upper[2].matches[0]
    expect(gf.out?.label).toBe('Champion')
    expect(gf.out?.team?.id).toBe(10)
    expect(layoutBracket(blast(), false).upper[2].matches[0].out?.label).toBe('Advances')
  })
  test('moves: QF winner → SF slot, loser eliminated; GF winner → champion', () => {
    const mv = bracketMoves(lay)
    expect(mv.map((x) => x.matchId)).toEqual([5, 6, 7, 8, 9])
    expect(mv[0].winner).toEqual({ team: T(1), from: '5:0', to: '7:0' })
    expect(mv[0].loser).toEqual({ team: T(2), from: '5:1', to: null })
    expect(mv[4].winner.to).toBe('out:9')
  })
})

describe('layoutBracket — double elimination', () => {
  const lay = layoutBracket(iemGroup(), false)
  test('upper and lower rows with three rounds each', () => {
    expect(lay.upper.map((c) => c.label)).toEqual(['Upper Bracket Quarterfinal', 'Upper Bracket Semifinal', 'Upper Bracket Final'])
    expect(lay.lower.map((c) => c.label)).toEqual(['Lower Bracket Quarterfinal', 'Lower Bracket Semifinal', 'Lower Bracket Final'])
  })
  test('matches sit in line with the match they feed', () => {
    // UB final takes [W12, W11] → SF2 above SF1, and SF2 takes [W4, W3]
    expect(lay.upper[1].matches.map((x) => x.m.id)).toEqual([12, 11])
    expect(lay.upper[0].matches.map((x) => x.m.id)).toEqual([4, 3, 1, 2])
  })
  test('a loser drops into the lower bracket slot', () => {
    const mv = bracketMoves(lay)
    const ubqf1 = mv.find((x) => x.matchId === 1)!
    expect(ubqf1.loser).toEqual({ team: T(2), from: '1:1', to: '21:0' })
    const ubsf2 = mv.find((x) => x.matchId === 12)!
    expect(ubsf2.loser?.to).toBe('23:1')
  })
  test('both finals advance; unplayed slots are TBD until resolved', () => {
    expect(lay.upper[2].matches[0].out?.label).toBe('Advances')
    expect(lay.lower[2].matches[0].out?.label).toBe('Advances')
    const lbsf2 = lay.lower[1].matches.find((x) => x.m.id === 24)!
    expect(lbsf2.slots.map((s) => s.team?.id)).toEqual([3, 8]) // loser of UB SF1, winner of LB QF2
    const lbf = lay.lower[2].matches[0]
    expect(lbf.slots.map((s) => s.team?.id ?? null)).toEqual([null, 7])
  })
})

describe('third place match', () => {
  test('lands in the lower row, winner gets 3rd place', () => {
    const ms = [...blast(), M(10, 'Third Place Match: T1 vs T4', [L(7), L(8)], [1, 4], 4)]
    const lay = layoutBracket(ms, true)
    expect(lay.lower[0].matches[0].out?.label).toBe('3rd place')
    expect(lay.upper[2].matches[0].out?.label).toBe('Champion')
    expect(bracketMoves(lay).find((x) => x.matchId === 7)!.loser?.to).toBe('10:0')
  })
})

describe('swissLayout', () => {
  const teams = [1, 2, 3, 4].map(T)
  const ms = [
    M(1, 'a', [], [1, 2], 1), M(2, 'b', [], [3, 4], 4),
    M(3, 'c', [], [1, 4], 1), M(4, 'd', [], [2, 3], 3),
    M(5, 'e', [], [4, 3]), // round 3 not played
  ]
  const sw = swissLayout(ms, teams)
  test('a column per round, pools by record (best first)', () => {
    expect(sw.columns.map((c) => c.label)).toEqual(['Start', 'Round 1', 'Round 2'])
    expect(sw.columns[0].pools.map((p) => `${p.wins}-${p.losses}`)).toEqual(['0-0'])
    expect(sw.columns[2].pools.map((p) => `${p.wins}-${p.losses}:${p.slots.map((s) => s.team!.id).join(',')}`))
      .toEqual(['2-0:1', '1-1:3,4', '0-2:2'])
  })
  test('moves go from a team chip in one round to the next', () => {
    expect(sw.moves).toHaveLength(4)
    expect(sw.moves[2].winner).toEqual({ team: T(1), from: 'sw:1:1', to: 'sw:2:1' })
    expect(sw.moves[2].loser).toEqual({ team: T(4), from: 'sw:1:4', to: 'sw:2:4' })
  })
  test('before any result: everyone at 0-0', () => {
    const fresh = swissLayout([M(9, 'x', [], [1, 2])], teams)
    expect(fresh.columns).toHaveLength(1)
    expect(fresh.columns[0].pools[0].slots).toHaveLength(4)
  })
})

describe('pickReplay', () => {
  const now = Date.parse('2026-11-16T12:00:00Z')
  const mv = (hoursAgo: number): Move => ({
    matchId: hoursAgo, at: now - hoursAgo * 3_600_000,
    winner: { team: T(1), from: 'a', to: 'b' }, loser: null,
  })
  const moves = [mv(5), mv(100), mv(90), mv(30), mv(20), mv(1)]
  test('first visit: the whole stage, oldest first', () => {
    expect(pickReplay(moves, null, now).map((m) => m.matchId)).toEqual([100, 90, 30, 20, 5, 1])
  })
  test('since last visit only', () => {
    expect(pickReplay(moves, now - 25 * 3_600_000, now).map((m) => m.matchId)).toEqual([20, 5, 1])
  })
  test('nothing new since last visit: nothing', () => expect(pickReplay(moves, now, now)).toEqual([]))
})

describe('batchMoves', () => {
  test('bracket plays round by round: QFs together, then semis, then the final', () => {
    const rounds = batchMoves(bracketMoves(layoutBracket(blast(), true)))
    expect(rounds.map((r) => r.map((m) => m.matchId))).toEqual([[5, 6], [7, 8], [9]])
  })
  test('lower bracket waits for the upper-bracket losers to drop in', () => {
    const rounds = batchMoves(bracketMoves(layoutBracket(iemGroup(), false)))
    expect(rounds[0].map((m) => m.matchId).sort()).toEqual([1, 2, 3, 4])
    expect(rounds.findIndex((r) => r.some((m) => m.matchId === 21))).toBeGreaterThan(0)
  })
  test('Swiss: one batch per round', () => {
    const teams = [1, 2, 3, 4].map(T)
    const sw = swissLayout([
      M(101, 'a', [], [1, 2], 1), M(102, 'b', [], [3, 4], 4),
      M(103, 'c', [], [1, 4], 1), M(104, 'd', [], [2, 3], 3),
    ], teams)
    expect(batchMoves(sw.moves).map((r) => r.length)).toEqual([2, 2])
  })
})

describe('defaultStage', () => {
  test('live stage wins, else latest result, else first', () => {
    const g = { matches: blast() }
    const later = { matches: [M(50, 'x', [], [1, 2], 1)] }
    const fresh = { matches: [M(60, 'y', [], [1, 2])] }
    expect(defaultStage([g, later, fresh])).toBe(1)
    expect(defaultStage([g, { matches: [{ ...M(70, 'z', []), status: 'running' }] }])).toBe(1)
    expect(defaultStage([fresh])).toBe(0)
  })
})
