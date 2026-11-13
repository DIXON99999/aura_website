const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface Team { id: string; name: string; elo: number; games: number; logo?: string | null }
export interface Prediction {
  matchId: string; name: string; scheduledAt: string; league: string | null
  bo: number; streamUrl: string | null; model: string; maps?: string[] | null
  teamA: Team; teamB: Team; probA: number; probB: number
}
export interface RankRow { rank: number; id: string; name: string; elo: number; games: number; logo?: string | null }
export interface Accuracy {
  total: number; correct: number; accuracy: number | null
  calibration: { n: number; predicted: number; actual: number }[]
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export const getUpcoming = () => get<Prediction[]>('/predictions/upcoming')
export const getRankings = () => get<RankRow[]>('/predictions/rankings')
export const getAccuracy = () => get<Accuracy>('/predictions/accuracy')
