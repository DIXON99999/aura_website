import { Hono } from 'hono'
import { pool } from '../db'

const app = new Hono()

interface DbNotification {
  id: string
  user_id: string
  type: string
  source_type: string
  source_id: string
  source_url: string
  from_user_id: string | null
  from_username: string
  content: string
  read: boolean
  created_at: string
}

// Get notifications for a user
app.get('/:userId', async (c) => {
  const userId = c.req.param('userId')
  const limit = parseInt(c.req.query('limit') || '20')
  const unreadOnly = c.req.query('unreadOnly') === 'true'

  let query = 'SELECT * FROM notifications WHERE user_id = $1'
  const params: (string | number)[] = [userId]

  if (unreadOnly) {
    query += ' AND read = false'
  }

  query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1)
  params.push(limit)

  const result = await pool.query(query, params)
  const notifications = result.rows.map((row: DbNotification) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    fromUserId: row.from_user_id,
    fromUsername: row.from_username,
    content: row.content,
    read: row.read,
    createdAt: row.created_at,
  }))

  return c.json(notifications)
})

// Get unread count
app.get('/:userId/unread-count', async (c) => {
  const userId = c.req.param('userId')

  const result = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
    [userId]
  )

  return c.json({ count: parseInt(result.rows[0].count) })
})

// Mark notification as read
app.patch('/:id/read', async (c) => {
  const id = c.req.param('id')

  await pool.query('UPDATE notifications SET read = true WHERE id = $1', [id])

  return c.json({ success: true })
})

// Mark all notifications as read for a user
app.patch('/:userId/read-all', async (c) => {
  const userId = c.req.param('userId')

  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [userId])

  return c.json({ success: true })
})

// Helper function to create a notification (exported for use in other routes)
export async function createNotification(data: {
  userId: string
  type: string
  sourceType: string
  sourceId: string
  sourceUrl: string
  fromUserId?: string
  fromUsername: string
  content: string
}) {
  const id = crypto.randomUUID()
  await pool.query(
    `INSERT INTO notifications (id, user_id, type, source_type, source_id, source_url, from_user_id, from_username, content, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)`,
    [
      id,
      data.userId,
      data.type,
      data.sourceType,
      data.sourceId,
      data.sourceUrl,
      data.fromUserId || null,
      data.fromUsername,
      data.content,
      new Date().toISOString(),
    ]
  )
  return id
}

// Helper to extract @mentions from content
export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1])
  }
  return [...new Set(mentions)] // Remove duplicates
}

// Helper to find user IDs from usernames (via player profiles)
export async function findUsersByUsernames(usernames: string[]): Promise<Map<string, string>> {
  if (usernames.length === 0) return new Map()

  const placeholders = usernames.map((_, i) => `$${i + 1}`).join(', ')
  const result = await pool.query(
    `SELECT u.id as user_id, p.name as username
     FROM users u
     JOIN players p ON u.player_id = p.id
     WHERE LOWER(p.name) IN (${placeholders})`,
    usernames.map(u => u.toLowerCase())
  )

  const map = new Map<string, string>()
  for (const row of result.rows) {
    map.set(row.username.toLowerCase(), row.user_id)
  }
  return map
}

export default app
