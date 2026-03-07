import { Hono } from 'hono'
import { db, type DbAuraFarm, type DbAuraFarmVote, type DbPlayer } from '../db/index.js'

const app = new Hono()

// Helper to get entity table name
function getEntityTable(entityType: string): string | null {
  const tables: Record<string, string> = {
    player: 'players',
    team: 'organisation_games',
    organisation: 'organisations',
    game: 'games',
    peripheral: 'peripherals',
    brand: 'brands',
    country: 'countries',
    region: 'regions',
    role: 'roles',
    weapon: 'weapons',
    character: 'characters',
  }
  return tables[entityType] || null
}

// GET / - List all public aura farms
app.get('/', async (c) => {
  const search = c.req.query('search')

  let query = 'SELECT * FROM aura_farms ORDER BY created_at DESC'
  let farms: DbAuraFarm[]

  if (search) {
    farms = db.query(
      'SELECT * FROM aura_farms WHERE title LIKE ? ORDER BY created_at DESC'
    ).all(`%${search}%`) as DbAuraFarm[]
  } else {
    farms = db.query(query).all() as DbAuraFarm[]
  }

  // Enrich with entity info and owner info
  const enrichedFarms = farms.map(farm => {
    const table = getEntityTable(farm.entity_type)
    let entity = null
    if (table) {
      entity = db.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = ?`).get(farm.entity_id) as any
    }
    // Get owner's linked player name or fall back to email username
    let ownerName: string | null = null
    const owner = db.query('SELECT email, player_id FROM users WHERE id = ?').get(farm.owner_id) as { email: string; player_id: string | null } | null
    if (owner?.player_id) {
      const player = db.query('SELECT name FROM players WHERE id = ?').get(owner.player_id) as { name: string } | null
      ownerName = player?.name || null
    }
    // Fall back to user profile name from user_profiles table
    if (!ownerName) {
      const profile = db.query('SELECT player_id FROM user_profiles WHERE visitor_id = ?').get(farm.owner_id) as { player_id: string } | null
      if (profile?.player_id) {
        const player = db.query('SELECT name FROM players WHERE id = ?').get(profile.player_id) as { name: string } | null
        ownerName = player?.name || null
      }
    }
    // Fall back to email username
    if (!ownerName && owner?.email) {
      ownerName = owner.email.split('@')[0]
    }
    return {
      id: farm.id,
      title: farm.title,
      description: farm.description,
      entityId: farm.entity_id,
      entityType: farm.entity_type,
      ownerId: farm.owner_id,
      ownerName,
      imageUrl: farm.image_url,
      auraScore: farm.aura_score,
      createdAt: new Date(farm.created_at),
      entity: entity ? {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        auraScore: entity.aura_score,
        imageUrl: entity.image_url,
      } : null,
    }
  })

  return c.json(enrichedFarms)
})

// GET /my - List user's aura farms
app.get('/my', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const session = db.query('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, Date.now()) as { user_id: string } | null
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const farms = db.query(
    'SELECT * FROM aura_farms WHERE owner_id = ? ORDER BY created_at DESC'
  ).all(session.user_id) as DbAuraFarm[]

  const enrichedFarms = farms.map(farm => {
    const table = getEntityTable(farm.entity_type)
    let entity = null
    if (table) {
      entity = db.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = ?`).get(farm.entity_id) as any
    }
    // Get owner's linked player name or fall back to email username
    let ownerName: string | null = null
    const owner = db.query('SELECT email, player_id FROM users WHERE id = ?').get(farm.owner_id) as { email: string; player_id: string | null } | null
    if (owner?.player_id) {
      const player = db.query('SELECT name FROM players WHERE id = ?').get(owner.player_id) as { name: string } | null
      ownerName = player?.name || null
    }
    // Fall back to user profile name from user_profiles table
    if (!ownerName) {
      const profile = db.query('SELECT player_id FROM user_profiles WHERE visitor_id = ?').get(farm.owner_id) as { player_id: string } | null
      if (profile?.player_id) {
        const player = db.query('SELECT name FROM players WHERE id = ?').get(profile.player_id) as { name: string } | null
        ownerName = player?.name || null
      }
    }
    // Fall back to email username
    if (!ownerName && owner?.email) {
      ownerName = owner.email.split('@')[0]
    }
    return {
      id: farm.id,
      title: farm.title,
      description: farm.description,
      entityId: farm.entity_id,
      entityType: farm.entity_type,
      ownerId: farm.owner_id,
      ownerName,
      imageUrl: farm.image_url,
      auraScore: farm.aura_score,
      createdAt: new Date(farm.created_at),
      entity: entity ? {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        auraScore: entity.aura_score,
        imageUrl: entity.image_url,
      } : null,
    }
  })

  return c.json(enrichedFarms)
})

