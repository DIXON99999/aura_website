import { describe, expect, test } from 'bun:test'
import { clock, dayLabel, melbourneDay, shortDate, tzAbbr } from './time'

// These must hold no matter what timezone the machine (or CI runner) is in.

describe('Melbourne clock', () => {
  test('summer → AEDT (UTC+11)', () => {
    expect(clock('2026-11-24T04:00:00Z')).toBe('3:00 pm AEDT')
  })

  test('winter → AEST (UTC+10)', () => {
    expect(clock('2026-06-24T04:00:00Z')).toBe('2:00 pm AEST')
  })

  test('DST starts first Sunday of October (2:00 AEST → 3:00 AEDT)', () => {
    expect(tzAbbr(new Date('2026-10-03T15:59:00Z'))).toBe('AEST') // 1:59 am AEST
    expect(tzAbbr(new Date('2026-10-03T16:00:00Z'))).toBe('AEDT') // 3:00 am AEDT
  })

  test('DST ends first Sunday of April (3:00 AEDT → 2:00 AEST)', () => {
    expect(tzAbbr(new Date('2026-04-04T15:59:00Z'))).toBe('AEDT')
    expect(tzAbbr(new Date('2026-04-04T16:00:00Z'))).toBe('AEST')
  })
})

describe('melbourneDay', () => {
  test('an evening UTC time is already the next day in Melbourne', () => {
    // 13:30 UTC on 15 Nov = 00:30 AEDT on 16 Nov
    expect(melbourneDay('2026-11-15T13:30:00Z')).toBe('2026-11-16')
    expect(melbourneDay('2026-11-15T12:59:00Z')).toBe('2026-11-15')
  })

  test('null-safe', () => expect(melbourneDay(null)).toBe('unknown'))
})

describe('dayLabel', () => {
  // midday Melbourne on a day `n` days from today
  const dayFromToday = (n: number) => {
    const today = melbourneDay(new Date().toISOString())
    const d = new Date(`${today}T02:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString()
  }

  test('relative names', () => {
    expect(dayLabel(dayFromToday(0))).toBe('Today')
    expect(dayLabel(dayFromToday(1))).toBe('Tomorrow')
    expect(dayLabel(dayFromToday(-1))).toBe('Yesterday')
  })

  test('within a week: weekday only; withDate adds the date', () => {
    expect(dayLabel(dayFromToday(3))).toMatch(/^[A-Z][a-z]{2}$/)
    expect(dayLabel(dayFromToday(3), true)).toMatch(/^[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2}$/)
  })

  test('far away: always includes the date', () => {
    expect(dayLabel(dayFromToday(20))).toMatch(/\d{1,2} [A-Z][a-z]{2}$/)
  })
})

describe('shortDate', () => {
  test('uses the Melbourne date', () => expect(shortDate('2026-11-23T14:00:00Z')).toBe('24 Nov'))
  test('missing → TBA', () => expect(shortDate(null)).toBe('TBA'))
})
