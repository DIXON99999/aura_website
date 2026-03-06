import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import entities from './routes/entities.js'
import votes from './routes/votes.js'
import auth from './routes/auth.js'
import events from './routes/events.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check
app.get('/', (c) => c.json({ status: 'ok', message: 'Aura API' }))

// Routes
app.route('/api', entities)
app.route('/api/votes', votes)
app.route('/api/auth', auth)
app.route('/api/events', events)

const port = 3001
console.log(`Server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
