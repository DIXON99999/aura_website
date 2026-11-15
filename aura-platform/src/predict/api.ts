const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface Team { id: string; name: string; elo: number | null; games: number; logo?: string | null }
export interface Prediction {
  matchId: string; name: string; scheduledAt: string; league: string | null; serie: string | null
  bo: number; tier: string | null; streamUrl: string | null; model: string; maps?: string[] | null
  /** null while the team is still to be determined */
  teamA: Team | null; teamB: Team | null
  /** null until both teams are known */
  probA: number | null; probB: number | null
}
export interface TourEvent {
  id: string; league: string | null; serie: string | null; tier: string | null
  region: string | null; prizepool: string | null; beginAt: string | null; endAt: string | null
  live: boolean; stages: { name: string; beginAt: string | null; endAt: string | null }[]
  teams: { name: string; logo: string | null }[]
}
export type TierFilter = 'tier1' | 'other'
export interface HistoryTeam { id: string; name: string; logo: string | null; score: number | null }
export interface HistoryRow {
  matchId: string; name: string; finishedAt: string | null; league: string | null; serie: string | null
  tier: string | null; bo: number | null; forfeit: boolean
  teamA: HistoryTeam; teamB: HistoryTeam; winnerId: string
  /** model's pre-match probability for teamA, null if the match wasn't priced */
  probA: number | null; correct: boolean | null
  /** 'live' = stored before the match; 'replay' = walk-forward model replay using only pre-match data */
  pickSource: 'live' | 'replay' | null
}
export interface Accuracy {
  total: number; correct: number; accuracy: number | null
  calibration: { n: number; predicted: number; actual: number }[]
}

/** Display name for an event: league + serie, which carries the host city for
 *  LANs — "PGL" + "Cluj-Napoca 2026" → "PGL Cluj-Napoca 2026". */
export function eventName(league: string | null, serie: string | null): string {
  if (!league) return serie || 'CS2'
  if (!serie) return league
  return serie.toLowerCase().startsWith(league.toLowerCase()) ? serie : `${league} ${serie}`
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export const getUpcoming = (tier: TierFilter) => get<Prediction[]>(`/predictions/upcoming?tier=${tier}`)
export const getEvents = () => get<TourEvent[]>('/predictions/events')
export const getHistory = (tier?: TierFilter) => get<HistoryRow[]>(`/predictions/history${tier ? `?tier=${tier}` : ''}`)
export const getAccuracy = () => get<Accuracy>('/predictions/accuracy')
