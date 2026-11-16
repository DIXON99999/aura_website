import type { BTeam, StageMatch } from './bracketGraph'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface Team { id: string; name: string; elo: number | null; games: number; logo?: string | null }
/** In-progress match state (updated every minute by the backend). */
export interface LiveInfo {
  scoreA: number; scoreB: number
  maps: { position: number; status: 'finished' | 'running' | 'not_started'; winner: 'a' | 'b' | null }[]
  /** odds re-priced from the current map score (null if the match wasn't priced) */
  probA: number | null
  updatedAt: string
}
export interface Prediction {
  matchId: string; name: string; scheduledAt: string; league: string | null; serie: string | null
  bo: number; tier: string | null; streamUrl: string | null; model: string; maps?: string[] | null
  /** null while the team is still to be determined */
  teamA: Team | null; teamB: Team | null
  /** pre-match prediction; null until both teams are known */
  probA: number | null; probB: number | null
  /** set while the match is in progress */
  live: LiveInfo | null
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
export interface ModelBacktest {
  version: string; summary: string
  logLoss: number; brier: number; accuracy: number; n: number
  tier1Accuracy: number; tier1N: number
}
export interface Accuracy {
  total: number; correct: number; accuracy: number | null
  calibration: { n: number; predicted: number; actual: number }[]
  /** live (graded) results per model version */
  byModel: { version: string; n: number; accuracy: number | null; brier: number }[]
  currentModel: string
  /** walk-forward backtest per model version, oldest first */
  backtests: ModelBacktest[]
}

/** Display name for an event: league + serie, which carries the host city for
 *  LANs — "PGL" + "Cluj-Napoca 2026" → "PGL Cluj-Napoca 2026". */
export function eventName(league: string | null, serie: string | null): string {
  if (!league) return serie || 'CS2'
  if (!serie) return league
  return serie.toLowerCase().startsWith(league.toLowerCase()) ? serie : `${league} ${serie}`
}

export interface RecentMatch {
  matchId: string; playedAt: string
  opponent: { id: string; name: string; logo: string | null }
  won: boolean
  /** [own score, opponent score] */
  score: [number | null, number | null]
  event: string | null
  /** won/lost by forfeit — counts in head-to-head, not in ratings */
  forfeit: boolean
}
export interface TeamDetail {
  id: string; name: string; logo: string | null
  elo: number | null; games: number; rank: number | null
  /** newest first, e.g. "WWLWL" */
  form: string
  recent: RecentMatch[]
  /** oldest → newest rating after each match */
  eloTrend: { t: string; elo: number }[]
}
export interface Explanation {
  eloA: number; eloB: number; gap: number
  mapProbA: number; bo: number; seriesProbA: number
  h2h: { aWins: number; bWins: number; shift: number; rate: number | null }
  finalProbA: number
  provisional: { a: boolean; b: boolean }
  gamesA: number; gamesB: number
}
export interface MatchDetail {
  matchId: string; name: string
  league: string | null; serie: string | null; tier: string | null; bo: number | null
  scheduledAt: string | null; status: 'upcoming' | 'live' | 'finished'
  live: LiveInfo | null
  streamUrl: string | null
  /** [team A, team B] */
  score: [number | null, number | null] | null
  winnerId: string | null; forfeit: boolean
  probA: number | null; pickSource: 'live' | 'replay' | null; model: string | null
  correct: boolean | null
  /** null while still to be determined */
  teamA: TeamDetail | null; teamB: TeamDetail | null
  h2h: { aWins: number; bWins: number; meetings: Omit<RecentMatch, 'opponent'>[] } | null
  /** step-by-step prediction breakdown (upcoming matches only) */
  explain: Explanation | null
  /** event + stage whose bracket contains this match, if stored */
  bracket: { serieId: string; tournamentId: string } | null
}

export interface BracketStage {
  tournamentId: string; name: string; hasBracket: boolean
  beginAt: string | null; endAt: string | null
  teams: BTeam[]; matches: StageMatch[]
}
export interface EventBracket {
  serieId: string; league: string | null; serie: string | null
  stages: BracketStage[]
  /** model probability per match, keyed by team id (pre-match; live odds while running) */
  probs: Record<string, Record<string, number>>
}
export interface BracketEvent {
  serieId: string; league: string | null; serie: string | null
  beginAt: string | null; endAt: string | null; live: boolean
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
export const getMatch = (id: string) => get<MatchDetail>(`/predictions/match/${encodeURIComponent(id)}`)
export const getBracket = (serieId: string) => get<EventBracket>(`/predictions/events/${encodeURIComponent(serieId)}/bracket`)
export const getBrackets = () => get<BracketEvent[]>('/predictions/brackets')
