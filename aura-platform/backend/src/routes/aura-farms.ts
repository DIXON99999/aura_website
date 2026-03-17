import { Hono } from 'hono'
import { pool, type DbAuraFarm, type DbAuraFarmVote, type DbPlayer } from '../db/index.js'
import { createNotification, extractMentions, findUsersByUsernames, findUserByPlayerId, getUsernameFromUserId, createThrottledNotification } from './notifications.js'

const app = new Hono()

interface DbAuraFarmComment {
  id: string
  farm_id: string
  visitor_id: string
  user_id: string | null
  username: string
  content: string
  parent_id: string | null
  vote_count: number
  image_url: string | null
  created_at: string
}

async function initAuraFarmTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aura_farm_comments (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      content TEXT NOT NULL,
      parent_id TEXT,
      vote_count INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `)

  // Backfill vote_count column for existing tables
  await pool.query(`ALTER TABLE aura_farm_comments ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aura_farm_comment_votes (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      "timestamp" BIGINT NOT NULL
    )
  `)
}

initAuraFarmTables().catch(console.error)

// Add slug column to existing tables and backfill slugs
async function migrateAuraFarmSlugs() {
  await pool.query(`ALTER TABLE aura_farms ADD COLUMN IF NOT EXISTS slug TEXT`)

  // Find farms without slugs and generate unique ones
  const result = await pool.query('SELECT id, title FROM aura_farms WHERE slug IS NULL')
  for (const row of result.rows as { id: string; title: string }[]) {
    const baseSlug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    let slug = baseSlug
    let suffix = 2

    while (true) {
      const existing = await pool.query('SELECT id FROM aura_farms WHERE slug = $1 AND id != $2', [slug, row.id])
      if (existing.rows.length === 0) break
      slug = `${baseSlug}-${suffix}`
      suffix++
    }

    await pool.query('UPDATE aura_farms SET slug = $1 WHERE id = $2', [slug, row.id])
  }
}
migrateAuraFarmSlugs().catch(console.error)

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const baseSlug = generateSlug(name)
  let slug = baseSlug
  let suffix = 2

  while (true) {
    let query = 'SELECT id FROM aura_farms WHERE slug = $1'
    const params: string[] = [slug]
    if (excludeId) {
      query += ' AND id != $2'
      params.push(excludeId)
    }
    const result = await pool.query(query, params)
    if (result.rows.length === 0) {
      return slug
    }
    slug = `${baseSlug}-${suffix}`
    suffix++
  }
}

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

async function getOwnerName(ownerId: string): Promise<string | null> {
  let ownerName: string | null = null
  const ownerResult = await pool.query('SELECT email, player_id FROM users WHERE id = $1', [ownerId])
  if (ownerResult.rows.length > 0) {
    const owner = ownerResult.rows[0] as { email: string; player_id: string | null }
    if (owner.player_id) {
      const playerResult = await pool.query('SELECT name FROM players WHERE id = $1', [owner.player_id])
      if (playerResult.rows.length > 0) {
        ownerName = (playerResult.rows[0] as { name: string }).name
      }
    }
    if (!ownerName) {
      const profileResult = await pool.query('SELECT player_id FROM user_profiles WHERE visitor_id = $1', [ownerId])
      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0] as { player_id: string }
        const playerResult = await pool.query('SELECT name FROM players WHERE id = $1', [profile.player_id])
        if (playerResult.rows.length > 0) {
          ownerName = (playerResult.rows[0] as { name: string }).name
        }
      }
    }
    if (!ownerName && owner.email) {
      ownerName = owner.email.split('@')[0]
    }
  }
  return ownerName
}

app.get('/', async (c) => {
  const search = c.req.query('search')
  const entityId = c.req.query('entityId')
  const sort = c.req.query('sort') ?? 'new'
  const orderBy =
    sort === 'popular'
      ? 'aura_score DESC, created_at DESC'
      : sort === 'unpopular'
        ? 'aura_score ASC, created_at DESC'
        : sort === 'oldest'
          ? 'created_at ASC'
          : 'created_at DESC'
  let result

  if (entityId) {
    result = await pool.query(
      `SELECT * FROM aura_farms WHERE entity_id = $1 ORDER BY ${orderBy}`,
      [entityId]
    )
  } else if (search) {
    result = await pool.query(
      `SELECT * FROM aura_farms WHERE title ILIKE $1 ORDER BY ${orderBy}`,
      [`%${search}%`]
    )
  } else {
    result = await pool.query(`SELECT * FROM aura_farms ORDER BY ${orderBy}`)
  }

  const farms = result.rows as DbAuraFarm[]

  const enrichedFarms = await Promise.all(farms.map(async (farm) => {
    const table = getEntityTable(farm.entity_type)
    let entity = null
    if (table) {
      const entityResult = await pool.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = $1`, [farm.entity_id])
      entity = entityResult.rows.length > 0 ? entityResult.rows[0] : null
    }
    const ownerName = await getOwnerName(farm.owner_id)
    return {
      id: farm.id,
      title: farm.title,
      slug: (farm as any).slug || null,
      description: farm.description,
      entityId: farm.entity_id,
      entityType: farm.entity_type,
      ownerId: farm.owner_id,
      ownerName,
      imageUrl: farm.image_url,
      auraScore: farm.aura_score,
      createdAt: farm.created_at,
      entity: entity ? {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        auraScore: entity.aura_score,
        imageUrl: entity.image_url,
      } : null,
    }
  }))

  return c.json(enrichedFarms)
})

