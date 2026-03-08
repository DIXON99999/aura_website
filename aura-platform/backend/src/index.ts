import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import entities from './routes/entities.js'
import votes from './routes/votes.js'
import auth from './routes/auth.js'
import events from './routes/events.js'
import uploads from './routes/uploads.js'
import auraFarms from './routes/aura-farms.js'
import suggestions from './routes/suggestions.js'
import notifications from './routes/notifications.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (!origin || origin.includes('localhost')) return origin
    // Allow Cloudflare tunnels
    if (origin.endsWith('.trycloudflare.com')) return origin
    // Allow DigitalOcean App Platform
    if (origin.endsWith('.ondigitalocean.app')) return origin
    // Allow custom production domain
    if (origin === 'https://aura-farm.me' || origin.endsWith('.aura-farm.me')) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check
app.get('/', (c) => c.json({ status: 'ok', message: 'Aura API' }))
app.get('/api', (c) => c.json({ status: 'ok', message: 'Aura API' }))

// Routes - mounted at both /api/* (local dev with proxy) and /* (DigitalOcean strips /api prefix)
app.route('/api', entities)
app.route('/', entities)
app.route('/api/votes', votes)
app.route('/votes', votes)
app.route('/api/auth', auth)
app.route('/auth', auth)
app.route('/api/events', events)
app.route('/events', events)
app.route('/api/uploads', uploads)
app.route('/uploads', uploads)
app.route('/api/aura-farms', auraFarms)
app.route('/aura-farms', auraFarms)
app.route('/api/suggestions', suggestions)
app.route('/suggestions', suggestions)
app.route('/api/notifications', notifications)
app.route('/notifications', notifications)

const port = parseInt(process.env.PORT || '3001')
console.log(`Server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
