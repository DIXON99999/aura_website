import { Hono } from 'hono'
import { db } from '../db/index.js'
import type { DbEvent, DbEventParticipant, DbEventVote, DbSession, DbPlayer, DbSubEvent, DbSubEventParticipant, DbSubEventVote, DbSubEventComment } from '../db/index.js'

// Ensure sub-event tables exist
db.run(`
  CREATE TABLE IF NOT EXISTS sub_events (
    id TEXT PRIMARY KEY,
    leaderboard_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    image_url TEXT,
    created_at INTEGER NOT NULL
  )
`)

// Add image_url column if it doesn't exist (migration for existing tables)
try {
  db.run(`ALTER TABLE sub_events ADD COLUMN image_url TEXT`)
} catch {
  // Column already exists, ignore
}

db.run(`
  CREATE TABLE IF NOT EXISTS sub_event_participants (
    id TEXT PRIMARY KEY,
    sub_event_id TEXT NOT NULL,
    leaderboard_participant_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sub_event_votes (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    sub_event_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sub_event_comments (
    id TEXT PRIMARY KEY,
    sub_event_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    username TEXT,
    content TEXT NOT NULL,
    parent_id TEXT,
    vote_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`)

// Add new columns if they don't exist (migration)
try { db.run(`ALTER TABLE sub_event_comments ADD COLUMN username TEXT`) } catch {}
try { db.run(`ALTER TABLE sub_event_comments ADD COLUMN parent_id TEXT`) } catch {}
try { db.run(`ALTER TABLE sub_event_comments ADD COLUMN vote_count INTEGER NOT NULL DEFAULT 0`) } catch {}

db.run(`
  CREATE TABLE IF NOT EXISTS sub_event_comment_votes (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`)

const app = new Hono()

function generateId(): string {
  return crypto.randomUUID()
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Auth helper
function getUserIdFromSession(sessionId: string | undefined): string | null {
  if (!sessionId) return null
  const session = db.query('SELECT * FROM sessions WHERE id = ?').get(sessionId) as DbSession | null
  if (!session || session.expires_at < Date.now()) return null
  return session.user_id
}

// GET /events - Get public events (with search)
app.get('/', async (c) => {
  const search = c.req.query('search')

  let query = 'SELECT * FROM events WHERE is_public = 1'
  const params: string[] = []

  if (search) {
    query += ' AND name LIKE ?'
    params.push(`%${search}%`)
  }

  query += ' ORDER BY created_at DESC'

  const events = db.query(query).all(...params) as DbEvent[]

  return c.json(events.map(e => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    gameId: e.game_id,
    ownerId: e.owner_id,
    isPublic: e.is_public === 1,
    createdAt: new Date(e.created_at),
  })))
})

// GET /events/my - Get user's events
app.get('/my', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const events = db.query('SELECT * FROM events WHERE owner_id = ? ORDER BY created_at DESC').all(userId) as DbEvent[]

  return c.json(events.map(e => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    gameId: e.game_id,
    ownerId: e.owner_id,
    isPublic: e.is_public === 1,
    createdAt: new Date(e.created_at),
  })))
})

// GET /events/:id - Get event with participants
app.get('/:id', async (c) => {
  const id = c.req.param('id')

  const event = db.query('SELECT * FROM events WHERE id = ?').get(id) as DbEvent | null
  if (!event) {
    return c.json({ error: 'Event not found' }, 404)
  }

  // Check if private and user is not owner
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!event.is_public && event.owner_id !== userId) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const participants = db.query(
    'SELECT * FROM event_participants WHERE event_id = ? ORDER BY aura_score DESC'
  ).all(id) as DbEventParticipant[]

  // Get player details for real players
  const participantsWithDetails = participants.map(p => {
    let playerData = null
    if (p.player_id) {
      const player = db.query('SELECT * FROM players WHERE id = ?').get(p.player_id) as DbPlayer | null
      if (player) {
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
      createdAt: new Date(p.created_at),
    }
  })

  return c.json({
    id: event.id,
    name: event.name,
    slug: event.slug,
    gameId: event.game_id,
    ownerId: event.owner_id,
    isPublic: event.is_public === 1,
    createdAt: new Date(event.created_at),
    participants: participantsWithDetails,
  })
})