// GET /:id - Get single aura farm
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const farm = db.query('SELECT * FROM aura_farms WHERE id = ?').get(id) as DbAuraFarm | null

  if (!farm) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  const table = getEntityTable(farm.entity_type)
  let entity = null
  if (table) {
    entity = db.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = ?`).get(farm.entity_id) as any
  }
  // Get owner's linked player name or fall back to email username
  let ownerName: string | null = null
  const owner = db.query('SELECT email, player_id FROM users WHERE id = ?').get(farm.owner_id) as { email: string; player_id: string | null } | null
  if (owner?.player_id) {
    const player = db.query('SELECT name FROM players WHERE id = ?').get(owner.player_id) as { name: string } | null
    ownerName = player?.name || null
  }
  // Fall back to user profile name from user_profiles table
  if (!ownerName) {
    const profile = db.query('SELECT player_id FROM user_profiles WHERE visitor_id = ?').get(farm.owner_id) as { player_id: string } | null
    if (profile?.player_id) {
      const player = db.query('SELECT name FROM players WHERE id = ?').get(profile.player_id) as { name: string } | null
      ownerName = player?.name || null
    }
  }
  // Fall back to email username
  if (!ownerName && owner?.email) {
    ownerName = owner.email.split('@')[0]
  }

  return c.json({
    id: farm.id,
    title: farm.title,
    description: farm.description,
    entityId: farm.entity_id,
    entityType: farm.entity_type,
    ownerId: farm.owner_id,
    ownerName,
    imageUrl: farm.image_url,
    auraScore: farm.aura_score,
    createdAt: new Date(farm.created_at),
    entity: entity ? {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      auraScore: entity.aura_score,
      imageUrl: entity.image_url,
    } : null,
  })
})

// POST / - Create aura farm
app.post('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const session = db.query('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, Date.now()) as { user_id: string } | null
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json()
  const { title, description, entityId, entityType, imageUrl } = body

  if (!title?.trim()) {
    return c.json({ error: 'Title is required' }, 400)
  }

  if (!entityId || !entityType) {
    return c.json({ error: 'Entity is required' }, 400)
  }

  // Verify entity exists
  const table = getEntityTable(entityType)
  if (!table) {
    return c.json({ error: 'Invalid entity type' }, 400)
  }

  const entity = db.query(`SELECT id FROM ${table} WHERE id = ?`).get(entityId)
  if (!entity) {
    return c.json({ error: 'Entity not found' }, 404)
  }

  const id = crypto.randomUUID()
  const now = Date.now()

  db.run(
    'INSERT INTO aura_farms (id, title, description, entity_id, entity_type, owner_id, image_url, aura_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
    id, title.trim(), description?.trim() || null, entityId, entityType, session.user_id, imageUrl?.trim() || null, now
  )

  return c.json({
    id,
    title: title.trim(),
    description: description?.trim() || null,
    entityId,
    entityType,
    ownerId: session.user_id,
    imageUrl: imageUrl?.trim() || null,
    auraScore: 0,
    createdAt: new Date(now),
  })
})

// PATCH /:id - Update aura farm
app.patch('/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const session = db.query('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, Date.now()) as { user_id: string } | null
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const farm = db.query('SELECT * FROM aura_farms WHERE id = ?').get(id) as DbAuraFarm | null

  if (!farm) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  if (farm.owner_id !== session.user_id) {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const body = await c.req.json()
  const { title, description, imageUrl } = body

  const updates: string[] = []
  const values: any[] = []

  if (title !== undefined) {
    updates.push('title = ?')
    values.push(title.trim())
  }
  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description.trim() || null)
  }
  if (imageUrl !== undefined) {
    updates.push('image_url = ?')
    values.push(imageUrl.trim() || null)
  }

  if (updates.length > 0) {
    values.push(id)
    db.run(`UPDATE aura_farms SET ${updates.join(', ')} WHERE id = ?`, ...values)
  }

  const updatedFarm = db.query('SELECT * FROM aura_farms WHERE id = ?').get(id) as DbAuraFarm

  const table = getEntityTable(updatedFarm.entity_type)
  let entity = null
  if (table) {
    entity = db.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = ?`).get(updatedFarm.entity_id) as any
  }

  return c.json({
    id: updatedFarm.id,
    title: updatedFarm.title,
    description: updatedFarm.description,
    entityId: updatedFarm.entity_id,
    entityType: updatedFarm.entity_type,
    ownerId: updatedFarm.owner_id,
    imageUrl: updatedFarm.image_url,
    auraScore: updatedFarm.aura_score,
    createdAt: new Date(updatedFarm.created_at),
    entity: entity ? {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      auraScore: entity.aura_score,
      imageUrl: entity.image_url,
    } : null,
  })
})

