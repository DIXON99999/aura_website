// Prediction ingester: backfill map-Elo ratings from history, write predictions
// for upcoming matches, and settle finished ones. Own pg pool (does NOT import
// the legacy db module, so the old app's initTables never runs here).
//
// Usage:
//   bun src/predict/ingest.ts                 # backfill + predict + settle
//   bun src/predict/ingest.ts --predict-only  # skip the (slow) history backfill
import pg from 'pg'
import {
  upcoming, pastPage, matchDetail, tier1Tournaments, upcomingForTournaments,
  type PSMatch, type PSTournament,
} from './pandascore.js'
import { applyMatch, type Ratings } from './elo.js'
import { CURRENT_MODEL } from './model.js'
import {
  pairKey, modelProb, recordH2H, isTier1, shouldShow, scoreOf, staleUpcomingIds, type H2HMap,
} from './logic.js'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const MODEL = CURRENT_MODEL.version
const MODEL_CONFIG = CURRENT_MODEL.config
const BACKFILL_PAGES = Number(process.env.BACKFILL_PAGES || 180)
const HISTORY_DAYS = Number(process.env.HISTORY_DAYS || 30)

/** Mark a prediction finished, grade it, and store the final score. */
async function settleMatch(m: PSMatch): Promise<number> {
  if (!m.winner_id) return 0
  const [r1, r2] = m.results || []
  const res = await pool.query(
    `UPDATE predictions SET status='finished', winner_id=$2,
       correct = ( (prob_a >= 0.5) = (team_a_id = $2) ),
       score_a = CASE WHEN team_a_id = $3::bigint THEN $4::int WHEN team_a_id = $5::bigint THEN $6::int END,
       score_b = CASE WHEN team_b_id = $3::bigint THEN $4::int WHEN team_b_id = $5::bigint THEN $6::int END,
       updated_at=NOW()
     WHERE match_id=$1 AND (status <> 'finished' OR score_a IS NULL)`,
    [m.id, m.winner_id, r1?.team_id ?? null, r1?.score ?? null, r2?.team_id ?? null, r2?.score ?? null]
  )
  return res.rowCount || 0
}

