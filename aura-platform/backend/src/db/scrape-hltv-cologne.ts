import pg from 'pg'
import { randomUUID } from 'crypto'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL || '').includes('digitalocean') ? { rejectUnauthorized: false } : undefined,
})

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'csgo-matches-and-tournaments.p.rapidapi.com'
const EVENT_ID = process.env.HLTV_EVENT_ID || '8301'
const GAME_ID = 'game-cs2'
const RATE_LIMIT_MS = 31 * 60 * 1000

if (!RAPIDAPI_KEY) {
  console.error('Missing RAPIDAPI_KEY in env')
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const PROBE = args.has('--probe')
const FORCE = args.has('--force')
const SKIP_TEAMS = args.has('--skip-teams')

class RapidError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`API error ${status}`)
    this.status = status
    this.body = body
  }
}

async function rapid(path: string): Promise<any> {
  const url = `https://${RAPIDAPI_HOST}${path}`
  console.log(`  → GET ${url}`)
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY!,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`  ✗ ${res.status} ${res.statusText}: ${text.slice(0, 500)}`)
    throw new RapidError(res.status, text)
  }
  try {
    return JSON.parse(text)
  } catch {
    console.error(`  ✗ Non-JSON response: ${text.slice(0, 500)}`)
    throw new Error('Non-JSON response')
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function getProp<T = any>(obj: any, keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  return undefined
}

function extractMatchTeam(side: any): { hltvId?: string; name?: string; logo?: string } {
  if (!side) return {}
  return {
    hltvId: String(getProp(side, ['id', 'team_id', 'hltvId']) ?? '') || undefined,
    name: getProp(side, ['name', 'team_name', 'team']),
    logo: getProp(side, ['logo', 'image', 'logo_url']),
  }
}

function extractScheduledAt(m: any): Date | null {
  const raw = getProp(m, ['date', 'time', 'scheduled_at', 'startTime', 'start_time', 'datetime'])
  if (!raw) return null
  if (typeof raw === 'number') {
    return new Date(raw < 1e12 ? raw * 1000 : raw)
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function extractFormat(m: any): string | null {
  const f = getProp<string | number>(m, ['format', 'bestOf', 'best_of', 'series_type'])
  if (!f) return null
  const s = String(f).toLowerCase()
  if (s.includes('5') || s === 'bo5') return 'bo5'
  if (s.includes('3') || s === 'bo3') return 'bo3'
  if (s.includes('1') || s === 'bo1') return 'bo1'
  return s
}

function matchBelongsToEvent(m: any, eventId: string): boolean {
  const ev = getProp(m, ['event', 'tournament'])
  if (ev && typeof ev === 'object') {
    const id = String(getProp(ev, ['id', 'event_id']) ?? '')
    if (id === eventId) return true
  }
  const flatId = String(getProp(m, ['event_id', 'eventId', 'tournament_id']) ?? '')
  if (flatId === eventId) return true
  return false
}

function extractEventInfo(m: any): { id?: string; name?: string } {
  const ev = getProp(m, ['event', 'tournament'])
  if (ev && typeof ev === 'object') {
    return {
      id: String(getProp(ev, ['id', 'event_id']) ?? '') || undefined,
      name: getProp(ev, ['name', 'event_name']),
    }
  }
  return {
    id: String(getProp(m, ['event_id', 'eventId', 'tournament_id']) ?? '') || undefined,
    name: getProp(m, ['event_name', 'tournament_name']),
  }
}

async function getCachedTeam(hltvId: string): Promise<any | null> {
  const r = await pool.query('SELECT * FROM hltv_team_cache WHERE hltv_id = $1', [hltvId])
  return r.rows[0] || null
}

async function cacheTeam(hltvId: string, data: any): Promise<void> {
  const name = getProp<string>(data, ['name', 'team_name']) || ''
  const logo = getProp<string>(data, ['logo', 'logo_url', 'image'])
  const country = getProp<string>(data, ['country', 'country_name'])
  const players = getProp<any[]>(data, ['players', 'roster', 'lineup']) || []
  const roster = players.map((p) => ({
    hltvId: String(getProp(p, ['id', 'player_id']) ?? '') || undefined,
    name: getProp<string>(p, ['name', 'nickname', 'ign']) || '',
    fullName: getProp<string>(p, ['full_name', 'real_name', 'fullName']),
    country: getProp<string>(p, ['country', 'country_name', 'nationality']),
    image: getProp<string>(p, ['image', 'image_url', 'photo']),
  }))
  await pool.query(
    `INSERT INTO hltv_team_cache (hltv_id, name, logo_url, country, roster, raw, fetched_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
     ON CONFLICT (hltv_id) DO UPDATE SET
       name = EXCLUDED.name,
       logo_url = EXCLUDED.logo_url,
       country = EXCLUDED.country,
       roster = EXCLUDED.roster,
       raw = EXCLUDED.raw,
       fetched_at = NOW()`,
    [hltvId, name, logo, country, JSON.stringify(roster), JSON.stringify(data)]
  )
}

async function upsertMatch(m: any, eventInfo: { id?: string; name?: string }, teamCache: Map<string, any>): Promise<string | null> {
  const externalId = String(getProp(m, ['id', 'match_id', 'matchId']) ?? '')
  if (!externalId) {
    console.warn('  ! Match missing id, skipping')
    return null
  }
  const teamARaw = getProp(m, ['team1', 'team_a', 'teamA', 'home'])
  const teamBRaw = getProp(m, ['team2', 'team_b', 'teamB', 'away'])
  const a = extractMatchTeam(teamARaw)
  const b = extractMatchTeam(teamBRaw)
  if (!a.name || !b.name) {
    console.warn(`  ! Match ${externalId} missing team names (a=${a.name}, b=${b.name}), skipping`)
    return null
  }
  const scheduled = extractScheduledAt(m)
  if (!scheduled) {
    console.warn(`  ! Match ${externalId} missing scheduled_at, skipping`)
    return null
  }
  const format = extractFormat(m)
  const status = getProp<string>(m, ['status']) || 'upcoming'
  const streamUrl = getProp<string>(m, ['stream', 'stream_url', 'streamUrl'])
  const scoreA = getProp<number>(teamARaw, ['score', 'result'])
  const scoreB = getProp<number>(teamBRaw, ['score', 'result'])

  const teamACached = a.hltvId ? teamCache.get(a.hltvId) : null
  const teamBCached = b.hltvId ? teamCache.get(b.hltvId) : null

  const id = `match-${externalId}`
  await pool.query(
    `INSERT INTO matches (
      id, external_source, external_id,
      event_external_id, event_name, game_id,
      scheduled_at, status, format,
      team_a_hltv_id, team_a_name, team_a_logo, team_a_score, team_a_roster,
      team_b_hltv_id, team_b_name, team_b_logo, team_b_score, team_b_roster,
      stream_url, raw, updated_at
    ) VALUES (
      $1, 'hltv', $2,
      $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11, $12, $13::jsonb,
      $14, $15, $16, $17, $18::jsonb,
      $19, $20::jsonb, NOW()
    )
    ON CONFLICT (external_source, external_id) DO UPDATE SET
      event_external_id = EXCLUDED.event_external_id,
      event_name = EXCLUDED.event_name,
      scheduled_at = EXCLUDED.scheduled_at,
      status = EXCLUDED.status,
      format = EXCLUDED.format,
      team_a_hltv_id = EXCLUDED.team_a_hltv_id,
      team_a_name = EXCLUDED.team_a_name,
      team_a_logo = COALESCE(EXCLUDED.team_a_logo, matches.team_a_logo),
      team_a_score = EXCLUDED.team_a_score,
      team_a_roster = COALESCE(EXCLUDED.team_a_roster, matches.team_a_roster),
      team_b_hltv_id = EXCLUDED.team_b_hltv_id,
      team_b_name = EXCLUDED.team_b_name,
      team_b_logo = COALESCE(EXCLUDED.team_b_logo, matches.team_b_logo),
      team_b_score = EXCLUDED.team_b_score,
      team_b_roster = COALESCE(EXCLUDED.team_b_roster, matches.team_b_roster),
      stream_url = EXCLUDED.stream_url,
      raw = EXCLUDED.raw,
      updated_at = NOW()`,
    [
      id, externalId,
      eventInfo.id, eventInfo.name, GAME_ID,
      scheduled.toISOString(), status, format,
      a.hltvId, a.name, a.logo || teamACached?.logo_url, scoreA,
      teamACached?.roster ? JSON.stringify(teamACached.roster) : null,
      b.hltvId, b.name, b.logo || teamBCached?.logo_url, scoreB,
      teamBCached?.roster ? JSON.stringify(teamBCached.roster) : null,
      streamUrl, JSON.stringify(m),
    ]
  )
  return id
}

async function main() {
  console.log(`Scraping HLTV event ${EVENT_ID} via ${RAPIDAPI_HOST}`)
  console.log(`Mode: ${PROBE ? 'PROBE' : 'FULL'} ${SKIP_TEAMS ? '(skip teams)' : ''}`)

  console.log('\n[1/3] Fetching upcoming matches...')
  const UPCOMING_PATH = process.env.HLTV_UPCOMING_PATH || '/api/v2/matches/upcoming'
  const upcoming = await rapid(UPCOMING_PATH)

  if (PROBE) {
    console.log('\n=== PROBE: Raw upcoming response (first 5000 chars) ===')
    console.log(JSON.stringify(upcoming, null, 2).slice(0, 5000))
    console.log('\n=== END PROBE ===')
    await pool.end()
    return
  }

  let matchesArr: any[] = []
  if (Array.isArray(upcoming)) matchesArr = upcoming
  else if (Array.isArray(upcoming?.matches)) matchesArr = upcoming.matches
  else if (Array.isArray(upcoming?.data)) matchesArr = upcoming.data
  else if (Array.isArray(upcoming?.results)) matchesArr = upcoming.results
  else {
    console.error('  ✗ Unexpected response shape. Run with --probe to inspect.')
    console.error('  Keys:', Object.keys(upcoming || {}))
    process.exit(1)
  }

  const eventMatches = matchesArr.filter((m) => matchBelongsToEvent(m, EVENT_ID))
  console.log(`  Found ${matchesArr.length} total matches, ${eventMatches.length} for event ${EVENT_ID}`)
  if (eventMatches.length === 0) {
    console.log('  No event matches in response. First match shape:')
    console.log(JSON.stringify(matchesArr[0], null, 2).slice(0, 2000))
    await pool.end()
    return
  }

  console.log('\n[2/3] Collecting team ids...')
  const teamIds = new Set<string>()
  for (const m of eventMatches) {
    const a = extractMatchTeam(getProp(m, ['team1', 'team_a', 'teamA', 'home']))
    const b = extractMatchTeam(getProp(m, ['team2', 'team_b', 'teamB', 'away']))
    if (a.hltvId) teamIds.add(a.hltvId)
    if (b.hltvId) teamIds.add(b.hltvId)
  }
  console.log(`  ${teamIds.size} unique teams`)

  const teamCache = new Map<string, any>()
  if (!SKIP_TEAMS) {
    console.log('\n[3/3] Fetching team rosters...')
    const teamIdList = Array.from(teamIds)
    for (let i = 0; i < teamIdList.length; i++) {
      const tid = teamIdList[i]
      const cached = FORCE ? null : await getCachedTeam(tid)
      if (cached) {
        console.log(`  [${i + 1}/${teamIdList.length}] team ${tid}: cached`)
        teamCache.set(tid, cached)
        continue
      }
      console.log(`  [${i + 1}/${teamIdList.length}] team ${tid}: fetching... (wait ~31min before next)`)
      try {
        const data = await rapid(`/api/v2/team/${tid}`)
        await cacheTeam(tid, data)
        const fresh = await getCachedTeam(tid)
        if (fresh) teamCache.set(tid, fresh)
      } catch (err) {
        console.error(`  ✗ Failed team ${tid}:`, (err as Error).message)
      }
      if (i < teamIdList.length - 1) {
        console.log(`  ... sleeping ${Math.round(RATE_LIMIT_MS / 60000)} min for rate limit`)
        await sleep(RATE_LIMIT_MS)
      }
    }
  } else {
    console.log('\n[3/3] Skipping team fetch (--skip-teams), loading cached only')
    for (const tid of teamIds) {
      const cached = await getCachedTeam(tid)
      if (cached) teamCache.set(tid, cached)
    }
  }

  console.log('\n[upsert] Writing matches...')
  let inserted = 0
  for (const m of eventMatches) {
    const info = extractEventInfo(m)
    if (!info.id) info.id = EVENT_ID
    const id = await upsertMatch(m, info, teamCache)
    if (id) {
      inserted++
      console.log(`  ✓ ${id}`)
    }
  }
  console.log(`\nDone. ${inserted}/${eventMatches.length} matches upserted.`)
  await pool.end()
}

main().catch((err) => {
  if (err instanceof RapidError && err.status === 429) {
    console.error('\nRate limit hit. Wait until the next hour boundary before retrying.')
    process.exit(2)
  }
  console.error('Fatal:', err)
  process.exit(1)
})
