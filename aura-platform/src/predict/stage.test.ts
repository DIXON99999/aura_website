import { describe, expect, test } from 'bun:test'
import { stageOf } from './stage'

// Real round prefixes seen in PandaScore CS2 data (casing/spelling vary).
const CASES: [string, string | null, 'qf' | 'sf' | 'gf' | null][] = [
  ['Grand Final: TS vs FURIA', 'Grand Final', 'gf'],
  ['Grand final: A vs B', 'Grand Final', 'gf'],
  ['Final: A vs B', 'Grand Final', 'gf'],
  ['Semifinal 2: FURIA vs FAL', 'Semifinal', 'sf'],
  ['Upper Bracket Semifinal 2: A vs B', 'UB Semifinal', 'sf'],
  ['Lower bracket semifinal: A vs B', 'LB Semifinal', 'sf'],
  ['Upper Bracket Final: A vs B', 'UB Final', 'sf'],
  ['Lower Bracket Final: A vs B', 'LB Final', 'sf'],
  ['Quarterfinal 1: VIT vs MOUZ', 'Quarterfinal', 'qf'],
  ['Upper Bracket Quarterfinal 4: A vs B', 'UB Quarterfinal', 'qf'],
  ['Lower bracket quarterfinal 2: A vs B', 'LB Quarterfinal', 'qf'],
  // not playoff stages → no badge
  ['Round 1: 9z vs LVG', null, null],
  ['Winners Match: TS vs G2', null, null],
  ['Elimination Match: FUT vs MOUZ', null, null],
  ['Decider match: A vs B', null, null],
  ['3rd Place Match: A vs B', null, null],
  ['Lower bracket round 1 match 1: A vs B', null, null],
  ['MOUZ vs G2', null, null],
]

describe('stageOf', () => {
  test.each(CASES)('%s', (name, label, level) => {
    const s = stageOf(name)
    expect(s?.label ?? null).toBe(label)
    expect(s?.level ?? null).toBe(level)
  })

  test('only looks at the round prefix, not team names', () => {
    // a team called "Final Boss" must not turn a group match into a grand final
    expect(stageOf('Round 2: Final Boss vs Quarterfinal Kings')).toBeNull()
  })

  test('empty / missing names', () => {
    expect(stageOf(null)).toBeNull()
    expect(stageOf(undefined)).toBeNull()
    expect(stageOf('')).toBeNull()
  })

  test('each level has its badge colour', () => {
    const levels = ['Quarterfinal 1: a vs b', 'Semifinal 1: a vs b', 'Grand Final: a vs b'].map((n) => stageOf(n)!.bg)
    expect(new Set(levels).size).toBe(3)
  })
})