/** Store a finished match (predicted or not) for the history page. */
async function recordResult(m: PSMatch, replayProbA?: number): Promise<boolean> {
  if (m.status !== 'finished' || !m.winner_id || !shouldShow(m)) return false
  const opp = (m.opponents || []).map((o) => o.opponent).filter((o) => o?.id)
  if (opp.length !== 2) return false
  const [a, b] = opp as { id: number; name?: string; image_url?: string }[]
  await pool.query(
    `INSERT INTO results (
       match_id, name, finished_at, league, serie, tier, bo, forfeit,
       team_a_id, team_a_name, team_a_logo, team_b_id, team_b_name, team_b_logo,
       score_a, score_b, winner_id, replay_prob_a
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (match_id) DO UPDATE SET
       replay_prob_a=COALESCE(EXCLUDED.replay_prob_a, results.replay_prob_a),
       finished_at=EXCLUDED.finished_at, tier=EXCLUDED.tier, forfeit=EXCLUDED.forfeit,
       score_a=EXCLUDED.score_a, score_b=EXCLUDED.score_b, winner_id=EXCLUDED.winner_id,
       team_a_logo=EXCLUDED.team_a_logo, team_b_logo=EXCLUDED.team_b_logo`,
    [
      m.id, m.name, m.end_at || m.begin_at || m.scheduled_at, m.league?.name || null,
      m.serie?.full_name || null, m.tournament?.tier || null, m.number_of_games || null, !!m.forfeit,
      a.id, a.name || null, a.image_url || null, b.id, b.name || null, b.image_url || null,
      scoreOf(m, a.id), scoreOf(m, b.id), m.winner_id, replayProbA ?? null,
    ]
  )
  return true
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_ratings (
      team_id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      map_elo DOUBLE PRECISION NOT NULL,
      games INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  await pool.query(`ALTER TABLE team_ratings ADD COLUMN IF NOT EXISTS form_elo DOUBLE PRECISION`)
  await pool.query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS maps JSONB`)
  await pool.query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS team_a_logo TEXT`)
  await pool.query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS team_b_logo TEXT`)
  await pool.query(`ALTER TABLE team_ratings ADD COLUMN IF NOT EXISTS logo TEXT`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS h2h (
      pair_key TEXT PRIMARY KEY,
      lo_id BIGINT NOT NULL,
      hi_id BIGINT NOT NULL,
      lo_wins INTEGER NOT NULL DEFAULT 0,
      hi_wins INTEGER NOT NULL DEFAULT 0
    )`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      match_id BIGINT PRIMARY KEY,
      name TEXT,
      scheduled_at TIMESTAMPTZ,
      league TEXT,
      bo INTEGER,
      team_a_id BIGINT, team_a_name TEXT, team_a_elo DOUBLE PRECISION, team_a_games INTEGER,
      team_b_id BIGINT, team_b_name TEXT, team_b_elo DOUBLE PRECISION, team_b_games INTEGER,
      prob_a DOUBLE PRECISION,
      model_version TEXT,
      status TEXT,
      winner_id BIGINT,
      correct BOOLEAN,
      stream_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  await pool.query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS tier TEXT`)
  await pool.query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS serie TEXT`)
  await pool.query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS score_a INTEGER`)
  await pool.query(`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS score_b INTEGER`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS results (
      match_id BIGINT PRIMARY KEY,
      name TEXT,
      finished_at TIMESTAMPTZ,
      league TEXT,
      serie TEXT,
      tier TEXT,
      bo INTEGER,
      forfeit BOOLEAN NOT NULL DEFAULT FALSE,
      team_a_id BIGINT, team_a_name TEXT, team_a_logo TEXT,
      team_b_id BIGINT, team_b_name TEXT, team_b_logo TEXT,
      score_a INTEGER, score_b INTEGER,
      winner_id BIGINT
    )`)
  await pool.query(`CREATE INDEX IF NOT EXISTS results_finished_at_idx ON results (finished_at DESC)`)
  await pool.query(`ALTER TABLE results ADD COLUMN IF NOT EXISTS replay_prob_a DOUBLE PRECISION`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tier1_events (
      serie_id BIGINT PRIMARY KEY,
      league TEXT, serie TEXT, tier TEXT, region TEXT, prizepool TEXT,
      begin_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
      stages JSONB, teams JSONB,
      live BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}

async function loadRatings(): Promise<Ratings> {
  const r: Ratings = new Map()
  const res = await pool.query('SELECT team_id, name, map_elo, form_elo, games FROM team_ratings')
  for (const row of res.rows)
    r.set(Number(row.team_id), {
      elo: row.map_elo,
      formElo: row.form_elo ?? row.map_elo,
      games: row.games,
      name: row.name,
    })
  return r
}

async function loadH2H(): Promise<H2HMap> {
  const m: H2HMap = new Map()
  const res = await pool.query('SELECT pair_key, lo_id, hi_id, lo_wins, hi_wins FROM h2h')
  for (const row of res.rows)
    m.set(row.pair_key, {
      loId: Number(row.lo_id), hiId: Number(row.hi_id),
      loWins: row.lo_wins, hiWins: row.hi_wins,
    })
  return m
}

async function saveRatings(r: Ratings) {
  const entries = [...r.entries()]
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500)
    const vals: any[] = []
    const rows = chunk.map(([id, v], j) => {
      const o = j * 5
      vals.push(id, v.name, v.elo, v.formElo, v.games)
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, NOW())`
    })
    await pool.query(
      `INSERT INTO team_ratings (team_id, name, map_elo, form_elo, games, updated_at) VALUES ${rows.join(',')}
       ON CONFLICT (team_id) DO UPDATE SET name=EXCLUDED.name, map_elo=EXCLUDED.map_elo,
         form_elo=EXCLUDED.form_elo, games=EXCLUDED.games, updated_at=NOW()`,
      vals
    )
  }
}

async function saveH2H(h: H2HMap) {
  const entries = [...h.values()]
  for (let i = 0; i < entries.length; i += 400) {
    const chunk = entries.slice(i, i + 400)
    const vals: any[] = []
    const rows = chunk.map((e, j) => {
      const o = j * 5
      vals.push(pairKey(e.loId, e.hiId), e.loId, e.hiId, e.loWins, e.hiWins)
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`
    })
    await pool.query(
      `INSERT INTO h2h (pair_key, lo_id, hi_id, lo_wins, hi_wins) VALUES ${rows.join(',')}
       ON CONFLICT (pair_key) DO UPDATE SET lo_wins=EXCLUDED.lo_wins, hi_wins=EXCLUDED.hi_wins`,
      vals
    )
  }
}