app.get('/my', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()', [sessionId])
  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const session = sessionResult.rows[0] as { user_id: string }

  const result = await pool.query(
    'SELECT * FROM aura_farms WHERE owner_id = $1 ORDER BY created_at DESC',
    [session.user_id]
  )
  const farms = result.rows as DbAuraFarm[]

  const enrichedFarms = await Promise.all(farms.map(async (farm) => {
    const table = getEntityTable(farm.entity_type)
    let entity = null
    if (table) {
      const entityResult = await pool.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = $1`, [farm.entity_id])
      entity = entityResult.rows.length > 0 ? entityResult.rows[0] : null
    }
    const ownerName = await getOwnerName(farm.owner_id)
    return {
      id: farm.id,
      title: farm.title,
      slug: (farm as any).slug || null,
      description: farm.description,
      entityId: farm.entity_id,
      entityType: farm.entity_type,
      ownerId: farm.owner_id,
      ownerName,
      imageUrl: farm.image_url,
      auraScore: farm.aura_score,
      createdAt: farm.created_at,
      entity: entity ? {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        auraScore: entity.aura_score,
        imageUrl: entity.image_url,
      } : null,
    }
  }))

  return c.json(enrichedFarms)
})

app.get('/:idOrSlug', async (c) => {
  const idOrSlug = c.req.param('idOrSlug')
  // Try to find by ID first, then by slug
  let result = await pool.query('SELECT * FROM aura_farms WHERE id = $1', [idOrSlug])
  if (result.rows.length === 0) {
    result = await pool.query('SELECT * FROM aura_farms WHERE slug = $1', [idOrSlug])
  }

  if (result.rows.length === 0) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  const farm = result.rows[0] as DbAuraFarm
  const table = getEntityTable(farm.entity_type)
  let entity = null
  if (table) {
    const entityResult = await pool.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = $1`, [farm.entity_id])
    entity = entityResult.rows.length > 0 ? entityResult.rows[0] : null
  }
  const ownerName = await getOwnerName(farm.owner_id)

  return c.json({
    id: farm.id,
    title: farm.title,
    slug: (farm as any).slug || null,
    description: farm.description,
    entityId: farm.entity_id,
    entityType: farm.entity_type,
    ownerId: farm.owner_id,
    ownerName,
    imageUrl: farm.image_url,
    auraScore: farm.aura_score,
    createdAt: farm.created_at,
    entity: entity ? {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      auraScore: entity.aura_score,
      imageUrl: entity.image_url,
    } : null,
  })
})

app.post('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()', [sessionId])
  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const session = sessionResult.rows[0] as { user_id: string }

  const body = await c.req.json()
  const { title, description, entityId, entityType, imageUrl } = body

  if (!title?.trim()) {
    return c.json({ error: 'Title is required' }, 400)
  }

  if (!entityId || !entityType) {
    return c.json({ error: 'Entity is required' }, 400)
  }

  const table = getEntityTable(entityType)
  if (!table) {
    return c.json({ error: 'Invalid entity type' }, 400)
  }

  const entityResult = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [entityId])
  if (entityResult.rows.length === 0) {
    return c.json({ error: 'Entity not found' }, 404)
  }

  const id = crypto.randomUUID()
  const slug = await generateUniqueSlug(title.trim())
  const now = new Date()

  await pool.query(
    'INSERT INTO aura_farms (id, title, slug, description, entity_id, entity_type, owner_id, image_url, aura_score, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9)',
    [id, title.trim(), slug, description?.trim() || null, entityId, entityType, session.user_id, imageUrl?.trim() || null, now.toISOString()]
  )

  // Notify the player if an aura farm is created for their profile
  if (entityType === 'player') {
    const playerOwnerUserId = await findUserByPlayerId(entityId)
    if (playerOwnerUserId && playerOwnerUserId !== session.user_id) {
      const creatorUsername = await getUsernameFromUserId(session.user_id)
      await createNotification({
        userId: playerOwnerUserId,
        type: 'aura_farm_created',
        sourceType: 'aura_farm',
        sourceId: id,
        sourceUrl: `/aura-farms/${slug}`,
        fromUserId: session.user_id,
        fromUsername: creatorUsername,
        content: `Created an Aura Farm about you: "${title.trim()}"`,
      })
    }
  }

  return c.json({
    id,
    title: title.trim(),
    slug,
    description: description?.trim() || null,
    entityId,
    entityType,
    ownerId: session.user_id,
    imageUrl: imageUrl?.trim() || null,
    auraScore: 0,
    createdAt: now,
  })
})

