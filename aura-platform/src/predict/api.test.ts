import { describe, expect, test } from 'bun:test'
import { eventName } from './api'

describe('eventName', () => {
  test('league + serie (serie carries the host city for LANs)', () => {
    expect(eventName('PGL Major', 'Singapore 2026')).toBe('PGL Major Singapore 2026')
    expect(eventName('RUSH', 'Brno 2026')).toBe('RUSH Brno 2026')
  })

  test('serie that already starts with the league is not doubled', () => {
    expect(eventName('BLAST', 'BLAST Rivals Fall 2026')).toBe('BLAST Rivals Fall 2026')
    expect(eventName('esl', 'ESL Pro League Season 23')).toBe('ESL Pro League Season 23')
  })

  test('missing parts', () => {
    expect(eventName('CCT Europe', null)).toBe('CCT Europe')
    expect(eventName(null, 'Season 10 2026')).toBe('Season 10 2026')
    expect(eventName(null, null)).toBe('CS2')
  })
})