async function backfill(): Promise<Ratings> {
  console.log(`[backfill] fetching ${BACKFILL_PAGES} pages of history...`)
  // most-recent-first pages, then sort chronologically to apply Elo in order
  const all: PSMatch[] = []
  for (let p = 1; p <= BACKFILL_PAGES; p++) {
    const batch = await pastPage(p)
    all.push(...batch)
    if (batch.length < 100) break
    if (p % 20 === 0) console.log(`  page ${p} (${all.length})`)
    await new Promise((r) => setTimeout(r, 1100))
  }
  all.sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))
  console.log(`[backfill] applying ${all.length} matches...`)
  const r: Ratings = new Map()
  const h2h: H2HMap = new Map()
  const logos = new Map<number, string>()
  // Walk-forward "replay" picks for the history page: the model's probability
  // for each recent match computed from ratings + H2H *before* that match is
  // applied — i.e. only information available pre-match.
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString()
  const replay = new Map<number, number>() // match id -> P(opponents[0] wins)
  for (const m of all) {
    if (m.winner_id && (m.scheduled_at || '') >= since && shouldShow(m)) {
      const p = modelProb(r, h2h, m, MODEL_CONFIG)
      if (p) replay.set(m.id, p.probA)
    }
    applyMatch(r, m, MODEL_CONFIG)
    for (const o of m.opponents || []) if (o.opponent?.id && o.opponent.image_url) logos.set(o.opponent.id, o.opponent.image_url)
    recordH2H(h2h, m)
  }
  await saveRatings(r)
  await saveH2H(h2h)
  // persist logos for the rankings page
  for (const [id, url] of logos) await pool.query('UPDATE team_ratings SET logo=$2 WHERE team_id=$1', [id, url])

  // settle any predictions whose result now appears in history, and record the
  // last HISTORY_DAYS of finished matches for the history page
  let settled = 0
  let recorded = 0
  for (const m of all) {
    settled += await settleMatch(m)
    if ((m.scheduled_at || '') >= since && (await recordResult(m, replay.get(m.id)))) recorded++
  }
  console.log(`[backfill] ${r.size} teams rated, ${settled} predictions settled, ${recorded} results recorded`)
  return r
}

function streamOf(m: PSMatch): string | null {
  const s = (m.streams_list || []).find((x) => x.main) || (m.streams_list || [])[0]
  return s?.raw_url || null
}

/** Refresh the tier-1 events list (running + upcoming S/A tournaments, grouped
 *  by serie — a Major's stages become one event). Returns tournament ids whose
 *  matches should be pulled even if they're beyond the generic upcoming page. */
async function refreshEvents(): Promise<number[]> {
  const running = await tier1Tournaments('running')
  await sleep(1100)
  const upcomingTs = await tier1Tournaments('upcoming')
  const all = [...running, ...upcomingTs]
  const bySerie = new Map<number, PSTournament[]>()
  for (const t of all) bySerie.set(t.serie_id, [...(bySerie.get(t.serie_id) || []), t])

  for (const [serieId, ts] of bySerie) {
    ts.sort((a, b) => (a.begin_at || '').localeCompare(b.begin_at || ''))
    const teams = new Map<number, { name: string; logo: string | null }>()
    for (const t of ts) for (const tm of t.teams || []) teams.set(tm.id, { name: tm.name, logo: tm.image_url || null })
    const first = ts[0]
    const begin = ts.map((t) => t.begin_at).filter(Boolean).sort()[0] || null
    const end = ts.map((t) => t.end_at).filter(Boolean).sort().at(-1) || null
    await pool.query(
      `INSERT INTO tier1_events (serie_id, league, serie, tier, region, prizepool, begin_at, end_at, stages, teams, live, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (serie_id) DO UPDATE SET league=EXCLUDED.league, serie=EXCLUDED.serie, tier=EXCLUDED.tier,
         region=EXCLUDED.region, prizepool=EXCLUDED.prizepool, begin_at=EXCLUDED.begin_at, end_at=EXCLUDED.end_at,
         stages=EXCLUDED.stages, teams=EXCLUDED.teams, live=EXCLUDED.live, updated_at=NOW()`,
      [
        serieId, first.league?.name || null, first.serie?.full_name || null, first.tier,
        first.region, ts.map((t) => t.prizepool).find(Boolean) || null, begin, end,
        JSON.stringify(ts.map((t) => ({ name: t.name, beginAt: t.begin_at, endAt: t.end_at }))),
        JSON.stringify([...teams.values()]),
        ts.some((t) => running.includes(t)),
      ]
    )
  }
  await pool.query(`DELETE FROM tier1_events WHERE NOT (serie_id = ANY($1::bigint[]))`, [[...bySerie.keys()]])
  console.log(`[events] ${bySerie.size} tier-1 events (${running.length} running / ${upcomingTs.length} upcoming tournaments)`)
  return all.map((t) => t.id)
}

