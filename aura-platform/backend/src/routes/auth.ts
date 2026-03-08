import { Hono } from 'hono'
import { pool } from '../db/index.js'
import type { DbUser, DbSession } from '../db/index.js'

const app = new Hono()

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days

function generateId(): string {
  return crypto.randomUUID()
}

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

  const existingResult = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
  if (existingResult.rows.length > 0) {
    return c.json({ error: 'Email already registered' }, 400)
  }

  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536,
    timeCost: 2,
  })

  const userId = generateId()
  const now = new Date()
  const nowIso = now.toISOString()

  await pool.query(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)',
    [userId, normalizedEmail, passwordHash, nowIso]
  )

  const sessionId = generateId()
  const expiresAt = new Date(now.getTime() + SESSION_DURATION)

  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [sessionId, userId, expiresAt.toISOString(), nowIso]
  )

  return c.json({
    user: {
      id: userId,
      email: normalizedEmail,
      createdAt: now,
    },
    session: {
      id: sessionId,
      expiresAt: expiresAt,
    },
  })
})

app.post('/signin', async (c) => {
  const body = await c.req.json()
  const { email, password } = body

  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }

  const normalizedEmail = email.toLowerCase().trim()

  const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
  if (userResult.rows.length === 0) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const user = userResult.rows[0] as DbUser

  const validPassword = await Bun.password.verify(password, user.password_hash)
  if (!validPassword) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const sessionId = generateId()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DURATION)

  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [sessionId, user.id, expiresAt.toISOString(), now.toISOString()]
  )

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      playerId: user.player_id,
      createdAt: user.created_at,
    },
    session: {
      id: sessionId,
      expiresAt: expiresAt,
    },
  })
})

app.post('/signout', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')

  if (sessionId) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId])
  }

  return c.json({ success: true })
})

app.get('/me', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!sessionId) {
    return c.json({ error: 'No session' }, 401)
  }

  const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId])
  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  const session = sessionResult.rows[0] as DbSession

  if (new Date(session.expires_at) < new Date()) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId])
    return c.json({ error: 'Session expired' }, 401)
  }

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [session.user_id])
  if (userResult.rows.length === 0) {
    return c.json({ error: 'User not found' }, 401)
  }

  const user = userResult.rows[0] as DbUser

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      playerId: user.player_id,
      createdAt: user.created_at,
    },
  })
})

app.delete('/account', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!sessionId) {
    return c.json({ error: 'No session' }, 401)
  }

  const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId])
  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  const session = sessionResult.rows[0] as DbSession
  const userId = session.user_id

  const playerProfileResult = await pool.query(
    'SELECT * FROM players WHERE visitor_id = $1 AND is_user_profile = true',
    [userId]
  )
  if (playerProfileResult.rows.length > 0) {
    const playerProfile = playerProfileResult.rows[0] as { id: string }
    await pool.query('DELETE FROM votes WHERE visitor_id = $1', [userId])
    await pool.query('DELETE FROM user_profiles WHERE visitor_id = $1', [userId])
    await pool.query('DELETE FROM players WHERE id = $1', [playerProfile.id])
  }

  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId])
  await pool.query('DELETE FROM users WHERE id = $1', [userId])

  return c.json({ success: true })
})

app.patch('/link-player', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const body = await c.req.json()
  const { playerId } = body

  if (!sessionId) {
    return c.json({ error: 'No session' }, 401)
  }

  const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId])
  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  const session = sessionResult.rows[0] as DbSession
  if (new Date(session.expires_at) < new Date()) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  await pool.query('UPDATE users SET player_id = $1 WHERE id = $2', [playerId, session.user_id])

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0] as DbUser

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      playerId: user.player_id,
      createdAt: user.created_at,
    },
  })
})

export default app
