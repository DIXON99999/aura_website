import { describe, expect, test } from 'bun:test'
import { currentStreak, windowRecord } from './streaks'

const row = (finishedAt: string, correct: boolean | null) => ({ finishedAt, correct })

describe('currentStreak', () => {
  test('counts the run ending at the newest graded match', () => {
    const rows = [
      row('2026-11-15T10:00:00Z', true),
      row('2026-11-15T12:00:00Z', true),
      row('2026-11-14T10:00:00Z', false),
      row('2026-11-15T08:00:00Z', true),
    ]
    expect(currentStreak(rows)).toEqual({ kind: 'correct', length: 3 })
  })
  test('a losing run is reported as such', () => {
    expect(currentStreak([row('2026-11-15T10:00:00Z', false), row('2026-11-14T10:00:00Z', false), row('2026-11-13T10:00:00Z', true)]))
      .toEqual({ kind: 'wrong', length: 2 })
  })
  test('ungraded matches (no prediction) are skipped, not streak-breakers', () => {
    expect(currentStreak([row('2026-11-15T10:00:00Z', null), row('2026-11-14T10:00:00Z', true), row('2026-11-13T10:00:00Z', true)]))
      .toEqual({ kind: 'correct', length: 2 })
  })
  test('nothing graded → null', () => expect(currentStreak([row('2026-11-15T10:00:00Z', null)])).toBeNull())
})

describe('windowRecord', () => {
  const now = new Date('2026-11-16T02:00:00Z') // 1 pm, Mon 16 Nov in Melbourne
  test('last 7 Melbourne days, today included (10–16 Nov)', () => {
    const rows = [
      row('2026-11-15T22:00:00Z', true),   // 16 Nov 9 am AEDT — today → in
      row('2026-11-09T13:30:00Z', false),  // 10 Nov 00:30 AEDT — first day of the window → in
      row('2026-11-09T12:30:00Z', true),   //  9 Nov 23:30 AEDT — one minute too early → out
      row('2026-11-12T10:00:00Z', null),   // ungraded → ignored
    ]
    expect(windowRecord(rows, 7, now)).toEqual({ hits: 1, total: 2 })
  })
  test('empty window', () => expect(windowRecord([], 7, now)).toEqual({ hits: 0, total: 0 }))
})
