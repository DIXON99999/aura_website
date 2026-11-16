import { Hono } from 'hono'
import { pool } from '../db/index.js'
import { orientProbA, explainPrediction, formString, pairKey, type H2HMap } from '../predict/logic.js'
import { CURRENT_MODEL, MODELS } from '../predict/model.js'
import { START, type Ratings } from '../predict/elo.js'
import type { PSMatch } from '../predict/pandascore.js'

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
  // live results per model version (Brier = mean squared error of P(team A))
  const byModel = (await pool.query(
    `SELECT model_version, COUNT(*)::int AS n,
            SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int AS hits,
            AVG(POWER(prob_a - CASE WHEN winner_id = team_a_id THEN 1 ELSE 0 END, 2)) AS brier
     FROM predictions WHERE status = 'finished' AND correct IS NOT NULL
     GROUP BY model_version ORDER BY MIN(created_at)`
  )).rows
  return c.json({
    total: overall.n,
    correct: overall.hits,
    accuracy: overall.n ? overall.hits / overall.n : null,
    calibration: buckets.map((r) => ({
      n: r.n, predicted: Number(r.predicted), actual: Number(r.actual),
    })),
    byModel: byModel.map((r) => ({
      version: r.model_version, n: r.n, accuracy: r.n ? r.hits / r.n : null, brier: Number(r.brier),
    })),
    // walk-forward backtest scores for each model version (see predict/model.ts)
    currentModel: CURRENT_MODEL.version,
    backtests: MODELS.map((m) => ({ version: m.version, summary: m.summary, ...m.backtest })),
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

// ── Match detail ─────────────────────────────────────────────────────────────
const RECENT = 10
const TREND = 30

/** A match_log row seen from `teamId`'s side. */
function fromSide(row: any, teamId: string) {
  const isA = String(row.team_a_id) === teamId
  return {
    matchId: String(row.match_id),
    playedAt: row.played_at,
    opponent: {
      id: String(isA ? row.team_b_id : row.team_a_id),
      name: isA ? row.team_b_name : row.team_a_name,
      logo: (isA ? row.team_b_logo : row.team_a_logo) || null,
    },
    won: String(row.winner_id) === teamId,
    score: [isA ? row.score_a : row.score_b, isA ? row.score_b : row.score_a] as [number | null, number | null],
    event: [row.league, row.serie].filter(Boolean).join(' · ') || null,
    forfeit: !!row.forfeit,
    eloAfter: isA ? row.elo_a_after : row.elo_b_after,
  }
}

async function teamDetail(teamId: string, fallback: { name: string | null; logo: string | null }, excludeMatch: number) {
  const rating = (await pool.query(`SELECT name, map_elo, games, logo FROM team_ratings WHERE team_id=$1`, [teamId])).rows[0]
  const rank = rating && rating.games >= 20
    ? (await pool.query(`SELECT COUNT(*)::int + 1 AS rank FROM team_ratings WHERE games >= 20 AND map_elo > $1`, [rating.map_elo])).rows[0].rank
    : null
  const log = (await pool.query(
    `SELECT * FROM match_log WHERE (team_a_id=$1 OR team_b_id=$1) AND match_id <> $2
     ORDER BY played_at DESC LIMIT $3`,
    [teamId, excludeMatch, TREND]
  )).rows.map((row) => fromSide(row, teamId))
  const recent = log.slice(0, RECENT)
  return {
    id: teamId,
    name: rating?.name ?? fallback.name,
    logo: fallback.logo ?? rating?.logo ?? null,
    elo: rating ? Math.round(rating.map_elo) : null,
    games: rating?.games ?? 0,
    rank,
    form: formString(recent.map((x) => ({ winnerId: x.won ? teamId : x.opponent.id })), teamId),
    recent: recent.map(({ eloAfter: _e, ...x }) => x),
    // oldest → newest, rating after each match (forfeits don't move ratings)
    eloTrend: log.filter((x) => x.eloAfter != null && !x.forfeit).reverse().map((x) => ({ t: x.playedAt, elo: Math.round(x.eloAfter) })),
  }
}

app.get('/match/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isSafeInteger(id)) return c.json({ error: 'not found' }, 404)
  const [p, res, log] = await Promise.all([
    pool.query(`SELECT * FROM predictions WHERE match_id=$1`, [id]),
    pool.query(`SELECT * FROM results WHERE match_id=$1`, [id]),
    pool.query(`SELECT * FROM match_log WHERE match_id=$1`, [id]).catch(() => ({ rows: [] as any[] })),
  ]).then((rs) => rs.map((r) => r.rows[0]))
  if (!p && !res && !log) return c.json({ error: 'not found' }, 404)

  // header team order: the prediction's if there is one, else the result's
  const src = p ?? res ?? log
  const aId = src.team_a_id != null ? String(src.team_a_id) : null
  const bId = src.team_b_id != null ? String(src.team_b_id) : null
  const done = res ?? log
  const finished = !!done || p?.status === 'finished'
  // scores from the finished row, re-oriented to the header order
  let score: [number | null, number | null] | null = null
  if (done) {
    const same = String(done.team_a_id) === aId
    score = same ? [done.score_a, done.score_b] : [done.score_b, done.score_a]
  }
  const live = orientProbA(p?.prob_a, p?.team_a_id, aId)
  const replay = res ? orientProbA(res.replay_prob_a, res.team_a_id, aId) : null
  const probA = live ?? replay
  const winnerId = done?.winner_id != null ? String(done.winner_id) : p?.winner_id != null ? String(p.winner_id) : null

  const [teamA, teamB] = await Promise.all([
    aId ? teamDetail(aId, { name: src.team_a_name, logo: src.team_a_logo }, id) : null,
    bId ? teamDetail(bId, { name: src.team_b_name, logo: src.team_b_logo }, id) : null,
  ])

  // head-to-head from the match log (all meetings, newest first)
  let h2h = null
  if (aId && bId) {
    const rows = (await pool.query(
      `SELECT * FROM match_log WHERE ((team_a_id=$1 AND team_b_id=$2) OR (team_a_id=$2 AND team_b_id=$1)) AND match_id <> $3
       ORDER BY played_at DESC`,
      [aId, bId, id]
    )).rows.map((row) => fromSide(row, aId))
    h2h = {
      aWins: rows.filter((x) => x.won).length,
      bWins: rows.filter((x) => !x.won).length,
      meetings: rows.slice(0, RECENT).map(({ eloAfter: _e, opponent: _o, ...x }) => x),
    }
  }

  // "why this prediction" — only for matches still to be played, from current ratings
  let explain = null
  if (!finished && aId && bId) {
    const r: Ratings = new Map()
    for (const row of (await pool.query(`SELECT team_id, name, map_elo, form_elo, games FROM team_ratings WHERE team_id = ANY($1::bigint[])`, [[aId, bId]])).rows)
      r.set(Number(row.team_id), { elo: row.map_elo, formElo: row.form_elo ?? row.map_elo, games: row.games, name: row.name })
    const h: H2HMap = new Map()
    const hr = (await pool.query(`SELECT lo_id, hi_id, lo_wins, hi_wins FROM h2h WHERE pair_key=$1`, [pairKey(Number(aId), Number(bId))])).rows[0]
    if (hr) h.set(pairKey(Number(aId), Number(bId)), { loId: Number(hr.lo_id), hiId: Number(hr.hi_id), loWins: hr.lo_wins, hiWins: hr.hi_wins })
    const stub = {
      id, name: src.name, status: 'not_started', winner_id: null, begin_at: null,
      scheduled_at: p?.scheduled_at ? new Date(p.scheduled_at).toISOString() : null,
      number_of_games: p?.bo ?? 1,
      opponents: [
        { type: 'Team', opponent: { id: Number(aId), name: src.team_a_name } },
        { type: 'Team', opponent: { id: Number(bId), name: src.team_b_name } },
      ],
    } as PSMatch
    explain = explainPrediction(r, h, stub, CURRENT_MODEL.config)
  }

  return c.json({
    matchId: String(id),
    name: src.name,
    league: src.league ?? null,
    serie: src.serie ?? null,
    tier: src.tier ?? null,
    bo: p?.bo ?? done?.bo ?? null,
    scheduledAt: p?.scheduled_at ?? res?.finished_at ?? log?.played_at ?? null,
    status: finished ? 'finished' : 'upcoming',
    streamUrl: p?.stream_url ?? null,
    score,
    winnerId,
    forfeit: !!res?.forfeit,
    probA,
    pickSource: live != null ? 'live' : replay != null ? 'replay' : null,
    model: p?.model_version ?? (replay != null ? CURRENT_MODEL.version : null),
    correct: probA == null || !winnerId || !aId ? null : (probA >= 0.5) === (winnerId === aId),
    teamA, teamB, h2h, explain,
    startElo: START,
  })
})

export default app
