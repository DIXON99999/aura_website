import { Hono } from 'hono'
import { pool } from '../db/index.js'
import { randomUUID } from 'crypto'

const app = new Hono()

interface DbSuggestion {
  id: string
  type: string
  name: string
  description: string | null
  links: string | null
  submitted_by_visitor_id: string | null
  submitted_by_user_id: string | null
  submitted_by_name: string | null
  status: string
  admin_notes: string | null
  created_at: string
}

// Submit a suggestion (public)
app.post('/', async (c) => {
  const body = await c.req.json()
  const { type, name, description, links, visitorId, userId, submittedByName } = body

  if (!type || !name) {
    return c.json({ error: 'Type and name are required' }, 400)
  }

  const id = randomUUID()
  await pool.query(
    `INSERT INTO suggestions (id, type, name, description, links, submitted_by_visitor_id, submitted_by_user_id, submitted_by_name, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())`,
    [id, type, name, description || null, links || null, visitorId || null, userId || null, submittedByName || null]
  )

  return c.json({ success: true, id })
})

// Get all suggestions (admin only - checks auth)
app.get('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const status = c.req.query('status') // 'pending', 'approved', 'rejected', or undefined for all

  let query = 'SELECT * FROM suggestions'
  const params: string[] = []

  if (status) {
    query += ' WHERE status = $1'
    params.push(status)
  }

  query += ' ORDER BY created_at DESC'

  const result = await pool.query(query, params)
  const suggestions = result.rows.map((row: DbSuggestion) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    links: row.links,
    submittedByVisitorId: row.submitted_by_visitor_id,
    submittedByUserId: row.submitted_by_user_id,
    submittedByName: row.submitted_by_name,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
  }))

  return c.json(suggestions)
})

// Update suggestion status (admin only)
app.patch('/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { id } = c.req.param()
  const body = await c.req.json()
  const { status, adminNotes } = body

  if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
    return c.json({ error: 'Valid status required' }, 400)
  }

  await pool.query(
    'UPDATE suggestions SET status = $1, admin_notes = $2 WHERE id = $3',
    [status, adminNotes || null, id]
  )

  return c.json({ success: true })
})

// Delete suggestion (admin only)
app.delete('/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { id } = c.req.param()
  await pool.query('DELETE FROM suggestions WHERE id = $1', [id])

  return c.json({ success: true })
})

export default app
