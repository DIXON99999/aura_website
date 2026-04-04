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
import admin from './routes/admin.js'
import play from './routes/play.js'
import lobbies from './routes/lobbies.js'
import { handleWebSocketUpgrade, handleWebSocketMessage, handleWebSocketClose } from './game/lobby.js'
import { pool } from './db/index.js'

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

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: err.message, stack: err.stack }, 500)
})

// Health check
app.get('/', (c) => c.json({ status: 'ok', message: 'Aura API' }))
app.get('/api', (c) => c.json({ status: 'ok', message: 'Aura API' }))

// Diagnostic endpoint
app.get('/api/debug/db', async (c) => {
  try {
    const result = await pool.query('SELECT 1 as test')
    const dbUrl = process.env.DATABASE_URL || 'NOT SET'
    const masked = dbUrl.replace(/:([^@]+)@/, ':****@')
    return c.json({ status: 'connected', dbUrl: masked, result: result.rows })
  } catch (err: unknown) {
    const dbUrl = process.env.DATABASE_URL || 'NOT SET'
    const masked = dbUrl.replace(/:([^@]+)@/, ':****@')
    return c.json({ status: 'error', dbUrl: masked, error: (err as Error).message }, 500)
  }
})
app.get('/debug/db', async (c) => {
  try {
    const result = await pool.query('SELECT 1 as test')
    const dbUrl = process.env.DATABASE_URL || 'NOT SET'
    const masked = dbUrl.replace(/:([^@]+)@/, ':****@')
    return c.json({ status: 'connected', dbUrl: masked, result: result.rows })
  } catch (err: unknown) {
    const dbUrl = process.env.DATABASE_URL || 'NOT SET'
    const masked = dbUrl.replace(/:([^@]+)@/, ':****@')
    return c.json({ status: 'error', dbUrl: masked, error: (err as Error).message }, 500)
  }
})

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
app.route('/api/admin', admin)
app.route('/admin', admin)
app.route('/api/play', play)
app.route('/play', play)
app.route('/api/lobbies', lobbies)
app.route('/lobbies', lobbies)

const port = parseInt(process.env.PORT || '3001')
console.log(`Server running on http://localhost:${port}`)

// Helper to get userId from session token
async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    const res = await pool.query(
      'SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [token]
    )
    return res.rows[0] ? (res.rows[0] as any).user_id : null
  } catch {
    return null
  }
}

// Bun server with WebSocket support
const server = Bun.serve({
  port,
  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade for /ws/lobby/:lobbyId or /api/ws/lobby/:lobbyId
    if (url.pathname.startsWith('/ws/lobby/') || url.pathname.startsWith('/api/ws/lobby/')) {
      const parts = url.pathname.split('/')
      const lobbyId = url.pathname.startsWith('/api/') ? parts[4] : parts[3]
      const token = url.searchParams.get('token')
      if (!lobbyId || !token) {
        return new Response('Missing lobbyId or token', { status: 400 })
      }
      const userId = await getUserIdFromToken(token)
      if (!userId) {
        return new Response('Unauthorized', { status: 401 })
      }
      const upgraded = server.upgrade(req, { data: { lobbyId, userId } } as any)
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 500 })
      }
      return undefined as any
    }

    // Regular HTTP - delegate to Hono
    return app.fetch(req, { ip: server.requestIP(req) })
  },
  websocket: {
    open(ws) {
      const data = (ws.data as unknown) as { lobbyId: string; userId: string }
      if (data) {
        handleWebSocketUpgrade(ws, data.lobbyId, data.userId)
      }
    },
    message(ws, message) {
      const data = (ws.data as unknown) as { lobbyId: string; userId: string }
      if (!data) return
      handleWebSocketMessage(ws, data.lobbyId, data.userId, String(message))
    },
    close(ws) {
      const data = (ws.data as unknown) as { lobbyId: string; userId: string }
      if (!data) return
      handleWebSocketClose(data.lobbyId, data.userId)
    },
  },
})

console.log(`WebSocket server ready on ws://localhost:${port}/ws/lobby/:id`)

// Initialize personal_bots table
pool.query(`
  CREATE TABLE IF NOT EXISTS personal_bots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_img TEXT,
    aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
  )
`).catch(e => console.error('Failed to create personal_bots table:', e))