async function predictUpcoming(r: Ratings) {
  // generic soonest-100 page + every scheduled match of a tier-1 tournament
  // (big events are often further out than the generic page reaches)
  const tier1Ids = await refreshEvents()
  await sleep(1100)
  const [generic, tier1] = [await upcoming(100), await upcomingForTournaments(tier1Ids)]
  const ms = [...new Map([...generic, ...tier1].map((m) => [m.id, m])).values()]
  const h2h = await loadH2H()
  let n = 0
  let tbd = 0
  let skipped = 0
  const written: number[] = []
  for (const m of ms) {
    if (!shouldShow(m)) { skipped++; continue }
    const logoOf = (id: number) => (m.opponents || []).find((o) => o.opponent?.id === id)?.opponent?.image_url || null
    const p = modelProb(r, h2h, m, MODEL_CONFIG)
    if (!p) {
      // teams not decided yet — keep tier-1 placeholders ("TBD vs TBD")
      if (!isTier1(m)) continue
      const known = (m.opponents || []).map((o) => o.opponent).filter((o) => o?.id) as { id: number; name?: string; image_url?: string }[]
      const [a, b] = known
      await pool.query(
        `INSERT INTO predictions (
           match_id, name, scheduled_at, league, bo, team_a_id, team_a_name, team_a_logo,
           team_b_id, team_b_name, team_b_logo, prob_a, model_version, status, stream_url, tier, serie, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,$12,'upcoming',$13,$14,$15,NOW())
         ON CONFLICT (match_id) DO UPDATE SET
           name=EXCLUDED.name, scheduled_at=EXCLUDED.scheduled_at, bo=EXCLUDED.bo,
           team_a_id=EXCLUDED.team_a_id, team_a_name=EXCLUDED.team_a_name, team_a_logo=EXCLUDED.team_a_logo,
           team_b_id=EXCLUDED.team_b_id, team_b_name=EXCLUDED.team_b_name, team_b_logo=EXCLUDED.team_b_logo,
           team_a_elo=NULL, team_b_elo=NULL, prob_a=NULL, stream_url=EXCLUDED.stream_url, updated_at=NOW()
         WHERE predictions.status <> 'finished'`,
        [
          m.id, m.name, m.scheduled_at, m.league?.name || null, m.number_of_games || 1,
          a?.id ?? null, a?.name ?? null, a?.image_url ?? null,
          b?.id ?? null, b?.name ?? null, b?.image_url ?? null,
          MODEL, streamOf(m), m.tournament?.tier || null, m.serie?.full_name || null,
        ]
      )
      written.push(m.id)
      tbd++
      continue
    }
    await pool.query(
      `INSERT INTO predictions (
         match_id, name, scheduled_at, league, bo,
         team_a_id, team_a_name, team_a_elo, team_a_games,
         team_b_id, team_b_name, team_b_elo, team_b_games,
         prob_a, model_version, status, stream_url, team_a_logo, team_b_logo, tier, serie, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'upcoming',$16,$17,$18,$19,$20,NOW())
       ON CONFLICT (match_id) DO UPDATE SET
         name=EXCLUDED.name, scheduled_at=EXCLUDED.scheduled_at, bo=EXCLUDED.bo, tier=EXCLUDED.tier, serie=EXCLUDED.serie,
         team_a_id=EXCLUDED.team_a_id, team_a_name=EXCLUDED.team_a_name,
         team_b_id=EXCLUDED.team_b_id, team_b_name=EXCLUDED.team_b_name,
         team_a_elo=EXCLUDED.team_a_elo, team_a_games=EXCLUDED.team_a_games,
         team_b_elo=EXCLUDED.team_b_elo, team_b_games=EXCLUDED.team_b_games,
         prob_a=EXCLUDED.prob_a, model_version=EXCLUDED.model_version,
         stream_url=EXCLUDED.stream_url, team_a_logo=EXCLUDED.team_a_logo,
         team_b_logo=EXCLUDED.team_b_logo, updated_at=NOW()
       WHERE predictions.status <> 'finished'`,
      [
        m.id, m.name, m.scheduled_at, m.league?.name || null, p.bo,
        p.teamA.id, p.teamA.name, p.teamA.elo, p.teamA.games,
        p.teamB.id, p.teamB.name, p.teamB.elo, p.teamB.games,
        p.probA, MODEL, streamOf(m), logoOf(p.teamA.id), logoOf(p.teamB.id), m.tournament?.tier || null,
        m.serie?.full_name || null,
      ]
    )
    written.push(m.id)
    n++
  }
  // Drop future-dated upcoming rows that fell out of the feed; live rows stay
  // so settleRecent can grade them (the rule lives in logic.staleUpcomingIds).
  const stored = (await pool.query(
    `SELECT match_id, scheduled_at FROM predictions WHERE status='upcoming'`
  )).rows.map((r) => ({ matchId: Number(r.match_id), scheduledAt: r.scheduled_at }))
  const stale = staleUpcomingIds(stored, written)
  if (stale.length) await pool.query(`DELETE FROM predictions WHERE match_id = ANY($1::bigint[])`, [stale])
  console.log(`[predict] wrote ${n} upcoming predictions + ${tbd} TBD placeholders (skipped ${skipped} no-name matchups)`)

  // show the soonest 12
  const rows = (await pool.query(
    `SELECT scheduled_at, league, team_a_name, team_b_name, prob_a, bo, team_a_games, team_b_games
     FROM predictions WHERE status='upcoming' AND prob_a IS NOT NULL ORDER BY scheduled_at ASC LIMIT 12`
  )).rows
  console.log('\nNext matches:')
  for (const r of rows) {
    const pa = Math.round(r.prob_a * 100)
    const fav = pa >= 50 ? r.team_a_name : r.team_b_name
    const favPct = Math.max(pa, 100 - pa)
    const warm = Math.min(r.team_a_games, r.team_b_games) >= 5 ? '' : '  (cold)'
    console.log(`  ${String(r.scheduled_at).slice(0, 16)}  bo${r.bo}  ${r.team_a_name} vs ${r.team_b_name}  →  ${fav} ${favPct}%${warm}`)
  }
}

