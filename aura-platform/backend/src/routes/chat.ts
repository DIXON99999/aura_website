import { Hono } from 'hono'
import { pool } from '../db/index.js'
import { randomUUID } from 'crypto'

const app = new Hono()

const ADMIN_EMAIL = 'liam.t.dixon@gmail.com'

interface DbChatMessage {
  id: string
  user_id: string
  author_name: string
  title: string | null
  content: string
  image_url: string | null
  image_urls: string[] | null
  player_ids: string[] | null
  created_at: string
  updated_at: string | null
}

async function initChatTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      image_url TEXT,
      image_urls JSONB,
      updated_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT`)
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_urls JSONB`)
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS player_ids JSONB`)
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE`)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages (created_at DESC)`
  )
}

initChatTable().catch((e) => console.error('Failed to init chat_messages table:', e))

async function getSession(sessionId: string | undefined) {
  if (!sessionId) return null
  const result = await pool.query(
    'SELECT s.user_id, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > NOW()',
    [sessionId]
  )
  if (result.rows.length === 0) return null
  return result.rows[0] as { user_id: string; email: string }
}

async function resolveAuthorName(userId: string, fallback: string): Promise<string> {
  const userRes = await pool.query(
    'SELECT player_id, email FROM users WHERE id = $1',
    [userId]
  )
  if (userRes.rows.length === 0) return fallback
  const user = userRes.rows[0] as { player_id: string | null; email: string }
  if (user.player_id) {
    const playerRes = await pool.query(
      'SELECT name FROM players WHERE id = $1',
      [user.player_id]
    )
    if (playerRes.rows.length > 0) {
      const name = (playerRes.rows[0] as { name: string }).name
      if (name) return name
    }
  }
  return user.email?.split('@')[0] || fallback
}

function serialize(row: DbChatMessage) {
  let imageUrls: string[] = []
  if (Array.isArray(row.image_urls)) imageUrls = row.image_urls
  else if (row.image_url) imageUrls = [row.image_url]
  const playerIds = Array.isArray(row.player_ids) ? row.player_ids : []
  return {
    id: row.id,
    userId: row.user_id,
    authorName: row.author_name,
    title: row.title,
    content: row.content,
    imageUrls,
    playerIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sanitizeStringArray(input: unknown, max: number): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of input) {
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= max) break
  }
  return out
}

// Public: list all messages (newest first)
app.get('/', async (c) => {
  const result = await pool.query(
    'SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 500'
  )
  return c.json(result.rows.map((row: DbChatMessage) => serialize(row)))
})

// Admin-only: post a message
app.post('/', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const session = await getSession(sessionId)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (session.email !== ADMIN_EMAIL) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  let imageUrls = sanitizeStringArray(body.imageUrls, 20)
  if (imageUrls.length === 0 && typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    imageUrls = [body.imageUrl.trim()]
  }
  const playerIds = sanitizeStringArray(body.playerIds, 50)

  if (!content && imageUrls.length === 0) return c.json({ error: 'Content or image required' }, 400)
  if (content.length > 5000) return c.json({ error: 'Content too long' }, 400)
  if (title.length > 200) return c.json({ error: 'Title too long' }, 400)

  const authorName = await resolveAuthorName(session.user_id, session.email.split('@')[0])
  const id = randomUUID()

  await pool.query(
    `INSERT INTO chat_messages (id, user_id, author_name, title, content, image_urls, player_ids, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW())`,
    [id, session.user_id, authorName, title || null, content, JSON.stringify(imageUrls), JSON.stringify(playerIds)]
  )

  const inserted = await pool.query('SELECT * FROM chat_messages WHERE id = $1', [id])
  return c.json(serialize(inserted.rows[0] as DbChatMessage))
})

// Admin-only: edit a message
app.patch('/:id', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const session = await getSession(sessionId)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (session.email !== ADMIN_EMAIL) return c.json({ error: 'Forbidden' }, 403)

  const { id } = c.req.param()
  const existing = await pool.query('SELECT * FROM chat_messages WHERE id = $1', [id])
  if (existing.rows.length === 0) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const imageUrls = sanitizeStringArray(body.imageUrls, 20)
  const playerIds = sanitizeStringArray(body.playerIds, 50)

  if (!content && imageUrls.length === 0) return c.json({ error: 'Content or image required' }, 400)
  if (content.length > 5000) return c.json({ error: 'Content too long' }, 400)
  if (title.length > 200) return c.json({ error: 'Title too long' }, 400)

  await pool.query(
    `UPDATE chat_messages
     SET title = $1, content = $2, image_urls = $3::jsonb, player_ids = $4::jsonb, image_url = NULL, updated_at = NOW()
     WHERE id = $5`,
    [title || null, content, JSON.stringify(imageUrls), JSON.stringify(playerIds), id]
  )

  const updated = await pool.query('SELECT * FROM chat_messages WHERE id = $1', [id])
  return c.json(serialize(updated.rows[0] as DbChatMessage))
})

// Admin-only: delete a message
app.delete('/:id', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const session = await getSession(sessionId)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (session.email !== ADMIN_EMAIL) return c.json({ error: 'Forbidden' }, 403)

  const { id } = c.req.param()
  await pool.query('DELETE FROM chat_messages WHERE id = $1', [id])
  return c.json({ success: true })
})

// Public: check whether the current session can post
app.get('/can-post', async (c) => {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  const session = await getSession(sessionId)
  return c.json({ canPost: !!session && session.email === ADMIN_EMAIL })
})

export default app
