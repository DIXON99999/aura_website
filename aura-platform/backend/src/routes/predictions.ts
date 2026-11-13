import { Hono } from 'hono'
import { pool } from '../db/index.js'

const app = new Hono()

// Upcoming matches with model predictions (served from DB, never the live API).
app.get('/upcoming', async (c) => {
  const rows = (await pool.query(
    `SELECT match_id, name, scheduled_at, league, bo,
            team_a_id, team_a_name, team_a_elo, team_a_games, team_a_logo,
            team_b_id, team_b_name, team_b_elo, team_b_games, team_b_logo,
            prob_a, model_version, stream_url, maps
     FROM predictions
     WHERE status = 'upcoming' AND scheduled_at > NOW() - INTERVAL '3 hours'
     ORDER BY scheduled_at ASC
     LIMIT 100`
  )).rows
  return c.json(rows.map((r) => ({
    matchId: String(r.match_id),
    name: r.name,
    scheduledAt: r.scheduled_at,
    league: r.league,
    bo: r.bo,
    streamUrl: r.stream_url,
    model: r.model_version,
    maps: r.maps || null,
    teamA: { id: String(r.team_a_id), name: r.team_a_name, elo: Math.round(r.team_a_elo), games: r.team_a_games, logo: r.team_a_logo || null },
    teamB: { id: String(r.team_b_id), name: r.team_b_name, elo: Math.round(r.team_b_elo), games: r.team_b_games, logo: r.team_b_logo || null },
    probA: r.prob_a,
    probB: 1 - r.prob_a,
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

// Current team power rankings by map-Elo.
app.get('/rankings', async (c) => {
  const rows = (await pool.query(
    `SELECT team_id, name, map_elo, games, logo FROM team_ratings
     WHERE games >= 20 ORDER BY map_elo DESC LIMIT 50`
  )).rows
  return c.json(rows.map((r, i) => ({
    rank: i + 1, id: String(r.team_id), name: r.name,
    elo: Math.round(r.map_elo), games: r.games, logo: r.logo || null,
  })))
})

export default app
