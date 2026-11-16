// Streaks and recent records over graded matches (History page).
import { melbourneDay } from './time'

export interface Graded { finishedAt: string | null; correct: boolean | null }

const newestFirst = <T extends Graded>(rows: T[]) =>
  rows
    .filter((r) => r.correct != null && r.finishedAt)
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))

/** Run of identical outcomes ending at the newest graded match. */
export function currentStreak(rows: Graded[]): { kind: 'correct' | 'wrong'; length: number } | null {
  const xs = newestFirst(rows)
  if (!xs.length) return null
  const first = xs[0].correct!
  let length = 0
  for (const r of xs) {
    if (r.correct !== first) break
    length++
  }
  return { kind: first ? 'correct' : 'wrong', length }
}

/** Shift a Melbourne day key ("2026-11-16") by n calendar days. */
function shiftKey(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Correct / graded over the last `days` Melbourne calendar days, today included. */
export function windowRecord(rows: Graded[], days: number, now: Date = new Date()): { hits: number; total: number } {
  const from = shiftKey(melbourneDay(now.toISOString()), -(days - 1))
  const xs = newestFirst(rows).filter((r) => melbourneDay(r.finishedAt) >= from)
  return { hits: xs.filter((r) => r.correct).length, total: xs.length }
}
