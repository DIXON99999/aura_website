// All displayed times are Melbourne time (AEST/AEDT, DST-aware), regardless of
// the viewer's own timezone.
export const TZ = 'Australia/Melbourne'

/** Calendar day in Melbourne as YYYY-MM-DD — for "today"/"tomorrow" checks. */
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
const shiftDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

/** "AEDT" / "AEST" for the given moment. */
export function tzAbbr(d: Date): string {
  return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, timeZoneName: 'short' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || 'AET'
}

/** "7:30 pm AEDT" */
export function clock(iso: string): string {
  const d = new Date(iso)
  const t = d.toLocaleTimeString('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
  return `${t} ${tzAbbr(d)}`
}

/** "Today" / "Tomorrow" / "Yesterday" / "Tue" / "Tue 24 Nov" (Melbourne days).
 *  `withDate` always includes the date past yesterday/tomorrow (list headings). */
export function dayLabel(iso: string, withDate = false): string {
  const d = new Date(iso)
  const now = new Date()
  const k = dayKey(d)
  if (k === dayKey(now)) return 'Today'
  if (k === dayKey(shiftDays(now, 1))) return 'Tomorrow'
  if (k === dayKey(shiftDays(now, -1))) return 'Yesterday'
  const near = !withDate && Math.abs(d.getTime() - now.getTime()) < 6 * 86_400_000
  return d.toLocaleDateString('en-AU', near
    ? { timeZone: TZ, weekday: 'short' }
    : { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Tomorrow · 7:30 pm AEDT" */
export const dayAndClock = (iso: string) => `${dayLabel(iso)} · ${clock(iso)}`

/** "24 Nov" */
export const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { timeZone: TZ, day: 'numeric', month: 'short' }) : 'TBA'

/** Melbourne day key, for grouping lists by day. */
export const melbourneDay = (iso: string | null) => (iso ? dayKey(new Date(iso)) : 'unknown')
