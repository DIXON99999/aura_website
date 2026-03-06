import { Hono } from 'hono'
import { db } from '../db/index.js'
import type { DbUser, DbSession } from '../db/index.js'

const app = new Hono()

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days

function generateId(): string {
  return crypto.randomUUID()
}

// POST /auth/signup
app.post('/signup', async (c) => {
  const body = await c.req.json()
  const { email, password } = body

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }

  const normalizedEmail = email.toLowerCase().trim()

  if (!normalizedEmail.includes('@')) {
    return c.json({ error: 'Invalid email address' }, 400)
  }

  if (password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400)
  }

  // Check if email exists
  const existing = db.query('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as DbUser | null
  if (existing) {
    return c.json({ error: 'Email already registered' }, 400)
  }

  // Hash password using Bun's built-in argon2
  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536,
    timeCost: 2,
  })

  const userId = generateId()
  const now = Date.now()

  // Create user
  db.run(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    userId, normalizedEmail, passwordHash, now
  )

  // Create session
  const sessionId = generateId()
  const expiresAt = now + SESSION_DURATION

  db.run(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    sessionId, userId, expiresAt, now
  )

  return c.json({
    user: {
      id: userId,
      email: normalizedEmail,
      createdAt: new Date(now),
    },
    session: {
      id: sessionId,
      expiresAt: new Date(expiresAt),
    },
  })
})

// POST /auth/signin
app.post('/signin', async (c) => {
  const body = await c.req.json()
  const { email, password } = body

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Find user
  const user = db.query('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as DbUser | null
  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Verify password
  const validPassword = await Bun.password.verify(password, user.password_hash)
  if (!validPassword) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Create session
  const sessionId = generateId()
  const now = Date.now()
  const expiresAt = now + SESSION_DURATION

  db.run(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    sessionId, user.id, expiresAt, now
  )

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      playerId: user.player_id,
      createdAt: new Date(user.created_at),
    },
    session: {
      id: sessionId,
      expiresAt: new Date(expiresAt),
    },
  })
})

// POST /auth/signout
app.post('/signout', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')

  if (sessionId) {
    db.run('DELETE FROM sessions WHERE id = ?', sessionId)
  }

  return c.json({ success: true })
})

// GET /auth/me - Get current user from session
app.get('/me', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!sessionId) {
    return c.json({ error: 'No session' }, 401)
  }

  // Find session
  const session = db.query('SELECT * FROM sessions WHERE id = ?').get(sessionId) as DbSession | null
  if (!session) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  // Check if expired
  if (session.expires_at < Date.now()) {
    db.run('DELETE FROM sessions WHERE id = ?', sessionId)
    return c.json({ error: 'Session expired' }, 401)
  }

  // Get user
  const user = db.query('SELECT * FROM users WHERE id = ?').get(session.user_id) as DbUser | null
  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      playerId: user.player_id,
      createdAt: new Date(user.created_at),
    },
  })
})

// DELETE /auth/account - Delete user account
app.delete('/account', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!sessionId) {
    return c.json({ error: 'No session' }, 401)
  }

  const session = db.query('SELECT * FROM sessions WHERE id = ?').get(sessionId) as DbSession | null
  if (!session) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  const userId = session.user_id

  // Find and delete user's player profile (visitor_id = user.id for user profiles)
  const playerProfile = db.query('SELECT * FROM players WHERE visitor_id = ? AND is_user_profile = 1').get(userId) as { id: string } | null
  if (playerProfile) {
    // Delete votes made by this player profile
    db.run('DELETE FROM votes WHERE visitor_id = ?', userId)
    // Delete user_profiles mapping
    db.run('DELETE FROM user_profiles WHERE visitor_id = ?', userId)
    // Delete the player profile
    db.run('DELETE FROM players WHERE id = ?', playerProfile.id)
  }

  // Delete all user sessions
  db.run('DELETE FROM sessions WHERE user_id = ?', userId)

  // Delete user
  db.run('DELETE FROM users WHERE id = ?', userId)

  return c.json({ success: true })
})

// PATCH /auth/link-player - Link a player profile to user account
app.patch('/link-player', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const body = await c.req.json()
  const { playerId } = body

  if (!sessionId) {
    return c.json({ error: 'No session' }, 401)
  }

  const session = db.query('SELECT * FROM sessions WHERE id = ?').get(sessionId) as DbSession | null
  if (!session || session.expires_at < Date.now()) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  // Update user with player_id
  db.run('UPDATE users SET player_id = ? WHERE id = ?', playerId, session.user_id)

  const user = db.query('SELECT * FROM users WHERE id = ?').get(session.user_id) as DbUser

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      playerId: user.player_id,
      createdAt: new Date(user.created_at),
    },
  })
})

export default app