// POST /events - Create event
app.post('/', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json()
  const { name, gameId, isPublic, participants } = body

  if (!name || !gameId) {
    return c.json({ error: 'Name and game are required' }, 400)
  }

  const eventId = generateId()
  const slug = generateSlug(name)
  const now = Date.now()

  db.run(
    'INSERT INTO events (id, name, slug, game_id, owner_id, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    eventId, name, slug, gameId, userId, isPublic ? 1 : 0, now
  )

  // Add participants
  if (participants && Array.isArray(participants)) {
    for (const p of participants) {
      const participantId = generateId()
      db.run(
        'INSERT INTO event_participants (id, event_id, player_id, temp_name, aura_score, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        participantId, eventId, p.playerId || null, p.tempName || null, 0, now
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
    createdAt: new Date(now),
  })
})

// PATCH /events/:id - Update event
app.patch('/:id', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const event = db.query('SELECT * FROM events WHERE id = ?').get(id) as DbEvent | null

  if (!event) {
    return c.json({ error: 'Event not found' }, 404)
  }

  if (event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { name, isPublic } = body

  if (name) {
    db.run('UPDATE events SET name = ?, slug = ? WHERE id = ?', name, generateSlug(name), id)
  }

  if (isPublic !== undefined) {
    db.run('UPDATE events SET is_public = ? WHERE id = ?', isPublic ? 1 : 0, id)
  }

  const updated = db.query('SELECT * FROM events WHERE id = ?').get(id) as DbEvent

  return c.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    gameId: updated.game_id,
    ownerId: updated.owner_id,
    isPublic: updated.is_public === 1,
    createdAt: new Date(updated.created_at),
  })
})

// DELETE /events/:id - Delete event
app.delete('/:id', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const event = db.query('SELECT * FROM events WHERE id = ?').get(id) as DbEvent | null

  if (!event) {
    return c.json({ error: 'Event not found' }, 404)
  }

  if (event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  // Delete votes, participants, then event
  db.run('DELETE FROM event_votes WHERE event_id = ?', id)
  db.run('DELETE FROM event_participants WHERE event_id = ?', id)
  db.run('DELETE FROM events WHERE id = ?', id)

  return c.json({ success: true })
})

// POST /events/:id/participants - Add participant
app.post('/:id/participants', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const eventId = c.req.param('id')
  const event = db.query('SELECT * FROM events WHERE id = ?').get(eventId) as DbEvent | null

  if (!event || event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { playerId, tempName } = body

  if (!playerId && !tempName) {
    return c.json({ error: 'Player or temp name required' }, 400)
  }

  const participantId = generateId()
  const now = Date.now()

  db.run(
    'INSERT INTO event_participants (id, event_id, player_id, temp_name, aura_score, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    participantId, eventId, playerId || null, tempName || null, 0, now
  )

  return c.json({
    id: participantId,
    eventId,
    playerId,
    tempName,
    auraScore: 0,
    createdAt: new Date(now),
  })
})

// DELETE /events/:id/participants/:participantId - Remove participant
app.delete('/:id/participants/:participantId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const eventId = c.req.param('id')
  const participantId = c.req.param('participantId')

  const event = db.query('SELECT * FROM events WHERE id = ?').get(eventId) as DbEvent | null

  if (!event || event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  // Get participant to check if it's a real player
  const participant = db.query('SELECT * FROM event_participants WHERE id = ?').get(participantId) as DbEventParticipant | null

  if (participant?.player_id && participant.aura_score !== 0) {
    // Subtract event aura from player's global score
    db.run(
      'UPDATE players SET aura_score = ROUND(aura_score - ?, 2) WHERE id = ?',
      participant.aura_score, participant.player_id
    )
  }

  // Delete votes for this participant
  db.run('DELETE FROM event_votes WHERE participant_id = ?', participantId)
  db.run('DELETE FROM event_participants WHERE id = ?', participantId)

  return c.json({ success: true })
})

