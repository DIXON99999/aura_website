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

// Helper to find user ID by player ID
export async function findUserByPlayerId(playerId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT id FROM users WHERE player_id = $1',
    [playerId]
  )
  return result.rows.length > 0 ? result.rows[0].id : null
}

// Helper to get username from user ID
export async function getUsernameFromUserId(userId: string): Promise<string> {
  const result = await pool.query(
    `SELECT p.name as username, u.email
     FROM users u
     LEFT JOIN players p ON u.player_id = p.id
     WHERE u.id = $1`,
    [userId]
  )
  if (result.rows.length > 0) {
    return result.rows[0].username || result.rows[0].email.split('@')[0] || 'Someone'
  }
  return 'Someone'
}

// Throttle duration in milliseconds (1 hour)
const NOTIFICATION_THROTTLE_MS = 60 * 60 * 1000

// Initialize throttle table
async function initThrottleTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_throttle (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      last_notified_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `)
  // Add index for faster lookups
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notification_throttle_lookup
    ON notification_throttle (from_user_id, to_user_id, entity_type, entity_id, notification_type)
  `)
}
initThrottleTable().catch(console.error)

// Check if a notification should be throttled
export async function shouldThrottleNotification(data: {
  fromUserId: string
  toUserId: string
  entityType: string
  entityId: string
  notificationType: string
}): Promise<boolean> {
  const result = await pool.query(
    `SELECT last_notified_at FROM notification_throttle
     WHERE from_user_id = $1 AND to_user_id = $2 AND entity_type = $3 AND entity_id = $4 AND notification_type = $5`,
    [data.fromUserId, data.toUserId, data.entityType, data.entityId, data.notificationType]
  )

  if (result.rows.length === 0) {
    return false // No previous notification, don't throttle
  }

  const lastNotified = new Date(result.rows[0].last_notified_at).getTime()
  const now = Date.now()

  return (now - lastNotified) < NOTIFICATION_THROTTLE_MS
}

// Update throttle timestamp
export async function updateThrottle(data: {
  fromUserId: string
  toUserId: string
  entityType: string
  entityId: string
  notificationType: string
}) {
  const id = `${data.fromUserId}:${data.toUserId}:${data.entityType}:${data.entityId}:${data.notificationType}`
  const now = new Date().toISOString()

  await pool.query(
    `INSERT INTO notification_throttle (id, from_user_id, to_user_id, entity_type, entity_id, notification_type, last_notified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET last_notified_at = $7`,
    [id, data.fromUserId, data.toUserId, data.entityType, data.entityId, data.notificationType, now]
  )
}

// Create a throttled notification (checks throttle first)
export async function createThrottledNotification(data: {
  userId: string
  type: string
  sourceType: string
  sourceId: string
  sourceUrl: string
  fromUserId: string
  fromUsername: string
  content: string
  entityType: string
  entityId: string
}): Promise<string | null> {
  // Don't notify yourself
  if (data.userId === data.fromUserId) {
    return null
  }

  // Check throttle
  const shouldThrottle = await shouldThrottleNotification({
    fromUserId: data.fromUserId,
    toUserId: data.userId,
    entityType: data.entityType,
    entityId: data.entityId,
    notificationType: data.type,
  })

  if (shouldThrottle) {
    return null
  }

  // Create notification
  const notificationId = await createNotification({
    userId: data.userId,
    type: data.type,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    sourceUrl: data.sourceUrl,
    fromUserId: data.fromUserId,
    fromUsername: data.fromUsername,
    content: data.content,
  })

  // Update throttle
  await updateThrottle({
    fromUserId: data.fromUserId,
    toUserId: data.userId,
    entityType: data.entityType,
    entityId: data.entityId,
    notificationType: data.type,
  })

  return notificationId
}

export default app