/** Settle finished matches from the last couple of result pages (cheap — no
 *  rating recompute; ratings refresh on the full backfill). Returns #settled. */
export async function settleRecent(pages = 2): Promise<number> {
  let settled = 0
  for (let p = 1; p <= pages; p++) {
    const batch = await pastPage(p)
    for (const m of batch) {
      settled += await settleMatch(m)
      await recordResult(m)
    }
    if (batch.length < 100) break
    await sleep(1100)
  }
  if (settled) console.log(`[settle] ${settled} predictions settled`)
  return settled
}

/** Harvest the maps actually played/picked for current upcoming matches — this
 *  fills in near match time (veto). Best-effort; builds a map dataset for v3. */
export async function captureMaps(): Promise<number> {
  const rows = (await pool.query(`SELECT match_id FROM predictions WHERE status='upcoming'`)).rows
  let got = 0
  for (const { match_id } of rows) {
    try {
      const m = await matchDetail(Number(match_id))
      const maps = (m.games || [])
        .map((g: any) => (typeof g.map === 'string' ? g.map : g.map?.name))
        .filter(Boolean)
      if (maps.length) {
        await pool.query(`UPDATE predictions SET maps=$2 WHERE match_id=$1`, [match_id, JSON.stringify(maps)])
        got++
      }
    } catch { /* detail not ready / rate limited — skip, try next cycle */ }
    await sleep(1100)
  }
  if (got) console.log(`[maps] captured maps for ${got} matches`)
  return got
}

/** Full run: rebuild ratings + H2H from history, then predict + capture maps. */
export async function runBackfill(): Promise<void> {
  await ensureTables()
  const r = await backfill()
  if (r.size === 0) throw new Error('backfill produced no ratings')
  await predictUpcoming(r)
  await captureMaps()
}

/** Light run (for the scheduler every ~30m): predict + settle + capture maps.
 *  Falls back to a full backfill if the ratings table is empty. */
export async function runRefresh(): Promise<void> {
  await ensureTables()
  const r = await loadRatings()
  if (r.size === 0) return runBackfill()
  await predictUpcoming(r)
  // first run with an empty history table: pull a deeper slice so the
  // history page isn't empty until the next 12h backfill
  const hasHistory = (await pool.query('SELECT 1 FROM results LIMIT 1')).rowCount
  await settleRecent(hasHistory ? 2 : 15)
  await captureMaps()
}

async function main() {
  const predictOnly = process.argv.includes('--predict-only')
  if (predictOnly) await runRefresh()
  else await runBackfill()
  await pool.end()
}

if (import.meta.main) main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
