import { Hono } from 'hono'
import { pool } from '../db/index.js'
import type { DbVote, DbPlayer, DbRegion } from '../db/index.js'

const VOTE_VALUE = 1
const AURA_PROPAGATION_FACTOR = 0.1
const DEFAULT_UPVOTES = 20
const DEFAULT_DOWNVOTES = 10

async function initVotesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_credits (
      visitor_id TEXT PRIMARY KEY,
      upvotes_remaining INTEGER NOT NULL DEFAULT ${DEFAULT_UPVOTES},
      downvotes_remaining INTEGER NOT NULL DEFAULT ${DEFAULT_DOWNVOTES}
    )
  `)
}

initVotesTable().catch(console.error)

interface DbVisitorCredits {
  visitor_id: string
  upvotes_remaining: number
  downvotes_remaining: number
}

async function getOrCreateCredits(visitorId: string): Promise<DbVisitorCredits> {
  const result = await pool.query('SELECT * FROM visitor_credits WHERE visitor_id = $1', [visitorId])
  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO visitor_credits (visitor_id, upvotes_remaining, downvotes_remaining) VALUES ($1, $2, $3)',
      [visitorId, DEFAULT_UPVOTES, DEFAULT_DOWNVOTES]
    )
    return { visitor_id: visitorId, upvotes_remaining: DEFAULT_UPVOTES, downvotes_remaining: DEFAULT_DOWNVOTES }
  }
  return result.rows[0] as DbVisitorCredits
}

const app = new Hono()

function getTableName(entityType: string): string {
  const map: Record<string, string> = {
    country: 'countries',
    game: 'games',
    region: 'regions',
    organisation: 'organisations',
    organisationGame: 'organisation_games',
    brand: 'brands',
    peripheral: 'peripherals',
    role: 'roles',
    weapon: 'weapons',
    character: 'characters',
    player: 'players',
  }
  return map[entityType] || entityType
}

async function getParentEntities(entityType: string, entityId: string): Promise<Array<{ type: string; id: string }>> {
  const parents: Array<{ type: string; id: string }> = []

  if (entityType === 'player') {
    const result = await pool.query('SELECT * FROM players WHERE id = $1', [entityId])
    if (result.rows.length > 0) {
      const player = result.rows[0] as DbPlayer
      if (player.organisation_id) parents.push({ type: 'organisation', id: player.organisation_id })
      if (player.country_id) parents.push({ type: 'country', id: player.country_id })
      if (player.region_id) parents.push({ type: 'region', id: player.region_id })
      if (player.main_game_id) parents.push({ type: 'game', id: player.main_game_id })
    }
  } else if (entityType === 'organisationGame') {
    const result = await pool.query('SELECT * FROM organisation_games WHERE id = $1', [entityId])
    if (result.rows.length > 0) {
      const row = result.rows[0] as { organisation_id: string; game_id: string }
      parents.push({ type: 'organisation', id: row.organisation_id })
      parents.push({ type: 'game', id: row.game_id })
    }
  } else if (entityType === 'region') {
    const result = await pool.query('SELECT * FROM regions WHERE id = $1', [entityId])
    if (result.rows.length > 0) {
      const region = result.rows[0] as DbRegion
      parents.push({ type: 'game', id: region.game_id })
    }
  } else if (['role', 'weapon', 'character'].includes(entityType)) {
    const table = getTableName(entityType)
    const result = await pool.query(`SELECT game_id FROM ${table} WHERE id = $1`, [entityId])
    if (result.rows.length > 0) {
      const row = result.rows[0] as { game_id: string }
      parents.push({ type: 'game', id: row.game_id })
    }
  } else if (entityType === 'peripheral') {
    const result = await pool.query('SELECT brand_id FROM peripherals WHERE id = $1', [entityId])
    if (result.rows.length > 0) {
      const row = result.rows[0] as { brand_id: string }
      parents.push({ type: 'brand', id: row.brand_id })
    }
  }

  return parents
}

async function updateAuraScore(entityType: string, entityId: string, delta: number) {
  const table = getTableName(entityType)
  await pool.query(`UPDATE ${table} SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2`, [delta, entityId])
}

app.get('/credits', async (c) => {
  const visitorId = c.req.query('visitorId')
  if (!visitorId) {
    return c.json({ error: 'Missing visitorId' }, 400)
  }
  const credits = await getOrCreateCredits(visitorId)
  return c.json({
    upvotesRemaining: credits.upvotes_remaining,
    downvotesRemaining: credits.downvotes_remaining,
  })
})

app.post('/credits/refresh', async (c) => {
  const body = await c.req.json()
  const { visitorId, userId } = body
  if (!visitorId) {
    return c.json({ error: 'Missing visitorId' }, 400)
  }
  if (!userId) {
    return c.json({ error: 'Sign in to refresh your vote credits' }, 403)
  }
  await pool.query(
    `INSERT INTO visitor_credits (visitor_id, upvotes_remaining, downvotes_remaining) 
     VALUES ($1, $2, $3)
     ON CONFLICT (visitor_id) DO UPDATE SET upvotes_remaining = $2, downvotes_remaining = $3`,
    [visitorId, DEFAULT_UPVOTES, DEFAULT_DOWNVOTES]
  )
  return c.json({
    upvotesRemaining: DEFAULT_UPVOTES,
    downvotesRemaining: DEFAULT_DOWNVOTES,
  })
})

app.get('/', async (c) => {
  const visitorId = c.req.query('visitorId')
  const entityId = c.req.query('entityId')
  const entityType = c.req.query('entityType')

  if (visitorId && entityId && entityType) {
    const voteKey = `${visitorId}:${entityType}:${entityId}`
    const result = await pool.query('SELECT * FROM votes WHERE id = $1', [voteKey])
    if (result.rows.length === 0) return c.json(null)
    const row = result.rows[0] as DbVote
    return c.json({
      id: row.id,
      visitorId: row.visitor_id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      direction: row.direction,
      timestamp: row.timestamp,
    })
  }

  if (visitorId) {
    const result = await pool.query('SELECT * FROM votes WHERE visitor_id = $1', [visitorId])
    return c.json(result.rows.map(r => {
      const row = r as DbVote
      return {
        id: row.id,
        visitorId: row.visitor_id,
        entityId: row.entity_id,
        entityType: row.entity_type,
        direction: row.direction,
        timestamp: row.timestamp,
      }
    }))
  }

  return c.json({ error: 'Missing parameters' }, 400)
})

app.post('/', async (c) => {
  const body = await c.req.json()
  const { visitorId, entityId, entityType, direction, userId } = body

  if (!visitorId || !entityId || !entityType || !direction) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  if (!['UP', 'DOWN'].includes(direction)) {
    return c.json({ error: 'Invalid direction' }, 400)
  }

  const credits = await getOrCreateCredits(visitorId)
  if (direction === 'UP' && credits.upvotes_remaining <= 0) {
    return c.json({ error: 'No upvote credits remaining' }, 400)
  }
  if (direction === 'DOWN' && credits.downvotes_remaining <= 0) {
    return c.json({ error: 'No downvote credits remaining' }, 400)
  }

  if (direction === 'UP') {
    await pool.query('UPDATE visitor_credits SET upvotes_remaining = upvotes_remaining - 1 WHERE visitor_id = $1', [visitorId])
  } else {
    await pool.query('UPDATE visitor_credits SET downvotes_remaining = downvotes_remaining - 1 WHERE visitor_id = $1', [visitorId])
  }

  const auraDelta = direction === 'UP' ? VOTE_VALUE : -VOTE_VALUE

  const voteId = crypto.randomUUID()
  await pool.query(
    'INSERT INTO votes (id, visitor_id, entity_id, entity_type, direction, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
    [voteId, visitorId, entityId, entityType, direction, new Date().toISOString()]
  )

  await updateAuraScore(entityType, entityId, auraDelta)

  const parents = await getParentEntities(entityType, entityId)
  const propagatedDelta = auraDelta * AURA_PROPAGATION_FACTOR

  for (const parent of parents) {
    await updateAuraScore(parent.type, parent.id, propagatedDelta)
  }

  const updatedCredits = await getOrCreateCredits(visitorId)

  return c.json({
    id: voteId,
    visitorId,
    entityId,
    entityType,
    direction,
    timestamp: new Date(),
    credits: {
      upvotesRemaining: updatedCredits.upvotes_remaining,
      downvotesRemaining: updatedCredits.downvotes_remaining,
    },
  })
})

app.delete('/', async (c) => {
  return c.json({ error: 'Vote removal not supported with credits system' }, 400)
})

export default app
