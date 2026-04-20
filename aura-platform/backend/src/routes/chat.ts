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
  created_at: string
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
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT`)
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

// Public: list all messages (newest first)
app.get('/', async (c) => {
  const result = await pool.query(
    'SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 500'
  )
  const messages = result.rows.map((row: DbChatMessage) => ({
    id: row.id,
    userId: row.user_id,
    authorName: row.author_name,
    title: row.title,
    content: row.content,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  }))
  return c.json(messages)
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
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''

  if (!content && !imageUrl) return c.json({ error: 'Content or image required' }, 400)
  if (content.length > 5000) return c.json({ error: 'Content too long' }, 400)
  if (title.length > 200) return c.json({ error: 'Title too long' }, 400)

  const authorName = await resolveAuthorName(session.user_id, session.email.split('@')[0])
  const id = randomUUID()

  await pool.query(
    `INSERT INTO chat_messages (id, user_id, author_name, title, content, image_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [id, session.user_id, authorName, title || null, content, imageUrl || null]
  )

  const inserted = await pool.query('SELECT * FROM chat_messages WHERE id = $1', [id])
  const row = inserted.rows[0] as DbChatMessage
  return c.json({
    id: row.id,
    userId: row.user_id,
    authorName: row.author_name,
    title: row.title,
    content: row.content,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  })
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