// DELETE /:id - Delete aura farm
app.delete('/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const session = db.query('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, Date.now()) as { user_id: string } | null
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const farm = db.query('SELECT * FROM aura_farms WHERE id = ?').get(id) as DbAuraFarm | null

  if (!farm) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  if (farm.owner_id !== session.user_id) {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  // Delete votes first
  db.run('DELETE FROM aura_farm_votes WHERE farm_id = ?', id)
  db.run('DELETE FROM aura_farms WHERE id = ?', id)

  return c.json({ success: true })
})

// POST /:id/vote - Vote on aura farm
app.post('/:id/vote', async (c) => {
  const farmId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId, direction } = body

  if (!visitorId || !['UP', 'DOWN'].includes(direction)) {
    return c.json({ error: 'Invalid vote' }, 400)
  }

  const farm = db.query('SELECT * FROM aura_farms WHERE id = ?').get(farmId) as DbAuraFarm | null
  if (!farm) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  // Check existing vote
  const existingVote = db.query(
    'SELECT * FROM aura_farm_votes WHERE visitor_id = ? AND farm_id = ?'
  ).get(visitorId, farmId) as DbAuraFarmVote | null

  const voteValue = direction === 'UP' ? 1 : -1
  let newScore = farm.aura_score

  if (existingVote) {
    if (existingVote.direction === direction) {
      return c.json({ error: 'Already voted' }, 400)
    }
    // Change vote direction
    const scoreDiff = voteValue * 2
    newScore += scoreDiff
    db.run('UPDATE aura_farm_votes SET direction = ?, timestamp = ? WHERE id = ?', direction, Date.now(), existingVote.id)
  } else {
    // New vote
    newScore += voteValue
    const voteId = crypto.randomUUID()
    db.run(
      'INSERT INTO aura_farm_votes (id, visitor_id, farm_id, direction, timestamp) VALUES (?, ?, ?, ?, ?)',
      voteId, visitorId, farmId, direction, Date.now()
    )
  }

  // Update farm score
  db.run('UPDATE aura_farms SET aura_score = ? WHERE id = ?', newScore, farmId)

  // Also update the entity's global aura score
  const table = getEntityTable(farm.entity_type)
  if (table) {
    const entityScoreDiff = existingVote ? (voteValue * 2) : voteValue
    db.run(`UPDATE ${table} SET aura_score = aura_score + ? WHERE id = ?`, entityScoreDiff, farm.entity_id)
  }

  return c.json({
    farmId,
    auraScore: newScore,
    direction,
  })
})

// DELETE /:id/vote - Remove vote from aura farm
app.delete('/:id/vote', async (c) => {
  const farmId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId } = body

  if (!visitorId) {
    return c.json({ error: 'Visitor ID required' }, 400)
  }

  const farm = db.query('SELECT * FROM aura_farms WHERE id = ?').get(farmId) as DbAuraFarm | null
  if (!farm) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  const existingVote = db.query(
    'SELECT * FROM aura_farm_votes WHERE visitor_id = ? AND farm_id = ?'
  ).get(visitorId, farmId) as DbAuraFarmVote | null

  if (!existingVote) {
    return c.json({ error: 'No vote to remove' }, 400)
  }

  const voteValue = existingVote.direction === 'UP' ? -1 : 1
  const newScore = farm.aura_score + voteValue

  db.run('DELETE FROM aura_farm_votes WHERE id = ?', existingVote.id)
  db.run('UPDATE aura_farms SET aura_score = ? WHERE id = ?', newScore, farmId)

  // Also update the entity's global aura score
  const table = getEntityTable(farm.entity_type)
  if (table) {
    db.run(`UPDATE ${table} SET aura_score = aura_score + ? WHERE id = ?`, voteValue, farm.entity_id)
  }

  return c.json({
    farmId,
    auraScore: newScore,
  })
})

// GET /:id/votes - Get visitor's vote for this farm
app.get('/:id/votes', async (c) => {
  const farmId = c.req.param('id')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const vote = db.query(
    'SELECT * FROM aura_farm_votes WHERE visitor_id = ? AND farm_id = ?'
  ).get(visitorId, farmId) as DbAuraFarmVote | null

  if (!vote) {
    return c.json([])
  }

  return c.json([{ farmId: vote.farm_id, direction: vote.direction }])
})

export default app