// POST /events/:id/vote - Vote on participant
app.post('/:id/vote', async (c) => {
  const eventId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId, participantId, direction } = body

  if (!visitorId || !participantId || !direction) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const event = db.query('SELECT * FROM events WHERE id = ?').get(eventId) as DbEvent | null
  if (!event) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const participant = db.query('SELECT * FROM event_participants WHERE id = ? AND event_id = ?').get(participantId, eventId) as DbEventParticipant | null
  if (!participant) {
    return c.json({ error: 'Participant not found' }, 404)
  }

  // Check existing vote
  const existingVote = db.query(
    'SELECT * FROM event_votes WHERE visitor_id = ? AND event_id = ? AND participant_id = ?'
  ).get(visitorId, eventId, participantId) as DbEventVote | null

  const delta = direction === 'UP' ? 1 : -1

  if (existingVote) {
    if (existingVote.direction === direction) {
      return c.json({ error: 'Already voted' }, 400)
    }
    // Change vote direction - double the delta
    db.run('UPDATE event_votes SET direction = ?, timestamp = ? WHERE id = ?', direction, Date.now(), existingVote.id)
    db.run('UPDATE event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta * 2, participantId)

    // Update player global score if real player
    if (participant.player_id) {
      db.run('UPDATE players SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta * 2, participant.player_id)
    }
  } else {
    // New vote
    const voteId = generateId()
    db.run(
      'INSERT INTO event_votes (id, visitor_id, event_id, participant_id, direction, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      voteId, visitorId, eventId, participantId, direction, Date.now()
    )
    db.run('UPDATE event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, participantId)

    // Update player global score if real player
    if (participant.player_id) {
      db.run('UPDATE players SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, participant.player_id)
    }
  }

  const updated = db.query('SELECT * FROM event_participants WHERE id = ?').get(participantId) as DbEventParticipant

  return c.json({
    participantId,
    auraScore: updated.aura_score,
    direction,
  })
})

// DELETE /events/:id/vote - Remove vote
app.delete('/:id/vote', async (c) => {
  const eventId = c.req.param('id')
  const body = await c.req.json()
  const { visitorId, participantId } = body

  const vote = db.query(
    'SELECT * FROM event_votes WHERE visitor_id = ? AND event_id = ? AND participant_id = ?'
  ).get(visitorId, eventId, participantId) as DbEventVote | null

  if (!vote) {
    return c.json({ error: 'Vote not found' }, 404)
  }

  const participant = db.query('SELECT * FROM event_participants WHERE id = ?').get(participantId) as DbEventParticipant | null

  const delta = vote.direction === 'UP' ? -1 : 1

  db.run('DELETE FROM event_votes WHERE id = ?', vote.id)
  db.run('UPDATE event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, participantId)

  // Update player global score if real player
  if (participant?.player_id) {
    db.run('UPDATE players SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, participant.player_id)
  }

  const updated = db.query('SELECT * FROM event_participants WHERE id = ?').get(participantId) as DbEventParticipant

  return c.json({
    participantId,
    auraScore: updated.aura_score,
  })
})

// GET /events/:id/votes - Get visitor's votes for event
app.get('/:id/votes', async (c) => {
  const eventId = c.req.param('id')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const votes = db.query(
    'SELECT * FROM event_votes WHERE visitor_id = ? AND event_id = ?'
  ).all(visitorId, eventId) as DbEventVote[]

  return c.json(votes.map(v => ({
    participantId: v.participant_id,
    direction: v.direction,
  })))
})

// ==================== SUB-EVENTS ====================

// GET /events/:id/sub-events - Get sub-events for a leaderboard
app.get('/:id/sub-events', async (c) => {
  const leaderboardId = c.req.param('id')

  const subEvents = db.query(
    'SELECT * FROM sub_events WHERE leaderboard_id = ? ORDER BY created_at DESC'
  ).all(leaderboardId) as DbSubEvent[]

  return c.json(subEvents.map(se => ({
    id: se.id,
    leaderboardId: se.leaderboard_id,
    name: se.name,
    slug: se.slug,
    imageUrl: se.image_url,
    createdAt: new Date(se.created_at),
  })))
})

// GET /events/:id/sub-events/:subEventId - Get sub-event with participants
app.get('/:id/sub-events/:subEventId', async (c) => {
  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const subEvent = db.query(
    'SELECT * FROM sub_events WHERE id = ? AND leaderboard_id = ?'
  ).get(subEventId, leaderboardId) as DbSubEvent | null

  if (!subEvent) {
    return c.json({ error: 'Sub-event not found' }, 404)
  }

  const participants = db.query(
    'SELECT * FROM sub_event_participants WHERE sub_event_id = ? ORDER BY aura_score DESC'
  ).all(subEventId) as DbSubEventParticipant[]

  // Get leaderboard participant details
  const participantsWithDetails = participants.map(p => {
    const leaderboardParticipant = db.query(
      'SELECT * FROM event_participants WHERE id = ?'
    ).get(p.leaderboard_participant_id) as DbEventParticipant | null

    let playerData = null
    if (leaderboardParticipant?.player_id) {
      const player = db.query('SELECT * FROM players WHERE id = ?').get(leaderboardParticipant.player_id) as DbPlayer | null
      if (player) {
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
      subEventId: p.sub_event_id,
      leaderboardParticipantId: p.leaderboard_participant_id,
      auraScore: p.aura_score,
      tempName: leaderboardParticipant?.temp_name || null,
      player: playerData,
      createdAt: new Date(p.created_at),
    }
  })

  // Get comments
  const comments = db.query(
    'SELECT * FROM sub_event_comments WHERE sub_event_id = ? ORDER BY created_at DESC'
  ).all(subEventId) as DbSubEventComment[]

  return c.json({
    id: subEvent.id,
    leaderboardId: subEvent.leaderboard_id,
    name: subEvent.name,
    slug: subEvent.slug,
    imageUrl: subEvent.image_url,
    createdAt: new Date(subEvent.created_at),
    participants: participantsWithDetails,
    comments: comments.map(c => ({
      id: c.id,
      subEventId: c.sub_event_id,
      visitorId: c.visitor_id,
      username: c.username || 'Anonymous',
      content: c.content,
      parentId: c.parent_id || null,
      voteCount: c.vote_count || 0,
      createdAt: new Date(c.created_at),
    })),
  })
})

// POST /events/:id/sub-events - Create sub-event
app.post('/:id/sub-events', async (c) => {
  try {
    const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
    const userId = getUserIdFromSession(sessionId)

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const leaderboardId = c.req.param('id')
    const event = db.query('SELECT * FROM events WHERE id = ?').get(leaderboardId) as DbEvent | null

    if (!event || event.owner_id !== userId) {
      return c.json({ error: 'Not authorized' }, 403)
    }

    const body = await c.req.json()
    const { name, participantIds, imageUrl } = body

    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    const subEventId = generateId()
    const slug = generateSlug(name)
    const now = Date.now()

    db.run(
      'INSERT INTO sub_events (id, leaderboard_id, name, slug, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      subEventId, leaderboardId, name, slug, imageUrl || null, now
    )

    // Add participants (these are leaderboard participant IDs)
    if (participantIds && Array.isArray(participantIds)) {
      for (const participantId of participantIds) {
        // Verify participant belongs to this leaderboard
        const existing = db.query(
          'SELECT * FROM event_participants WHERE id = ? AND event_id = ?'
        ).get(participantId, leaderboardId)

        if (existing) {
          const subParticipantId = generateId()
          db.run(
            'INSERT INTO sub_event_participants (id, sub_event_id, leaderboard_participant_id, aura_score, created_at) VALUES (?, ?, ?, ?, ?)',
            subParticipantId, subEventId, participantId, 0, now
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
      createdAt: new Date(now),
    })
  } catch (err) {
    console.error('Failed to create sub-event:', err)
    return c.json({ error: 'Failed to create sub-event: ' + (err as Error).message }, 500)
  }
})

// PATCH /events/:id/sub-events/:subEventId - Update sub-event (name, image)
app.patch('/:id/sub-events/:subEventId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const event = db.query('SELECT * FROM events WHERE id = ?').get(leaderboardId) as DbEvent | null

  if (!event || event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { name, imageUrl } = body

  if (name !== undefined && name.trim()) {
    db.run('UPDATE sub_events SET name = ?, slug = ? WHERE id = ?', name.trim(), generateSlug(name.trim()), subEventId)
  }

  if (imageUrl !== undefined) {
    db.run('UPDATE sub_events SET image_url = ? WHERE id = ?', imageUrl, subEventId)
  }

  const updated = db.query('SELECT * FROM sub_events WHERE id = ?').get(subEventId) as DbSubEvent

  return c.json({
    id: updated.id,
    leaderboardId: updated.leaderboard_id,
    name: updated.name,
    slug: updated.slug,
    imageUrl: updated.image_url,
    createdAt: new Date(updated.created_at),
  })
})

// DELETE /events/:id/sub-events/:subEventId - Delete sub-event
app.delete('/:id/sub-events/:subEventId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const event = db.query('SELECT * FROM events WHERE id = ?').get(leaderboardId) as DbEvent | null

  if (!event || event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  // Get sub-event participants to adjust scores
  const subParticipants = db.query(
    'SELECT * FROM sub_event_participants WHERE sub_event_id = ?'
  ).all(subEventId) as DbSubEventParticipant[]

  // Remove sub-event scores from leaderboard participants and players
  for (const sp of subParticipants) {
    if (sp.aura_score !== 0) {
      const leaderboardParticipant = db.query(
        'SELECT * FROM event_participants WHERE id = ?'
      ).get(sp.leaderboard_participant_id) as DbEventParticipant | null

      // Update leaderboard participant score
      db.run(
        'UPDATE event_participants SET aura_score = ROUND(aura_score - ?, 2) WHERE id = ?',
        sp.aura_score, sp.leaderboard_participant_id
      )

      // Update player global score if real player
      if (leaderboardParticipant?.player_id) {
        db.run(
          'UPDATE players SET aura_score = ROUND(aura_score - ?, 2) WHERE id = ?',
          sp.aura_score, leaderboardParticipant.player_id
        )
      }
    }
  }

  // Delete votes, participants, then sub-event
  db.run('DELETE FROM sub_event_votes WHERE sub_event_id = ?', subEventId)
  db.run('DELETE FROM sub_event_participants WHERE sub_event_id = ?', subEventId)
  db.run('DELETE FROM sub_events WHERE id = ?', subEventId)

  return c.json({ success: true })
})

// POST /events/:id/sub-events/:subEventId/participants - Add participant to sub-event
app.post('/:id/sub-events/:subEventId/participants', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')

  const event = db.query('SELECT * FROM events WHERE id = ?').get(leaderboardId) as DbEvent | null

  if (!event || event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const body = await c.req.json()
  const { leaderboardParticipantId } = body

  // Verify participant belongs to leaderboard
  const leaderboardParticipant = db.query(
    'SELECT * FROM event_participants WHERE id = ? AND event_id = ?'
  ).get(leaderboardParticipantId, leaderboardId) as DbEventParticipant | null

  if (!leaderboardParticipant) {
    return c.json({ error: 'Participant not found in leaderboard' }, 404)
  }

  // Check if already in sub-event
  const existing = db.query(
    'SELECT * FROM sub_event_participants WHERE sub_event_id = ? AND leaderboard_participant_id = ?'
  ).get(subEventId, leaderboardParticipantId)

  if (existing) {
    return c.json({ error: 'Participant already in sub-event' }, 400)
  }

  const participantId = generateId()
  const now = Date.now()

  db.run(
    'INSERT INTO sub_event_participants (id, sub_event_id, leaderboard_participant_id, aura_score, created_at) VALUES (?, ?, ?, ?, ?)',
    participantId, subEventId, leaderboardParticipantId, 0, now
  )

  return c.json({
    id: participantId,
    subEventId,
    leaderboardParticipantId,
    auraScore: 0,
    createdAt: new Date(now),
  })
})

// DELETE /events/:id/sub-events/:subEventId/participants/:participantId - Remove participant from sub-event
app.delete('/:id/sub-events/:subEventId/participants/:participantId', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = getUserIdFromSession(sessionId)

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')
  const participantId = c.req.param('participantId')

  const event = db.query('SELECT * FROM events WHERE id = ?').get(leaderboardId) as DbEvent | null

  if (!event || event.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  const subParticipant = db.query(
    'SELECT * FROM sub_event_participants WHERE id = ? AND sub_event_id = ?'
  ).get(participantId, subEventId) as DbSubEventParticipant | null

  if (!subParticipant) {
    return c.json({ error: 'Participant not found' }, 404)
  }

  // Remove sub-event score from leaderboard participant and player
  if (subParticipant.aura_score !== 0) {
    const leaderboardParticipant = db.query(
      'SELECT * FROM event_participants WHERE id = ?'
    ).get(subParticipant.leaderboard_participant_id) as DbEventParticipant | null

    db.run(
      'UPDATE event_participants SET aura_score = ROUND(aura_score - ?, 2) WHERE id = ?',
      subParticipant.aura_score, subParticipant.leaderboard_participant_id
    )

    if (leaderboardParticipant?.player_id) {
      db.run(
        'UPDATE players SET aura_score = ROUND(aura_score - ?, 2) WHERE id = ?',
        subParticipant.aura_score, leaderboardParticipant.player_id
      )
    }
  }

  db.run('DELETE FROM sub_event_votes WHERE participant_id = ?', participantId)
  db.run('DELETE FROM sub_event_participants WHERE id = ?', participantId)

  return c.json({ success: true })
})

// POST /events/:id/sub-events/:subEventId/vote - Vote on sub-event participant
app.post('/:id/sub-events/:subEventId/vote', async (c) => {
  const leaderboardId = c.req.param('id')
  const subEventId = c.req.param('subEventId')
  const body = await c.req.json()
  const { visitorId, participantId, direction } = body

  if (!visitorId || !participantId || !direction) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const subEvent = db.query(
    'SELECT * FROM sub_events WHERE id = ? AND leaderboard_id = ?'
  ).get(subEventId, leaderboardId) as DbSubEvent | null

  if (!subEvent) {
    return c.json({ error: 'Sub-event not found' }, 404)
  }

  const subParticipant = db.query(
    'SELECT * FROM sub_event_participants WHERE id = ? AND sub_event_id = ?'
  ).get(participantId, subEventId) as DbSubEventParticipant | null

  if (!subParticipant) {
    return c.json({ error: 'Participant not found' }, 404)
  }

  // Get leaderboard participant for updating main score
  const leaderboardParticipant = db.query(
    'SELECT * FROM event_participants WHERE id = ?'
  ).get(subParticipant.leaderboard_participant_id) as DbEventParticipant | null

  // Check existing vote
  const existingVote = db.query(
    'SELECT * FROM sub_event_votes WHERE visitor_id = ? AND sub_event_id = ? AND participant_id = ?'
  ).get(visitorId, subEventId, participantId) as DbSubEventVote | null

  const delta = direction === 'UP' ? 1 : -1

  if (existingVote) {
    if (existingVote.direction === direction) {
      return c.json({ error: 'Already voted' }, 400)
    }
    // Change vote direction - double the delta
    const scoreDelta = delta * 2
    db.run('UPDATE sub_event_votes SET direction = ?, timestamp = ? WHERE id = ?', direction, Date.now(), existingVote.id)
    db.run('UPDATE sub_event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', scoreDelta, participantId)

    // Update leaderboard participant score
    db.run('UPDATE event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', scoreDelta, subParticipant.leaderboard_participant_id)

    // Update player global score if real player
    if (leaderboardParticipant?.player_id) {
      db.run('UPDATE players SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', scoreDelta, leaderboardParticipant.player_id)
    }
  } else {
    // New vote
    const voteId = generateId()
    db.run(
      'INSERT INTO sub_event_votes (id, visitor_id, sub_event_id, participant_id, direction, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      voteId, visitorId, subEventId, participantId, direction, Date.now()
    )
    db.run('UPDATE sub_event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, participantId)

    // Update leaderboard participant score
    db.run('UPDATE event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, subParticipant.leaderboard_participant_id)

    // Update player global score if real player
    if (leaderboardParticipant?.player_id) {
      db.run('UPDATE players SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, leaderboardParticipant.player_id)
    }
  }

  const updated = db.query('SELECT * FROM sub_event_participants WHERE id = ?').get(participantId) as DbSubEventParticipant

  return c.json({
    participantId,
    auraScore: updated.aura_score,
    direction,
  })
})

// DELETE /events/:id/sub-events/:subEventId/vote - Remove sub-event vote
app.delete('/:id/sub-events/:subEventId/vote', async (c) => {
  const subEventId = c.req.param('subEventId')
  const body = await c.req.json()
  const { visitorId, participantId } = body

  const vote = db.query(
    'SELECT * FROM sub_event_votes WHERE visitor_id = ? AND sub_event_id = ? AND participant_id = ?'
  ).get(visitorId, subEventId, participantId) as DbSubEventVote | null

  if (!vote) {
    return c.json({ error: 'Vote not found' }, 404)
  }

  const subParticipant = db.query(
    'SELECT * FROM sub_event_participants WHERE id = ?'
  ).get(participantId) as DbSubEventParticipant | null

  const leaderboardParticipant = subParticipant ? db.query(
    'SELECT * FROM event_participants WHERE id = ?'
  ).get(subParticipant.leaderboard_participant_id) as DbEventParticipant | null : null

  const delta = vote.direction === 'UP' ? -1 : 1

  db.run('DELETE FROM sub_event_votes WHERE id = ?', vote.id)
  db.run('UPDATE sub_event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, participantId)

  // Update leaderboard participant score
  if (subParticipant) {
    db.run('UPDATE event_participants SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, subParticipant.leaderboard_participant_id)
  }

  // Update player global score if real player
  if (leaderboardParticipant?.player_id) {
    db.run('UPDATE players SET aura_score = ROUND(aura_score + ?, 2) WHERE id = ?', delta, leaderboardParticipant.player_id)
  }

  const updated = db.query('SELECT * FROM sub_event_participants WHERE id = ?').get(participantId) as DbSubEventParticipant

  return c.json({
    participantId,
    auraScore: updated.aura_score,
  })
})

// GET /events/:id/sub-events/:subEventId/votes - Get visitor's votes for sub-event
app.get('/:id/sub-events/:subEventId/votes', async (c) => {
  const subEventId = c.req.param('subEventId')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  const votes = db.query(
    'SELECT * FROM sub_event_votes WHERE visitor_id = ? AND sub_event_id = ?'
  ).all(visitorId, subEventId) as DbSubEventVote[]

  return c.json(votes.map(v => ({
    participantId: v.participant_id,
    direction: v.direction,
  })))
})

// ==================== SUB-EVENT COMMENTS ====================

// POST /events/:id/sub-events/:subEventId/comments - Add comment
app.post('/:id/sub-events/:subEventId/comments', async (c) => {
  const subEventId = c.req.param('subEventId')
  const body = await c.req.json()
  const { visitorId, content, username, parentId } = body

  if (!visitorId || !content?.trim()) {
    return c.json({ error: 'Visitor ID and content are required' }, 400)
  }

  const commentId = generateId()
  const now = Date.now()

  db.run(
    'INSERT INTO sub_event_comments (id, sub_event_id, visitor_id, username, content, parent_id, vote_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    commentId, subEventId, visitorId, username || 'Anonymous', content.trim(), parentId || null, 0, now
  )

  return c.json({
    id: commentId,
    subEventId,
    visitorId,
    username: username || 'Anonymous',
    content: content.trim(),
    parentId: parentId || null,
    voteCount: 0,
    createdAt: new Date(now),
  })
})

// POST /events/:id/sub-events/:subEventId/comments/:commentId/vote - Vote on comment
app.post('/:id/sub-events/:subEventId/comments/:commentId/vote', async (c) => {
  const commentId = c.req.param('commentId')
  const body = await c.req.json()
  const { visitorId, direction } = body

  if (!visitorId || !direction) {
    return c.json({ error: 'Visitor ID and direction are required' }, 400)
  }

  // Check existing vote
  const existingVote = db.query(
    'SELECT * FROM sub_event_comment_votes WHERE comment_id = ? AND visitor_id = ?'
  ).get(commentId, visitorId) as any

  const delta = direction === 'UP' ? 1 : -1

  if (existingVote) {
    if (existingVote.direction === direction) {
      // Remove vote
      db.run('DELETE FROM sub_event_comment_votes WHERE id = ?', existingVote.id)
      db.run('UPDATE sub_event_comments SET vote_count = vote_count - ? WHERE id = ?', delta, commentId)
    } else {
      // Change vote
      db.run('UPDATE sub_event_comment_votes SET direction = ? WHERE id = ?', direction, existingVote.id)
      db.run('UPDATE sub_event_comments SET vote_count = vote_count + ? WHERE id = ?', delta * 2, commentId)
    }
  } else {
    // New vote
    const voteId = generateId()
    db.run(
      'INSERT INTO sub_event_comment_votes (id, comment_id, visitor_id, direction, created_at) VALUES (?, ?, ?, ?, ?)',
      voteId, commentId, visitorId, direction, Date.now()
    )
    db.run('UPDATE sub_event_comments SET vote_count = vote_count + ? WHERE id = ?', delta, commentId)
  }

  const updated = db.query('SELECT vote_count FROM sub_event_comments WHERE id = ?').get(commentId) as any

  return c.json({
    commentId,
    voteCount: updated?.vote_count || 0,
  })
})

// GET /events/:id/sub-events/:subEventId/comments/votes - Get visitor's comment votes
app.get('/:id/sub-events/:subEventId/comments/votes', async (c) => {
  const subEventId = c.req.param('subEventId')
  const visitorId = c.req.query('visitorId')

  if (!visitorId) {
    return c.json([])
  }

  // Get all comment IDs for this sub-event
  const comments = db.query('SELECT id FROM sub_event_comments WHERE sub_event_id = ?').all(subEventId) as any[]
  const commentIds = comments.map(c => c.id)

  if (commentIds.length === 0) {
    return c.json([])
  }

  const votes = db.query(
    `SELECT * FROM sub_event_comment_votes WHERE visitor_id = ? AND comment_id IN (${commentIds.map(() => '?').join(',')})`
  ).all(visitorId, ...commentIds) as any[]

  return c.json(votes.map(v => ({
    commentId: v.comment_id,
    direction: v.direction,
  })))
})

// DELETE /events/:id/sub-events/:subEventId/comments/:commentId - Delete comment
app.delete('/:id/sub-events/:subEventId/comments/:commentId', async (c) => {
  const commentId = c.req.param('commentId')
  const body = await c.req.json()
  const { visitorId } = body

  const comment = db.query('SELECT * FROM sub_event_comments WHERE id = ?').get(commentId) as DbSubEventComment | null

  if (!comment) {
    return c.json({ error: 'Comment not found' }, 404)
  }

  // Only the comment author can delete their own comment
  if (comment.visitor_id !== visitorId) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  db.run('DELETE FROM sub_event_comments WHERE id = ?', commentId)

  return c.json({ success: true })
})

export default app
