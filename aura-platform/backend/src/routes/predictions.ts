import { Hono } from 'hono'
import { pool } from '../db/index.js'
import { orientProbA } from '../predict/logic.js'

const app = new Hono()

// Tier 1 = PandaScore tournament tier S or A (keep in sync with ingest.ts).
function tierClause(tier: string | undefined, col = 'tier'): string {
  const isTier1 = `LOWER(COALESCE(${col}, '')) IN ('s', 'a')`
  if (tier === 'tier1') return `AND ${isTier1}`
  if (tier === 'other') return `AND NOT ${isTier1}`
  return ''
}

// Upcoming matches with model predictions (served from DB, never the live API).
// ?tier=tier1|other filters by tournament tier.
app.get('/upcoming', async (c) => {
  const rows = (await pool.query(
    `SELECT match_id, name, scheduled_at, league, serie, bo, tier,
            team_a_id, team_a_name, team_a_elo, team_a_games, team_a_logo,
            team_b_id, team_b_name, team_b_elo, team_b_games, team_b_logo,
            prob_a, model_version, stream_url, maps
     FROM predictions
     WHERE status = 'upcoming' AND scheduled_at > NOW() - INTERVAL '3 hours'
       ${tierClause(c.req.query('tier'))}
     ORDER BY scheduled_at ASC
     LIMIT 100`
  )).rows
  return c.json(rows.map((r) => ({
    matchId: String(r.match_id),
    name: r.name,
    scheduledAt: r.scheduled_at,
    league: r.league,
    serie: r.serie || null,
    bo: r.bo,
    tier: r.tier || null,
    streamUrl: r.stream_url,
    model: r.model_version,
    maps: r.maps || null,
    // team is null while still to be determined; prob is null until both are known
    teamA: teamOf(r, 'a'),
    teamB: teamOf(r, 'b'),
    probA: r.prob_a ?? null,
    probB: r.prob_a == null ? null : 1 - r.prob_a,
  })))
})

function teamOf(r: any, side: 'a' | 'b') {
  const id = r[`team_${side}_id`]
  if (id == null) return null
  const elo = r[`team_${side}_elo`]
  return {
    id: String(id), name: r[`team_${side}_name`], logo: r[`team_${side}_logo`] || null,
    elo: elo == null ? null : Math.round(elo), games: r[`team_${side}_games`] ?? 0,
  }
}

// Running + upcoming tier-1 events (one per serie), soonest first.
app.get('/events', async (c) => {
  const rows = (await pool.query(
    `SELECT * FROM tier1_events WHERE end_at IS NULL OR end_at > NOW() - INTERVAL '1 day'
     ORDER BY live DESC, begin_at ASC NULLS LAST LIMIT 12`
  ).catch(() => ({ rows: [] as any[] }))).rows // table appears after the first refresh
  return c.json(rows.map((r) => ({
    id: String(r.serie_id),
    league: r.league, serie: r.serie, tier: r.tier, region: r.region, prizepool: r.prizepool,
    beginAt: r.begin_at, endAt: r.end_at, live: r.live,
    stages: r.stages || [], teams: r.teams || [],
  })))
})

// Model accuracy over settled predictions — the public trust page.
app.get('/accuracy', async (c) => {
  const overall = (await pool.query(
    `SELECT COUNT(*)::int AS n,
            SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int AS hits
     FROM predictions WHERE status = 'finished' AND correct IS NOT NULL`
  )).rows[0]
  // calibration: predicted-confidence bucket vs realised hit-rate
  const buckets = (await pool.query(
    `SELECT width_bucket(GREATEST(prob_a, 1 - prob_a), 0.5, 1.0, 5) AS b,
            COUNT(*)::int AS n,
            AVG(GREATEST(prob_a, 1 - prob_a)) AS predicted,
            AVG(CASE WHEN correct THEN 1.0 ELSE 0.0 END) AS actual
     FROM predictions WHERE status = 'finished' AND correct IS NOT NULL
     GROUP BY b ORDER BY b`
  )).rows
  return c.json({
    total: overall.n,
    correct: overall.hits,
    accuracy: overall.n ? overall.hits / overall.n : null,
    calibration: buckets.map((r) => ({
      n: r.n, predicted: Number(r.predicted), actual: Number(r.actual),
    })),
  })
})

// Finished matches with final score, plus what the model said beforehand when
// it priced the match. ?tier=tier1|other, ?limit (max 200).
app.get('/history', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 200)
  const rows = (await pool.query(
    `SELECT r.*, p.prob_a, p.team_a_id AS p_team_a_id
     FROM results r
     LEFT JOIN predictions p ON p.match_id = r.match_id
     WHERE TRUE ${tierClause(c.req.query('tier'), 'r.tier')}
     ORDER BY r.finished_at DESC NULLS LAST
     LIMIT $1`,
    [limit]
  )).rows
  return c.json(rows.map((r) => {
    // Prefer the live pre-match prediction (oriented to this row's team A);
    // fall back to the walk-forward replay pick computed during backfill.
    const live = orientProbA(r.prob_a, r.p_team_a_id, r.team_a_id)
    const probA: number | null = live ?? r.replay_prob_a ?? null
    const pickSource = live != null ? 'live' : r.replay_prob_a != null ? 'replay' : null
    const winnerA = String(r.winner_id) === String(r.team_a_id)
    return {
      matchId: String(r.match_id),
      name: r.name,
      finishedAt: r.finished_at,
      league: r.league,
      serie: r.serie,
      tier: r.tier || null,
      bo: r.bo,
      forfeit: r.forfeit,
      teamA: { id: String(r.team_a_id), name: r.team_a_name, logo: r.team_a_logo || null, score: r.score_a },
      teamB: { id: String(r.team_b_id), name: r.team_b_name, logo: r.team_b_logo || null, score: r.score_b },
      winnerId: String(r.winner_id),
      probA,
      pickSource,
      correct: probA == null ? null : (probA >= 0.5) === winnerA,
    }
  }))
})

export default app
