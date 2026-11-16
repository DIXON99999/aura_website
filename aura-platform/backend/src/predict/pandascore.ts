// Minimal PandaScore CS2 client: throttled, retries on 429 burst limit.
const BASE = 'https://api.pandascore.co'

const TOKEN = process.env.PANDASCORE_TOKEN
if (!TOKEN) throw new Error('Missing PANDASCORE_TOKEN in env')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface PSOpponent {
  type?: string
  opponent?: { id?: number; name?: string; image_url?: string; dark_mode_image_url?: string | null; location?: string | null }
}
export interface PSGame { position?: number; finished?: boolean; winner?: { id?: number } }
export interface PSMatch {
  id: number
  name: string
  scheduled_at: string | null
  begin_at: string | null
  status: string
  winner_id: number | null
  draw?: boolean
  forfeit?: boolean
  number_of_games?: number
  league?: { name?: string }
  serie?: { full_name?: string; tier?: string }
  /** tier lives on the tournament (s/a/b/c/d); serie.tier is always null */
  /** type: 'online' | 'offline' (LAN); region e.g. 'WEU', 'EEU', 'NA', 'SA', 'ASIA' */
  tournament?: { name?: string; tier?: string | null; type?: string | null; region?: string | null }
  end_at?: string | null
  results?: { team_id: number; score: number }[]
  opponents: PSOpponent[]
  games?: PSGame[]
  streams_list?: { raw_url?: string; main?: boolean }[]
}

async function get(path: string, tries = 0): Promise<any> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}token=${TOKEN}`)
  if (res.status === 429 && tries < 6) {
    const wait = (Number(res.headers.get('retry-after') || 2) + 1) * 1000
    await sleep(wait)
    return get(path, tries + 1)
  }
  if (!res.ok) throw new Error(`PandaScore ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

/** Page through an endpoint until exhausted (or maxPages), throttled under 60/min. */
export async function paginate(path: string, maxPages = 500): Promise<PSMatch[]> {
  const out: PSMatch[] = []
  for (let p = 1; p <= maxPages; p++) {
    const sep = path.includes('?') ? '&' : '?'
    const batch: PSMatch[] = await get(`${path}${sep}per_page=100&page=${p}`)
    out.push(...batch)
    if (batch.length < 100) break
    await sleep(1100)
  }
  return out
}

/** Upcoming CS2 matches (one page is plenty — soonest first). */
export function upcoming(perPage = 50): Promise<PSMatch[]> {
  return get(`/csgo/matches/upcoming?per_page=${perPage}&sort=scheduled_at`)
}

/** Past CS2 matches, most recent first. */
export function pastPage(page: number, perPage = 100): Promise<PSMatch[]> {
  return get(`/csgo/matches/past?per_page=${perPage}&page=${page}&sort=-scheduled_at`)
}

export interface PSTournament {
  id: number
  name: string
  begin_at: string | null
  end_at: string | null
  tier: string | null
  region: string | null
  prizepool: string | null
  league?: { name?: string; image_url?: string | null }
  serie_id: number
  serie?: { full_name?: string }
  teams?: { id: number; name: string; image_url?: string | null }[]
  matches?: { id: number; status: string }[]
}

/** Tier S/A tournaments that are running or yet to start. */
export function tier1Tournaments(kind: 'upcoming' | 'running'): Promise<PSTournament[]> {
  return get(`/csgo/tournaments/${kind}?filter[tier]=s,a&per_page=100&sort=begin_at`)
}

/** Not-yet-played matches belonging to the given tournaments (soonest first). */
export function upcomingForTournaments(ids: number[]): Promise<PSMatch[]> {
  if (!ids.length) return Promise.resolve([])
  return get(`/csgo/matches/upcoming?filter[tournament_id]=${ids.join(',')}&per_page=100&sort=scheduled_at`)
}

/** Full detail for one match (generic endpoint — the /csgo/ one is 403 on free tier).
 *  Near match time this is where games[].map (the played/veto maps) fills in. */
export function matchDetail(id: number): Promise<any> {
  return get(`/matches/${id}`)
}
