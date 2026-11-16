// Which matches to spotlight at the top of the Matches page.
import { stageOf } from './stage'

export interface Featurable {
  matchId: string
  name: string
  scheduledAt: string
  probA: number | null
  live: unknown | null
  teamA: { name: string } | null
  teamB: { name: string } | null
}

/** A favourite needs at least this chance for an "upset" to mean anything. */
export const UPSET_MIN_FAV = 0.6

const notStarted = <T extends Featurable>(ms: T[], now: number) =>
  ms.filter((m) => !m.live && Date.parse(m.scheduledAt) > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

/** Featured: the next grand final if one is scheduled, else the next match
 *  (callers pass the list for the current tier view). */
export function pickFeatured<T extends Featurable>(ms: T[], now = Date.now()): { match: T; reason: 'grand-final' | 'next' } | null {
  const upcoming = notStarted(ms, now)
  const gf = upcoming.find((m) => stageOf(m.name)?.level === 'gf')
  if (gf) return { match: gf, reason: 'grand-final' }
  return upcoming[0] ? { match: upcoming[0], reason: 'next' } : null
}

/** Upset watch: among priced matches with a clear favourite (≥ 60%), the one
 *  where the underdog's chance is highest. `exclude` = the featured match. */
export function pickUpset<T extends Featurable>(ms: T[], exclude?: string, now = Date.now()):
  { match: T; underdog: 'a' | 'b'; chance: number } | null {
  let best: { match: T; underdog: 'a' | 'b'; chance: number } | null = null
  for (const m of notStarted(ms, now)) {
    if (m.matchId === exclude || m.probA == null || !m.teamA || !m.teamB) continue
    const fav = Math.max(m.probA, 1 - m.probA)
    if (fav < UPSET_MIN_FAV) continue
    const chance = 1 - fav
    if (!best || chance > best.chance) best = { match: m, underdog: m.probA < 0.5 ? 'a' : 'b', chance }
  }
  return best
}
