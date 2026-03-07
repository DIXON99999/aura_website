import { Hono } from 'hono'
import { db } from '../db/index.js'
import type { DbVote, DbPlayer, DbRegion } from '../db/index.js'

const VOTE_VALUE = 1
const AURA_PROPAGATION_FACTOR = 0.1
const DEFAULT_UPVOTES = 20
const DEFAULT_DOWNVOTES = 10

// Create visitor_credits table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS visitor_credits (
    visitor_id TEXT PRIMARY KEY,
    upvotes_remaining INTEGER NOT NULL DEFAULT ${DEFAULT_UPVOTES},
    downvotes_remaining INTEGER NOT NULL DEFAULT ${DEFAULT_DOWNVOTES}
  )
`)

interface DbVisitorCredits {
  visitor_id: string
  upvotes_remaining: number
  downvotes_remaining: number
}

function getOrCreateCredits(visitorId: string): DbVisitorCredits {
  let credits = db.query('SELECT * FROM visitor_credits WHERE visitor_id = ?').get(visitorId) as DbVisitorCredits | null
  if (!credits) {
    db.run(
      'INSERT INTO visitor_credits (visitor_id, upvotes_remaining, downvotes_remaining) VALUES (?, ?, ?)',
      visitorId, DEFAULT_UPVOTES, DEFAULT_DOWNVOTES
    )
    credits = { visitor_id: visitorId, upvotes_remaining: DEFAULT_UPVOTES, downvotes_remaining: DEFAULT_DOWNVOTES }
  }
  return credits
}

const app = new Hono()

// Get the correct table name for an entity type
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

// Get parent entities for aura propagation
function getParentEntities(entityType: string, entityId: string): Array<{ type: string; id: string }> {
  const parents: Array<{ type: string; id: string }> = []

  if (entityType === 'player') {
    const player = db.query('SELECT * FROM players WHERE id = ?').get(entityId) as DbPlayer | null
    if (player) {
      if (player.organisation_id) parents.push({ type: 'organisation', id: player.organisation_id })
      if (player.country_id) parents.push({ type: 'country', id: player.country_id })
      if (player.region_id) parents.push({ type: 'region', id: player.region_id })
      if (player.main_game_id) parents.push({ type: 'game', id: player.main_game_id })
    }
  } else if (entityType === 'organisationGame') {
    const row = db.query('SELECT * FROM organisation_games WHERE id = ?').get(entityId) as { organisation_id: string; game_id: string } | null
    if (row) {
      parents.push({ type: 'organisation', id: row.organisation_id })
      parents.push({ type: 'game', id: row.game_id })
    }
  } else if (entityType === 'region') {
    const region = db.query('SELECT * FROM regions WHERE id = ?').get(entityId) as DbRegion | null
    if (region) parents.push({ type: 'game', id: region.game_id })
  } else if (['role', 'weapon', 'character'].includes(entityType)) {
    const table = getTableName(entityType)
    const row = db.query(`SELECT game_id FROM ${table} WHERE id = ?`).get(entityId) as { game_id: string } | null
    if (row) parents.push({ type: 'game', id: row.game_id })
  } else if (entityType === 'peripheral') {
    const row = db.query('SELECT brand_id FROM peripherals WHERE id = ?').get(entityId) as { brand_id: string } | null
    if (row) parents.push({ type: 'brand', id: row.brand_id })
  }

  return parents
}

// Update aura score for an entity (rounded to 2 decimal places to avoid floating point issues)
function updateAuraScore(entityType: string, entityId: string, delta: number) {
  const table = getTableName(entityType)
  db.run(`UPDATE ${table} SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?`, delta, entityId)
}

// GET /votes/credits?visitorId=xxx - Get visitor's remaining credits
app.get('/credits', (c) => {
  const visitorId = c.req.query('visitorId')
  if (!visitorId) {
    return c.json({ error: 'Missing visitorId' }, 400)
  }
  const credits = getOrCreateCredits(visitorId)
  return c.json({
    upvotesRemaining: credits.upvotes_remaining,
    downvotesRemaining: credits.downvotes_remaining,
  })
})

// POST /votes/credits/refresh - Refresh visitor's credits (only for signed-in users)
app.post('/credits/refresh', async (c) => {
  const body = await c.req.json()
  const { visitorId, userId } = body
  if (!visitorId) {
    return c.json({ error: 'Missing visitorId' }, 400)
  }
  // Only allow refresh for signed-in users
  if (!userId) {
    return c.json({ error: 'Sign in to refresh your vote credits' }, 403)
  }
  db.run(
    'INSERT OR REPLACE INTO visitor_credits (visitor_id, upvotes_remaining, downvotes_remaining) VALUES (?, ?, ?)',
    visitorId, DEFAULT_UPVOTES, DEFAULT_DOWNVOTES
  )
  return c.json({
    upvotesRemaining: DEFAULT_UPVOTES,
    downvotesRemaining: DEFAULT_DOWNVOTES,
  })
})

// GET /votes?visitorId=xxx&entityId=xxx&entityType=xxx
app.get('/', (c) => {
  const visitorId = c.req.query('visitorId')
  const entityId = c.req.query('entityId')
  const entityType = c.req.query('entityType')

  if (visitorId && entityId && entityType) {
    const voteKey = `${visitorId}:${entityType}:${entityId}`
    const row = db.query('SELECT * FROM votes WHERE id = ?').get(voteKey) as DbVote | null
    return c.json(row ? {
      id: row.id,
      visitorId: row.visitor_id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      direction: row.direction,
      timestamp: new Date(row.timestamp),
    } : null)
  }

  if (visitorId) {
    const rows = db.query('SELECT * FROM votes WHERE visitor_id = ?').all(visitorId) as DbVote[]
    return c.json(rows.map(r => ({
      id: r.id,
      visitorId: r.visitor_id,
      entityId: r.entity_id,
      entityType: r.entity_type,
      direction: r.direction,
      timestamp: new Date(r.timestamp),
    })))
  }

  return c.json({ error: 'Missing parameters' }, 400)
})

// POST /votes - Use credits system (multiple votes allowed for signed-in users)
app.post('/', async (c) => {
  const body = await c.req.json()
  const { visitorId, entityId, entityType, direction, userId } = body

  if (!visitorId || !entityId || !entityType || !direction) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  if (!['UP', 'DOWN'].includes(direction)) {
    return c.json({ error: 'Invalid direction' }, 400)
  }

  // Check credits
  const credits = getOrCreateCredits(visitorId)
  if (direction === 'UP' && credits.upvotes_remaining <= 0) {
    return c.json({ error: 'No upvote credits remaining' }, 400)
  }
  if (direction === 'DOWN' && credits.downvotes_remaining <= 0) {
    return c.json({ error: 'No downvote credits remaining' }, 400)
  }

  // Deduct credit
  if (direction === 'UP') {
    db.run('UPDATE visitor_credits SET upvotes_remaining = upvotes_remaining - 1 WHERE visitor_id = ?', visitorId)
  } else {
    db.run('UPDATE visitor_credits SET downvotes_remaining = downvotes_remaining - 1 WHERE visitor_id = ?', visitorId)
  }

  const auraDelta = direction === 'UP' ? VOTE_VALUE : -VOTE_VALUE

  // Record the vote (with unique ID for each vote)
  const voteId = crypto.randomUUID()
  db.run(
    'INSERT INTO votes (id, visitor_id, entity_id, entity_type, direction, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    voteId, visitorId, entityId, entityType, direction, Date.now()
  )

  // Update entity aura score
  updateAuraScore(entityType, entityId, auraDelta)

  // Propagate to parents
  const parents = getParentEntities(entityType, entityId)
  const propagatedDelta = auraDelta * AURA_PROPAGATION_FACTOR

  for (const parent of parents) {
    updateAuraScore(parent.type, parent.id, propagatedDelta)
  }

  // Get updated credits
  const updatedCredits = getOrCreateCredits(visitorId)

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

// DELETE /votes - No longer used with credits system, but kept for backwards compatibility
app.delete('/', async (c) => {
  return c.json({ error: 'Vote removal not supported with credits system' }, 400)
})

export default app