app.patch('/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()', [sessionId])
  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const session = sessionResult.rows[0] as { user_id: string }

  const id = c.req.param('id')
  const farmResult = await pool.query('SELECT * FROM aura_farms WHERE id = $1', [id])

  if (farmResult.rows.length === 0) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  const farm = farmResult.rows[0] as DbAuraFarm
  if (farm.owner_id !== session.user_id) {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const body = await c.req.json()
  const { title, description, imageUrl } = body

  const updates: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (title !== undefined) {
    updates.push(`title = $${paramIndex++}`)
    values.push(title.trim())
    // Also update slug when title changes
    const newSlug = await generateUniqueSlug(title.trim(), id)
    updates.push(`slug = $${paramIndex++}`)
    values.push(newSlug)
  }
  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(description.trim() || null)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    values.push(imageUrl.trim() || null)
  }

  if (updates.length > 0) {
    values.push(id)
    await pool.query(`UPDATE aura_farms SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values)
  }

  const updatedResult = await pool.query('SELECT * FROM aura_farms WHERE id = $1', [id])
  const updatedFarm = updatedResult.rows[0] as DbAuraFarm

  const table = getEntityTable(updatedFarm.entity_type)
  let entity = null
  if (table) {
    const entityResult = await pool.query(`SELECT id, name, slug, aura_score, image_url FROM ${table} WHERE id = $1`, [updatedFarm.entity_id])
    entity = entityResult.rows.length > 0 ? entityResult.rows[0] : null
  }

  return c.json({
    id: updatedFarm.id,
    title: updatedFarm.title,
    slug: (updatedFarm as any).slug || null,
    description: updatedFarm.description,
    entityId: updatedFarm.entity_id,
    entityType: updatedFarm.entity_type,
    ownerId: updatedFarm.owner_id,
    imageUrl: updatedFarm.image_url,
    auraScore: updatedFarm.aura_score,
    createdAt: updatedFarm.created_at,
    entity: entity ? {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      auraScore: entity.aura_score,
      imageUrl: entity.image_url,
    } : null,
  })
})

app.delete('/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionId = authHeader.slice(7)
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()', [sessionId])
  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const session = sessionResult.rows[0] as { user_id: string }

  const id = c.req.param('id')
  const farmResult = await pool.query('SELECT * FROM aura_farms WHERE id = $1', [id])

  if (farmResult.rows.length === 0) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  const farm = farmResult.rows[0] as DbAuraFarm
  if (farm.owner_id !== session.user_id) {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  await pool.query('DELETE FROM aura_farm_votes WHERE farm_id = $1', [id])
  await pool.query('DELETE FROM aura_farms WHERE id = $1', [id])

  return c.json({ success: true })
})

app.post('/:id/vote', async (c) => {
  const farmId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId, direction, userId } = body

  if (!visitorId || !['UP', 'DOWN'].includes(direction)) {
    return c.json({ error: 'Invalid vote' }, 400)
  }

  const farmResult = await pool.query('SELECT * FROM aura_farms WHERE id = $1', [farmId])
  if (farmResult.rows.length === 0) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }
  const farm = farmResult.rows[0] as DbAuraFarm

  const voteValue = direction === 'UP' ? 1 : -1
  const newScore = farm.aura_score + voteValue

  // Allow multiple votes per farm - always insert a new vote
  const voteId = crypto.randomUUID()
  await pool.query(
    'INSERT INTO aura_farm_votes (id, visitor_id, farm_id, direction, "timestamp") VALUES ($1, $2, $3, $4, $5)',
    [voteId, visitorId, farmId, direction, Date.now()]
  )

  await pool.query('UPDATE aura_farms SET aura_score = $1 WHERE id = $2', [newScore, farmId])

  const table = getEntityTable(farm.entity_type)
  if (table) {
    await pool.query(`UPDATE ${table} SET aura_score = aura_score + $1 WHERE id = $2`, [voteValue, farm.entity_id])
  }

  // Notify entity owner if it's a player (throttled)
  if (farm.entity_type === 'player' && userId) {
    const playerOwnerUserId = await findUserByPlayerId(farm.entity_id)
    if (playerOwnerUserId && playerOwnerUserId !== userId) {
      const voterUsername = await getUsernameFromUserId(userId)
      const voteAction = direction === 'UP' ? 'upvoted' : 'downvoted'
      await createThrottledNotification({
        userId: playerOwnerUserId,
        type: 'entity_vote',
        sourceType: 'aura_farm',
        sourceId: farmId,
        sourceUrl: `/aura-farms/${(farm as any).slug || farmId}`,
        fromUserId: userId,
        fromUsername: voterUsername,
        content: `${voteAction} an Aura Farm about you`,
        entityType: 'aura_farm',
        entityId: farmId,
      })
    }
  }

  return c.json({
    farmId,
    auraScore: newScore,
    direction,
  })
})

app.delete('/:id/vote', async (c) => {
  const farmId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId } = body

  if (!visitorId) {
    return c.json({ error: 'Visitor ID required' }, 400)
  }

  const farmResult = await pool.query('SELECT * FROM aura_farms WHERE id = $1', [farmId])
  if (farmResult.rows.length === 0) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }
  const farm = farmResult.rows[0] as DbAuraFarm

  const existingVoteResult = await pool.query(
    'SELECT * FROM aura_farm_votes WHERE visitor_id = $1 AND farm_id = $2',
    [visitorId, farmId]
  )
  if (existingVoteResult.rows.length === 0) {
    return c.json({ error: 'No vote to remove' }, 400)
  }
  const existingVote = existingVoteResult.rows[0] as DbAuraFarmVote

  const voteValue = existingVote.direction === 'UP' ? -1 : 1
  const newScore = farm.aura_score + voteValue

  await pool.query('DELETE FROM aura_farm_votes WHERE id = $1', [existingVote.id])
  await pool.query('UPDATE aura_farms SET aura_score = $1 WHERE id = $2', [newScore, farmId])

  const table = getEntityTable(farm.entity_type)
  if (table) {
    await pool.query(`UPDATE ${table} SET aura_score = aura_score + $1 WHERE id = $2`, [voteValue, farm.entity_id])
  }

  return c.json({
    farmId,
    auraScore: newScore,
  })
})

app.get('/:id/votes', async (c) => {
  const farmId = c.req.param('id')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const result = await pool.query(
    'SELECT * FROM aura_farm_votes WHERE visitor_id = $1 AND farm_id = $2',
    [visitorId, farmId]
  )

  if (result.rows.length === 0) {
    return c.json([])
  }

  const vote = result.rows[0] as DbAuraFarmVote
  return c.json([{ farmId: vote.farm_id, direction: vote.direction }])
})

// Comments endpoints
app.get('/:id/comments', async (c) => {
  const farmId = c.req.param('id')

  const result = await pool.query(
    'SELECT * FROM aura_farm_comments WHERE farm_id = $1 ORDER BY created_at DESC',
    [farmId]
  )

  return c.json(result.rows.map((row) => {
    const comment = row as DbAuraFarmComment
    return {
      id: comment.id,
      farmId: comment.farm_id,
      visitorId: comment.visitor_id,
      userId: comment.user_id,
      username: comment.username || 'Anonymous',
      content: comment.content,
      parentId: comment.parent_id,
      voteCount: comment.vote_count,
      imageUrl: comment.image_url,
      createdAt: comment.created_at,
    }
  }))
})

app.post('/:id/comments', async (c) => {
  const farmId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId, content, username, parentId, imageUrl, userId } = body

  if (!visitorId || (!content?.trim() && !imageUrl)) {
    return c.json({ error: 'Visitor ID and content or image are required' }, 400)
  }

  const farmResult = await pool.query('SELECT id FROM aura_farms WHERE id = $1', [farmId])
  if (farmResult.rows.length === 0) {
    return c.json({ error: 'Aura farm not found' }, 404)
  }

  const commentId = crypto.randomUUID()
  const now = new Date()
  const trimmedContent = content?.trim() || ''

  await pool.query(
    'INSERT INTO aura_farm_comments (id, farm_id, visitor_id, user_id, username, content, parent_id, vote_count, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [commentId, farmId, visitorId, userId || null, username || 'Anonymous', trimmedContent, parentId || null, 0, imageUrl || null, now.toISOString()]
  )

  // Process @mentions and create notifications
  if (trimmedContent) {
    const mentions = extractMentions(trimmedContent)
    if (mentions.length > 0) {
      const usernameToUserId = await findUsersByUsernames(mentions)
      for (const [mentionedUsername, mentionedUserId] of usernameToUserId) {
        // Don't notify yourself
        if (mentionedUserId !== userId) {
          await createNotification({
            userId: mentionedUserId,
            type: 'mention',
            sourceType: 'aura_farm_comment',
            sourceId: commentId,
            sourceUrl: `/aura-farms/${farmId}`,
            fromUserId: userId,
            fromUsername: username || 'Anonymous',
            content: trimmedContent.length > 100 ? trimmedContent.substring(0, 100) + '...' : trimmedContent,
          })
        }
      }
    }
  }

  return c.json({
    id: commentId,
    farmId,
    visitorId,
    userId: userId || null,
    username: username || 'Anonymous',
    content: trimmedContent,
    parentId: parentId || null,
    voteCount: 0,
    imageUrl: imageUrl || null,
    createdAt: now,
  })
})

app.delete('/:id/comments/:commentId', async (c) => {
  const commentId = c.req.param('commentId')
  const body = await c.req.json()
  const { visitorId, userId } = body

  const commentResult = await pool.query('SELECT * FROM aura_farm_comments WHERE id = $1', [commentId])
  if (commentResult.rows.length === 0) {
    return c.json({ error: 'Comment not found' }, 404)
  }
  const comment = commentResult.rows[0] as DbAuraFarmComment

  let canDelete = false
  if (comment.user_id) {
    canDelete = comment.user_id === userId
  } else {
    canDelete = comment.visitor_id === visitorId
  }

  if (!canDelete) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  await pool.query('DELETE FROM aura_farm_comment_votes WHERE comment_id = $1', [commentId])
  await pool.query('DELETE FROM aura_farm_comments WHERE id = $1', [commentId])

  return c.json({ success: true })
})

app.post('/:id/comments/:commentId/vote', async (c) => {
  const commentId = c.req.param('commentId')
  const body = await c.req.json()
  const { visitorId, direction } = body

  if (!visitorId || !direction) {
    return c.json({ error: 'Visitor ID and direction are required' }, 400)
  }

  const existingVoteResult = await pool.query(
    'SELECT * FROM aura_farm_comment_votes WHERE comment_id = $1 AND visitor_id = $2',
    [commentId, visitorId]
  )
  const existingVote = existingVoteResult.rows.length > 0 ? existingVoteResult.rows[0] as any : null

  const delta = direction === 'UP' ? 1 : -1

  if (existingVote) {
    if (existingVote.direction === direction) {
      await pool.query('DELETE FROM aura_farm_comment_votes WHERE id = $1', [existingVote.id])
      await pool.query('UPDATE aura_farm_comments SET vote_count = vote_count - $1 WHERE id = $2', [delta, commentId])
    } else {
      await pool.query('UPDATE aura_farm_comment_votes SET direction = $1 WHERE id = $2', [direction, existingVote.id])
      await pool.query('UPDATE aura_farm_comments SET vote_count = vote_count + $1 WHERE id = $2', [delta * 2, commentId])
    }
  } else {
    const voteId = crypto.randomUUID()
    await pool.query(
      'INSERT INTO aura_farm_comment_votes (id, comment_id, visitor_id, direction, "timestamp") VALUES ($1, $2, $3, $4, $5)',
      [voteId, commentId, visitorId, direction, Date.now()]
    )
    await pool.query('UPDATE aura_farm_comments SET vote_count = vote_count + $1 WHERE id = $2', [delta, commentId])
  }

  const updatedResult = await pool.query('SELECT vote_count FROM aura_farm_comments WHERE id = $1', [commentId])
  const updated = updatedResult.rows.length > 0 ? updatedResult.rows[0] as any : null

  return c.json({
    commentId,
    voteCount: updated?.vote_count || 0,
  })
})

app.get('/:id/comments/votes', async (c) => {
  const farmId = c.req.param('id')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const commentsResult = await pool.query('SELECT id FROM aura_farm_comments WHERE farm_id = $1', [farmId])
  const commentIds = commentsResult.rows.map((c: any) => c.id)

  if (commentIds.length === 0) {
    return c.json([])
  }

  const placeholders = commentIds.map((_: any, i: number) => `$${i + 2}`).join(',')
  const result = await pool.query(
    `SELECT * FROM aura_farm_comment_votes WHERE visitor_id = $1 AND comment_id IN (${placeholders})`,
    [visitorId, ...commentIds]
  )

  return c.json(result.rows.map((v: any) => ({
    commentId: v.comment_id,
    direction: v.direction,
  })))
})

export default app
