import { Hono } from 'hono'
import { pool } from '../db/index.js'
import type { DbEvent, DbEventParticipant, DbEventVote, DbSession, DbPlayer, DbSubEvent, DbSubEventParticipant, DbSubEventVote, DbSubEventComment } from '../db/index.js'
import { createNotification, extractMentions, findUsersByUsernames } from './notifications.js'

async function initEventsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_events (
      id TEXT PRIMARY KEY,
      leaderboard_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      image_url TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_participants (
      id TEXT PRIMARY KEY,
      sub_event_id TEXT NOT NULL,
      leaderboard_participant_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_votes (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      sub_event_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_comments (
      id TEXT PRIMARY KEY,
      sub_event_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      username TEXT,
      content TEXT NOT NULL,
      parent_id TEXT,
      vote_count INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      user_id TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  // Backfill columns for databases created from older Postgres schema.
  await pool.query(`ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS username TEXT`)
  await pool.query(`ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS parent_id TEXT`)
  await pool.query(`ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0`)
  await pool.query(`ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS image_url TEXT`)
  await pool.query(`ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS user_id TEXT`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_comment_votes (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `)
}

initEventsTables().catch(console.error)

const app = new Hono()

const DEFAULT_UPVOTES = 20
const DEFAULT_DOWNVOTES = 10

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

function generateId(): string {
  return crypto.randomUUID()
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function getUserIdFromSession(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null
  const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId])
  if (result.rows.length === 0) return null
  const session = result.rows[0] as DbSession
  if (new Date(session.expires_at) < new Date()) return null
  return session.user_id
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
  let query = 'SELECT * FROM events WHERE is_public = true'
  const params: string[] = []
  let paramIndex = 1

  if (search) {
    query += ` AND name ILIKE $${paramIndex++}`
    params.push(`%${search}%`)
  }
  query += ' ORDER BY created_at DESC'

  const result = await pool.query(query, params)
  const events = result.rows as DbEvent[]

  const mapped = await Promise.all(events.map(async (e) => {
    const ownerName = await getOwnerName(e.owner_id)
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      gameId: e.game_id,
      ownerId: e.owner_id,
      ownerName,
      isPublic: Boolean(e.is_public),
      description: (e as any).description || null,
      imageUrl: (e as any).image_url || null,
      createdAt: e.created_at,
    }
  }))

  return c.json(mapped)
})

app.get('/my', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const result = await pool.query('SELECT * FROM events WHERE owner_id = $1 ORDER BY created_at DESC', [userId])
  const events = result.rows as DbEvent[]

  const mapped = await Promise.all(events.map(async (e) => {
    const ownerName = await getOwnerName(e.owner_id)
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      gameId: e.game_id,
      ownerId: e.owner_id,
      ownerName,
      isPublic: Boolean(e.is_public),
      description: (e as any).description || null,
      imageUrl: (e as any).image_url || null,
      createdAt: e.created_at,
    }
  }))

  return c.json(mapped)
})

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [id])
  
  if (eventResult.rows.length === 0) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const event = eventResult.rows[0] as DbEvent
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!event.is_public && event.owner_id !== userId) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const participantsResult = await pool.query(
    'SELECT * FROM event_participants WHERE event_id = $1 ORDER BY aura_score DESC',
    [id]
  )
  const participants = participantsResult.rows as DbEventParticipant[]

  const participantsWithDetails = await Promise.all(participants.map(async (p) => {
    let playerData = null
    if (p.player_id) {
      const playerResult = await pool.query('SELECT * FROM players WHERE id = $1', [p.player_id])
      if (playerResult.rows.length > 0) {
        const player = playerResult.rows[0] as DbPlayer
        playerData = {
          id: player.id,
          name: player.name,
          slug: player.slug,
          globalAuraScore: player.aura_score,
        }
      }
    }
    return {
      id: p.id,
      eventId: p.event_id,
      playerId: p.player_id,
      tempName: p.temp_name,
      auraScore: p.aura_score,
      player: playerData,
      createdAt: p.created_at,
    }
  }))

  const ownerName = await getOwnerName(event.owner_id)

  return c.json({
    id: event.id,
    name: event.name,
    slug: event.slug,
    gameId: event.game_id,
    ownerId: event.owner_id,
    ownerName,
    isPublic: Boolean(event.is_public),
    description: (event as any).description || null,
    imageUrl: (event as any).image_url || null,
    createdAt: event.created_at,
    participants: participantsWithDetails,
  })
})

app.post('/', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json()
  const { name, gameId, isPublic, participants, description, imageUrl } = body

  if (!name || !gameId) {
    return c.json({ error: 'Name and game are required' }, 400)
  }

  const eventId = generateId()
  const slug = generateSlug(name)
  const now = new Date()
  const nowIso = now.toISOString()

  await pool.query(
    'INSERT INTO events (id, name, slug, game_id, owner_id, is_public, description, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [eventId, name, slug, gameId, userId, !!isPublic, description || null, imageUrl || null, nowIso]
  )

  if (participants && Array.isArray(participants)) {
    for (const p of participants) {
      const participantId = generateId()
      await pool.query(
        'INSERT INTO event_participants (id, event_id, player_id, temp_name, aura_score, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [participantId, eventId, p.playerId || null, p.tempName || null, 0, nowIso]
      )
    }
  }

  return c.json({
    id: eventId,
    name,
    slug,
    gameId,
    ownerId: userId,
    isPublic: !!isPublic,
    description: description || null,
    imageUrl: imageUrl || null,
    createdAt: now,
  })
})

app.patch('/:id', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [id])

  if (eventResult.rows.length === 0) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const event = eventResult.rows[0] as DbEvent
  if (event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { name, isPublic, description, imageUrl } = body

  if (name) {
    await pool.query('UPDATE events SET name = $1, slug = $2 WHERE id = $3', [name, generateSlug(name), id])
  }
  if (isPublic !== undefined) {
    await pool.query('UPDATE events SET is_public = $1 WHERE id = $2', [!!isPublic, id])
  }
  if (description !== undefined) {
    await pool.query('UPDATE events SET description = $1 WHERE id = $2', [description || null, id])
  }
  if (imageUrl !== undefined) {
    await pool.query('UPDATE events SET image_url = $1 WHERE id = $2', [imageUrl || null, id])
  }

  const updatedResult = await pool.query('SELECT * FROM events WHERE id = $1', [id])
  const updated = updatedResult.rows[0] as DbEvent

  return c.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    gameId: updated.game_id,
    ownerId: updated.owner_id,
    isPublic: Boolean(updated.is_public),
    description: (updated as any).description || null,
    imageUrl: (updated as any).image_url || null,
    createdAt: updated.created_at,
  })
})

app.delete('/:id', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [id])

  if (eventResult.rows.length === 0) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const event = eventResult.rows[0] as DbEvent
  if (event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  await pool.query('DELETE FROM event_votes WHERE event_id = $1', [id])
  await pool.query('DELETE FROM event_participants WHERE event_id = $1', [id])
  await pool.query('DELETE FROM events WHERE id = $1', [id])

  return c.json({ success: true })
})

app.post('/:id/participants', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const eventId = c.req.param('id')
  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])

  if (eventResult.rows.length === 0 || (eventResult.rows[0] as DbEvent).owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { playerId, tempName } = body

  if (!playerId && !tempName) {
    return c.json({ error: 'Player or temp name required' }, 400)
  }

  const participantId = generateId()
  const now = new Date()

  await pool.query(
    'INSERT INTO event_participants (id, event_id, player_id, temp_name, aura_score, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [participantId, eventId, playerId || null, tempName || null, 0, now.toISOString()]
  )

  return c.json({
    id: participantId,
    eventId,
    playerId,
    tempName,
    auraScore: 0,
    createdAt: now,
  })
})

app.delete('/:id/participants/:participantId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const eventId = c.req.param('id')
  const participantId = c.req.param('participantId')

  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
  if (eventResult.rows.length === 0 || (eventResult.rows[0] as DbEvent).owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const participantResult = await pool.query('SELECT * FROM event_participants WHERE id = $1', [participantId])
  if (participantResult.rows.length > 0) {
    const participant = participantResult.rows[0] as DbEventParticipant
    if (participant.player_id && participant.aura_score !== 0) {
      await pool.query(
        'UPDATE players SET aura_score = ROUND((aura_score - $1)::numeric, 2) WHERE id = $2',
        [participant.aura_score, participant.player_id]
      )
    }
  }

  const subEventParticipantsResult = await pool.query(
    'SELECT id FROM sub_event_participants WHERE leaderboard_participant_id = $1',
    [participantId]
  )
  for (const sep of subEventParticipantsResult.rows as { id: string }[]) {
    await pool.query('DELETE FROM sub_event_votes WHERE participant_id = $1', [sep.id])
  }
  await pool.query('DELETE FROM sub_event_participants WHERE leaderboard_participant_id = $1', [participantId])
  await pool.query('DELETE FROM event_votes WHERE participant_id = $1', [participantId])
  await pool.query('DELETE FROM event_participants WHERE id = $1', [participantId])

  return c.json({ success: true })
})

app.post('/:id/vote', async (c) => {
  const eventId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId, participantId, direction, userId } = body

  if (!visitorId || !participantId || !direction) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId])
  if (eventResult.rows.length === 0) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const participantResult = await pool.query('SELECT * FROM event_participants WHERE id = $1 AND event_id = $2', [participantId, eventId])
  if (participantResult.rows.length === 0) {
    return c.json({ error: 'Participant not found' }, 404)
  }
  const participant = participantResult.rows[0] as DbEventParticipant

  // Prevent self-voting: check if voter is the participant
  if (participant.player_id) {
    // Check by visitorId
    const voterProfileResult = await pool.query(
      'SELECT player_id FROM user_profiles WHERE visitor_id = $1',
      [visitorId]
    )
    if (voterProfileResult.rows.length > 0) {
      const voterPlayerId = voterProfileResult.rows[0].player_id
      if (voterPlayerId && voterPlayerId === participant.player_id) {
        return c.json({ error: 'You cannot vote for yourself' }, 400)
      }
    }
    // Also check by userId if provided (for signed-in users)
    if (userId) {
      const userProfileResult = await pool.query(
        'SELECT player_id FROM user_profiles WHERE visitor_id = $1',
        [userId]
      )
      if (userProfileResult.rows.length > 0) {
        const userPlayerId = userProfileResult.rows[0].player_id
        if (userPlayerId && userPlayerId === participant.player_id) {
          return c.json({ error: 'You cannot vote for yourself' }, 400)
        }
      }
    }
  }

  const existingVoteResult = await pool.query(
    'SELECT * FROM event_votes WHERE visitor_id = $1 AND event_id = $2 AND participant_id = $3',
    [visitorId, eventId, participantId]
  )
  const existingVote = existingVoteResult.rows.length > 0 ? existingVoteResult.rows[0] as DbEventVote : null

  const credits = await getOrCreateCredits(visitorId)
  if (!existingVote) {
    if (direction === 'UP' && credits.upvotes_remaining <= 0) {
      return c.json({ error: 'No upvote credits remaining' }, 400)
    }
    if (direction === 'DOWN' && credits.downvotes_remaining <= 0) {
      return c.json({ error: 'No downvote credits remaining' }, 400)
    }
  }

  const delta = direction === 'UP' ? 1 : -1

  if (existingVote) {
    if (existingVote.direction === direction) {
      return c.json({ error: 'Already voted' }, 400)
    }
    await pool.query('UPDATE event_votes SET direction = $1, timestamp = $2 WHERE id = $3', [direction, new Date().toISOString(), existingVote.id])
    await pool.query('UPDATE event_participants SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta * 2, participantId])
    if (participant.player_id) {
      await pool.query('UPDATE players SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta * 2, participant.player_id])
    }
  } else {
    if (direction === 'UP') {
      await pool.query('UPDATE visitor_credits SET upvotes_remaining = upvotes_remaining - 1 WHERE visitor_id = $1', [visitorId])
    } else {
      await pool.query('UPDATE visitor_credits SET downvotes_remaining = downvotes_remaining - 1 WHERE visitor_id = $1', [visitorId])
    }

    const voteId = generateId()
    await pool.query(
      'INSERT INTO event_votes (id, visitor_id, event_id, participant_id, direction, "timestamp") VALUES ($1, $2, $3, $4, $5, $6)',
      [voteId, visitorId, eventId, participantId, direction, Date.now()]
    )
    await pool.query('UPDATE event_participants SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, participantId])
    if (participant.player_id) {
      await pool.query('UPDATE players SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, participant.player_id])
    }
  }

  const updatedResult = await pool.query('SELECT * FROM event_participants WHERE id = $1', [participantId])
  const updated = updatedResult.rows[0] as DbEventParticipant
  const updatedCredits = await getOrCreateCredits(visitorId)

  return c.json({
    participantId,
    auraScore: updated.aura_score,
    direction,
    credits: {
      upvotesRemaining: updatedCredits.upvotes_remaining,
      downvotesRemaining: updatedCredits.downvotes_remaining,
    },
  })
})

app.delete('/:id/vote', async (c) => {
  const eventId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId, participantId } = body

  const voteResult = await pool.query(
    'SELECT * FROM event_votes WHERE visitor_id = $1 AND event_id = $2 AND participant_id = $3',
    [visitorId, eventId, participantId]
  )
  if (voteResult.rows.length === 0) {
    return c.json({ error: 'Vote not found' }, 404)
  }
  const vote = voteResult.rows[0] as DbEventVote

  const participantResult = await pool.query('SELECT * FROM event_participants WHERE id = $1', [participantId])
  const participant = participantResult.rows.length > 0 ? participantResult.rows[0] as DbEventParticipant : null

  const delta = vote.direction === 'UP' ? -1 : 1

  await pool.query('DELETE FROM event_votes WHERE id = $1', [vote.id])
  await pool.query('UPDATE event_participants SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, participantId])

  if (participant?.player_id) {
    await pool.query('UPDATE players SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, participant.player_id])
  }

  const updatedResult = await pool.query('SELECT * FROM event_participants WHERE id = $1', [participantId])
  const updated = updatedResult.rows[0] as DbEventParticipant

  return c.json({
    participantId,
    auraScore: updated.aura_score,
  })
})

app.get('/:id/votes', async (c) => {
  const eventId = c.req.param('id')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const result = await pool.query(
    'SELECT * FROM event_votes WHERE visitor_id = $1 AND event_id = $2',
    [visitorId, eventId]
  )

  return c.json(result.rows.map(v => {
    const vote = v as DbEventVote
    return {
      participantId: vote.participant_id,
      direction: vote.direction,
    }
  }))
})

app.get('/:id/sub-events', async (c) => {
  const leaderboardId = c.req.param('id')
  const result = await pool.query(
    'SELECT * FROM sub_events WHERE leaderboard_id = $1 ORDER BY created_at DESC',
    [leaderboardId]
  )

  return c.json(result.rows.map(se => {
    const subEvent = se as DbSubEvent
    return {
      id: subEvent.id,
      leaderboardId: subEvent.leaderboard_id,
      name: subEvent.name,
      slug: subEvent.slug,
      imageUrl: subEvent.image_url,
      createdAt: subEvent.created_at,
    }
  }))
})

app.get('/:id/sub-events/:subEventId', async (c) => {
  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const subEventResult = await pool.query(
    'SELECT * FROM sub_events WHERE id = $1 AND leaderboard_id = $2',
    [subEventId, leaderboardId]
  )
  if (subEventResult.rows.length === 0) {
    return c.json({ error: 'Sub-event not found' }, 404)
  }
  const subEvent = subEventResult.rows[0] as DbSubEvent

  const participantsResult = await pool.query(
    'SELECT * FROM sub_event_participants WHERE sub_event_id = $1 ORDER BY aura_score DESC',
    [subEventId]
  )

  const participantsWithDetails = await Promise.all((participantsResult.rows as DbSubEventParticipant[]).map(async (p) => {
    const leaderboardParticipantResult = await pool.query(
      'SELECT * FROM event_participants WHERE id = $1',
      [p.leaderboard_participant_id]
    )
    const leaderboardParticipant = leaderboardParticipantResult.rows.length > 0 ? leaderboardParticipantResult.rows[0] as DbEventParticipant : null

    let playerData = null
    let tempName: string | null = null

    if (leaderboardParticipant) {
      tempName = leaderboardParticipant.temp_name || null
      if (leaderboardParticipant.player_id) {
        const playerResult = await pool.query('SELECT * FROM players WHERE id = $1', [leaderboardParticipant.player_id])
        if (playerResult.rows.length > 0) {
          const player = playerResult.rows[0] as DbPlayer
          playerData = {
            id: player.id,
            name: player.name,
            slug: player.slug,
            globalAuraScore: player.aura_score,
          }
        }
      }
    } else {
      tempName = 'Removed Participant'
    }

    return {
      id: p.id,
      subEventId: p.sub_event_id,
      leaderboardParticipantId: p.leaderboard_participant_id,
      auraScore: p.aura_score,
      tempName,
      player: playerData,
      createdAt: p.created_at,
    }
  }))

  const commentsResult = await pool.query(
    'SELECT * FROM sub_event_comments WHERE sub_event_id = $1 ORDER BY created_at DESC',
    [subEventId]
  )

  return c.json({
    id: subEvent.id,
    leaderboardId: subEvent.leaderboard_id,
    name: subEvent.name,
    slug: subEvent.slug,
    imageUrl: subEvent.image_url,
    createdAt: subEvent.created_at,
    participants: participantsWithDetails,
    comments: commentsResult.rows.map(c => {
      const comment = c as DbSubEventComment
      return {
        id: comment.id,
        subEventId: comment.sub_event_id,
        visitorId: comment.visitor_id,
        userId: comment.user_id || null,
        username: comment.username || 'Anonymous',
        content: comment.content,
        parentId: comment.parent_id || null,
        voteCount: comment.vote_count || 0,
        imageUrl: comment.image_url || null,
        createdAt: comment.created_at,
      }
    }),
  })
})

app.post('/:id/sub-events', async (c) => {
  try {
    const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
    const userId = await getUserIdFromSession(sessionId)

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const leaderboardId = c.req.param('id')
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [leaderboardId])

    if (eventResult.rows.length === 0 || (eventResult.rows[0] as DbEvent).owner_id !== userId) {
      return c.json({ error: 'Not authorized' }, 403)
    }

    const body = await c.req.json()
    const { name, participantIds, imageUrl } = body

    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    const subEventId = generateId()
    const slug = generateSlug(name)
    const now = new Date()
    const nowIso = now.toISOString()

    await pool.query(
      'INSERT INTO sub_events (id, leaderboard_id, name, slug, image_url, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [subEventId, leaderboardId, name, slug, imageUrl || null, nowIso]
    )

    if (participantIds && Array.isArray(participantIds)) {
      for (const participantId of participantIds) {
        const existingResult = await pool.query(
          'SELECT * FROM event_participants WHERE id = $1 AND event_id = $2',
          [participantId, leaderboardId]
        )
        if (existingResult.rows.length > 0) {
          const subParticipantId = generateId()
          await pool.query(
            'INSERT INTO sub_event_participants (id, sub_event_id, leaderboard_participant_id, aura_score, created_at) VALUES ($1, $2, $3, $4, $5)',
            [subParticipantId, subEventId, participantId, 0, nowIso]
          )
        }
      }
    }

    return c.json({
      id: subEventId,
      leaderboardId,
      name,
      slug,
      imageUrl: imageUrl || null,
      createdAt: now,
    })
  } catch (err) {
    console.error('Failed to create sub-event:', err)
    return c.json({ error: 'Failed to create sub-event: ' + (err as Error).message }, 500)
  }
})

app.patch('/:id/sub-events/:subEventId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [leaderboardId])
  if (eventResult.rows.length === 0 || (eventResult.rows[0] as DbEvent).owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { name, imageUrl } = body

  if (name !== undefined && name.trim()) {
    await pool.query('UPDATE sub_events SET name = $1, slug = $2 WHERE id = $3', [name.trim(), generateSlug(name.trim()), subEventId])
  }
  if (imageUrl !== undefined) {
    await pool.query('UPDATE sub_events SET image_url = $1 WHERE id = $2', [imageUrl, subEventId])
  }

  const updatedResult = await pool.query('SELECT * FROM sub_events WHERE id = $1', [subEventId])
  const updated = updatedResult.rows[0] as DbSubEvent

  return c.json({
    id: updated.id,
    leaderboardId: updated.leaderboard_id,
    name: updated.name,
    slug: updated.slug,
    imageUrl: updated.image_url,
    createdAt: updated.created_at,
  })
})

app.delete('/:id/sub-events/:subEventId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [leaderboardId])
  if (eventResult.rows.length === 0 || (eventResult.rows[0] as DbEvent).owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const subParticipantsResult = await pool.query(
    'SELECT * FROM sub_event_participants WHERE sub_event_id = $1',
    [subEventId]
  )

  for (const sp of subParticipantsResult.rows as DbSubEventParticipant[]) {
    if (sp.aura_score !== 0) {
      const leaderboardParticipantResult = await pool.query(
        'SELECT * FROM event_participants WHERE id = $1',
        [sp.leaderboard_participant_id]
      )
      const leaderboardParticipant = leaderboardParticipantResult.rows.length > 0 ? leaderboardParticipantResult.rows[0] as DbEventParticipant : null

      await pool.query(
        'UPDATE event_participants SET aura_score = ROUND((aura_score - $1)::numeric, 2) WHERE id = $2',
        [sp.aura_score, sp.leaderboard_participant_id]
      )

      if (leaderboardParticipant?.player_id) {
        await pool.query(
          'UPDATE players SET aura_score = ROUND((aura_score - $1)::numeric, 2) WHERE id = $2',
          [sp.aura_score, leaderboardParticipant.player_id]
        )
      }
    }
  }

  await pool.query('DELETE FROM sub_event_votes WHERE sub_event_id = $1', [subEventId])
  await pool.query('DELETE FROM sub_event_participants WHERE sub_event_id = $1', [subEventId])
  await pool.query('DELETE FROM sub_events WHERE id = $1', [subEventId])

  return c.json({ success: true })
})

app.post('/:id/sub-events/:subEventId/participants', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [leaderboardId])
  if (eventResult.rows.length === 0 || (eventResult.rows[0] as DbEvent).owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { leaderboardParticipantId } = body

  const leaderboardParticipantResult = await pool.query(
    'SELECT * FROM event_participants WHERE id = $1 AND event_id = $2',
    [leaderboardParticipantId, leaderboardId]
  )
  if (leaderboardParticipantResult.rows.length === 0) {
    return c.json({ error: 'Participant not found in leaderboard' }, 404)
  }

  const existingResult = await pool.query(
    'SELECT * FROM sub_event_participants WHERE sub_event_id = $1 AND leaderboard_participant_id = $2',
    [subEventId, leaderboardParticipantId]
  )
  if (existingResult.rows.length > 0) {
    return c.json({ error: 'Participant already in sub-event' }, 400)
  }

  const participantId = generateId()
  const now = new Date()

  await pool.query(
    'INSERT INTO sub_event_participants (id, sub_event_id, leaderboard_participant_id, aura_score, created_at) VALUES ($1, $2, $3, $4, $5)',
    [participantId, subEventId, leaderboardParticipantId, 0, now.toISOString()]
  )

  return c.json({
    id: participantId,
    subEventId,
    leaderboardParticipantId,
    auraScore: 0,
    createdAt: now,
  })
})

app.delete('/:id/sub-events/:subEventId/participants/:participantId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = await getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')
  const participantId = c.req.param('participantId')

  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [leaderboardId])
  if (eventResult.rows.length === 0 || (eventResult.rows[0] as DbEvent).owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const subParticipantResult = await pool.query(
    'SELECT * FROM sub_event_participants WHERE id = $1 AND sub_event_id = $2',
    [participantId, subEventId]
  )
  if (subParticipantResult.rows.length === 0) {
    return c.json({ error: 'Participant not found' }, 404)
  }
  const subParticipant = subParticipantResult.rows[0] as DbSubEventParticipant

  if (subParticipant.aura_score !== 0) {
    const leaderboardParticipantResult = await pool.query(
      'SELECT * FROM event_participants WHERE id = $1',
      [subParticipant.leaderboard_participant_id]
    )
    const leaderboardParticipant = leaderboardParticipantResult.rows.length > 0 ? leaderboardParticipantResult.rows[0] as DbEventParticipant : null

    await pool.query(
      'UPDATE event_participants SET aura_score = ROUND((aura_score - $1)::numeric, 2) WHERE id = $2',
      [subParticipant.aura_score, subParticipant.leaderboard_participant_id]
    )

    if (leaderboardParticipant?.player_id) {
      await pool.query(
        'UPDATE players SET aura_score = ROUND((aura_score - $1)::numeric, 2) WHERE id = $2',
        [subParticipant.aura_score, leaderboardParticipant.player_id]
      )
    }
  }

  await pool.query('DELETE FROM sub_event_votes WHERE participant_id = $1', [participantId])
  await pool.query('DELETE FROM sub_event_participants WHERE id = $1', [participantId])

  return c.json({ success: true })
})

app.post('/:id/sub-events/:subEventId/vote', async (c) => {
  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')
  const body = await c.req.json()
  const { visitorId, participantId, direction, userId } = body

  if (!visitorId || !participantId || !direction) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const subEventResult = await pool.query(
    'SELECT * FROM sub_events WHERE id = $1 AND leaderboard_id = $2',
    [subEventId, leaderboardId]
  )
  if (subEventResult.rows.length === 0) {
    return c.json({ error: 'Sub-event not found' }, 404)
  }

  const subParticipantResult = await pool.query(
    'SELECT * FROM sub_event_participants WHERE id = $1 AND sub_event_id = $2',
    [participantId, subEventId]
  )
  if (subParticipantResult.rows.length === 0) {
    return c.json({ error: 'Participant not found' }, 404)
  }
  const subParticipant = subParticipantResult.rows[0] as DbSubEventParticipant

  // Get the participant's player_id from the leaderboard participant
  const leaderboardParticipantCheck = await pool.query(
    'SELECT player_id FROM event_participants WHERE id = $1',
    [subParticipant.leaderboard_participant_id]
  )
  const participantPlayerId = leaderboardParticipantCheck.rows.length > 0
    ? leaderboardParticipantCheck.rows[0].player_id
    : null

  if (participantPlayerId) {
    // Prevent self-voting: check by visitorId
    const voterProfileResult = await pool.query(
      'SELECT player_id FROM user_profiles WHERE visitor_id = $1',
      [visitorId]
    )
    if (voterProfileResult.rows.length > 0) {
      const voterPlayerId = voterProfileResult.rows[0].player_id
      if (voterPlayerId && voterPlayerId === participantPlayerId) {
        return c.json({ error: 'You cannot vote for yourself' }, 400)
      }
    }
    // Also check by userId if provided (for signed-in users)
    if (userId) {
      const userProfileResult = await pool.query(
        'SELECT player_id FROM user_profiles WHERE visitor_id = $1',
        [userId]
      )
      if (userProfileResult.rows.length > 0) {
        const userPlayerId = userProfileResult.rows[0].player_id
        if (userPlayerId && userPlayerId === participantPlayerId) {
          return c.json({ error: 'You cannot vote for yourself' }, 400)
        }
      }
    }
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

  const leaderboardParticipantResult = await pool.query(
    'SELECT * FROM event_participants WHERE id = $1',
    [subParticipant.leaderboard_participant_id]
  )
  const leaderboardParticipant = leaderboardParticipantResult.rows.length > 0 ? leaderboardParticipantResult.rows[0] as DbEventParticipant : null

  const delta = direction === 'UP' ? 1 : -1

  const voteId = generateId()
  await pool.query(
    'INSERT INTO sub_event_votes (id, visitor_id, sub_event_id, participant_id, direction, "timestamp") VALUES ($1, $2, $3, $4, $5, $6)',
    [voteId, visitorId, subEventId, participantId, direction, Date.now()]
  )
  await pool.query('UPDATE sub_event_participants SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, participantId])
  await pool.query('UPDATE event_participants SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, subParticipant.leaderboard_participant_id])

  if (leaderboardParticipant?.player_id) {
    await pool.query('UPDATE players SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, leaderboardParticipant.player_id])
  }

  const updatedResult = await pool.query('SELECT * FROM sub_event_participants WHERE id = $1', [participantId])
  const updated = updatedResult.rows[0] as DbSubEventParticipant
  const updatedCredits = await getOrCreateCredits(visitorId)

  return c.json({
    participantId,
    auraScore: updated.aura_score,
    credits: {
      upvotesRemaining: updatedCredits.upvotes_remaining,
      downvotesRemaining: updatedCredits.downvotes_remaining,
    },
    direction,
  })
})

app.delete('/:id/sub-events/:subEventId/vote', async (c) => {
  const subEventId = c.req.param('subEventId')
  const body = await c.req.json()
  const { visitorId, participantId } = body

  const voteResult = await pool.query(
    'SELECT * FROM sub_event_votes WHERE visitor_id = $1 AND sub_event_id = $2 AND participant_id = $3',
    [visitorId, subEventId, participantId]
  )
  if (voteResult.rows.length === 0) {
    return c.json({ error: 'Vote not found' }, 404)
  }
  const vote = voteResult.rows[0] as DbSubEventVote

  const subParticipantResult = await pool.query('SELECT * FROM sub_event_participants WHERE id = $1', [participantId])
  const subParticipant = subParticipantResult.rows.length > 0 ? subParticipantResult.rows[0] as DbSubEventParticipant : null

  const leaderboardParticipantResult = subParticipant ? await pool.query(
    'SELECT * FROM event_participants WHERE id = $1',
    [subParticipant.leaderboard_participant_id]
  ) : { rows: [] }
  const leaderboardParticipant = leaderboardParticipantResult.rows.length > 0 ? leaderboardParticipantResult.rows[0] as DbEventParticipant : null

  const delta = vote.direction === 'UP' ? -1 : 1

  await pool.query('DELETE FROM sub_event_votes WHERE id = $1', [vote.id])
  await pool.query('UPDATE sub_event_participants SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, participantId])

  if (subParticipant) {
    await pool.query('UPDATE event_participants SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, subParticipant.leaderboard_participant_id])
  }

  if (leaderboardParticipant?.player_id) {
    await pool.query('UPDATE players SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2', [delta, leaderboardParticipant.player_id])
  }

  const updatedResult = await pool.query('SELECT * FROM sub_event_participants WHERE id = $1', [participantId])
  const updated = updatedResult.rows[0] as DbSubEventParticipant

  return c.json({
    participantId,
    auraScore: updated.aura_score,
  })
})

app.get('/:id/sub-events/:subEventId/votes', async (c) => {
  const subEventId = c.req.param('subEventId')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const result = await pool.query(
    'SELECT * FROM sub_event_votes WHERE visitor_id = $1 AND sub_event_id = $2',
    [visitorId, subEventId]
  )

  return c.json(result.rows.map(v => {
    const vote = v as DbSubEventVote
    return {
      participantId: vote.participant_id,
      direction: vote.direction,
    }
  }))
})

app.post('/:id/sub-events/:subEventId/comments', async (c) => {
  const eventId = c.req.param('id')
  const subEventId = c.req.param('subEventId')
  const body = await c.req.json()
  const { visitorId, content, username, parentId, imageUrl, userId } = body

  if (!visitorId || (!content?.trim() && !imageUrl)) {
    return c.json({ error: 'Visitor ID and content or image are required' }, 400)
  }

  const commentId = generateId()
  const now = new Date()
  const trimmedContent = content?.trim() || ''

  await pool.query(
    'INSERT INTO sub_event_comments (id, sub_event_id, visitor_id, username, content, parent_id, vote_count, image_url, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [commentId, subEventId, visitorId, username || 'Anonymous', trimmedContent, parentId || null, 0, imageUrl || null, userId || null, now.toISOString()]
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
            sourceType: 'sub_event_comment',
            sourceId: commentId,
            sourceUrl: `/events/${eventId}?subEvent=${subEventId}`,
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
    subEventId,
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

app.post('/:id/sub-events/:subEventId/comments/:commentId/vote', async (c) => {
  try {
    const commentId = c.req.param('commentId')
    const body = await c.req.json()
    const { visitorId, direction } = body

    if (!visitorId || !direction) {
      return c.json({ error: 'Visitor ID and direction are required' }, 400)
    }

    const existingVoteResult = await pool.query(
      'SELECT * FROM sub_event_comment_votes WHERE comment_id = $1 AND visitor_id = $2',
      [commentId, visitorId]
    )
    const existingVote = existingVoteResult.rows.length > 0 ? existingVoteResult.rows[0] as any : null

    const delta = direction === 'UP' ? 1 : -1

    if (existingVote) {
      if (existingVote.direction === direction) {
        await pool.query('DELETE FROM sub_event_comment_votes WHERE id = $1', [existingVote.id])
        await pool.query('UPDATE sub_event_comments SET vote_count = vote_count - $1 WHERE id = $2', [delta, commentId])
      } else {
        await pool.query('UPDATE sub_event_comment_votes SET direction = $1 WHERE id = $2', [direction, existingVote.id])
        await pool.query('UPDATE sub_event_comments SET vote_count = vote_count + $1 WHERE id = $2', [delta * 2, commentId])
      }
    } else {
      const voteId = generateId()
      await pool.query(
        'INSERT INTO sub_event_comment_votes (id, comment_id, visitor_id, direction, "timestamp") VALUES ($1, $2, $3, $4, $5)',
        [voteId, commentId, visitorId, direction, Date.now()]
      )
      await pool.query('UPDATE sub_event_comments SET vote_count = vote_count + $1 WHERE id = $2', [delta, commentId])
    }

    const updatedResult = await pool.query('SELECT vote_count FROM sub_event_comments WHERE id = $1', [commentId])
    const updated = updatedResult.rows.length > 0 ? updatedResult.rows[0] as any : null

    return c.json({
      commentId,
      voteCount: updated?.vote_count || 0,
    })
  } catch (error) {
    console.error('Comment vote error:', error)
    return c.json({ error: 'Failed to vote on comment' }, 500)
  }
})

app.get('/:id/sub-events/:subEventId/comments/votes', async (c) => {
  const subEventId = c.req.param('subEventId')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const commentsResult = await pool.query('SELECT id FROM sub_event_comments WHERE sub_event_id = $1', [subEventId])
  const commentIds = commentsResult.rows.map((c: any) => c.id)

  if (commentIds.length === 0) {
    return c.json([])
  }

  const placeholders = commentIds.map((_, i) => `$${i + 2}`).join(',')
  const result = await pool.query(
    `SELECT * FROM sub_event_comment_votes WHERE visitor_id = $1 AND comment_id IN (${placeholders})`,
    [visitorId, ...commentIds]
  )

  return c.json(result.rows.map((v: any) => ({
    commentId: v.comment_id,
    direction: v.direction,
  })))
})

app.delete('/:id/sub-events/:subEventId/comments/:commentId', async (c) => {
  const commentId = c.req.param('commentId')
  const body = await c.req.json()
  const { visitorId, userId } = body

  const commentResult = await pool.query('SELECT * FROM sub_event_comments WHERE id = $1', [commentId])
  if (commentResult.rows.length === 0) {
    return c.json({ error: 'Comment not found' }, 404)
  }
  const comment = commentResult.rows[0] as DbSubEventComment

  let canDelete = false
  if (comment.user_id) {
    canDelete = comment.user_id === userId
  } else {
    canDelete = comment.visitor_id === visitorId
  }

  if (!canDelete) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  await pool.query('DELETE FROM sub_event_comments WHERE id = $1', [commentId])

  return c.json({ success: true })
})

export default app
