import { Hono } from 'hono'
import { pool } from '../db/index.js'
import {
  createLobby, listLobbies, getLobby,
  joinLobby, leaveLobby, startGame,
  deployPersonalBotInLobby,
} from '../game/lobby.js'
import type { GameMode, PersonalBot } from '../game/types.js'

const app = new Hono()

// Helper to get user from session
async function getUser(c: any): Promise<{ id: string; email: string; playerId?: string } | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const res = await pool.query(
    `SELECT u.id, u.email, u.player_id as "playerId" FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > NOW()`,
    [token]
  )
  return res.rows[0] || null
}

// Helper to get user display name
async function getUserDisplayName(user: { id: string; email: string; playerId?: string }): Promise<string> {
  if (user.playerId) {
    const res = await pool.query('SELECT name FROM players WHERE id = $1', [user.playerId])
    if (res.rows[0]) return (res.rows[0] as any).name
  }
  return user.email.split('@')[0]
}

// Helper to get user profile image
async function getUserProfileImg(user: { id: string; playerId?: string }): Promise<string | undefined> {
  if (user.playerId) {
    const res = await pool.query('SELECT image_url FROM players WHERE id = $1', [user.playerId])
    if (res.rows[0]) return (res.rows[0] as any).image_url || undefined
  }
  return undefined
}

// Helper to get user's player entity info (for aura tracking)
async function getUserEntityInfo(user: { id: string; playerId?: string }): Promise<{ entityId?: string; entityType?: string; auraScore?: number }> {
  if (user.playerId) {
    const res = await pool.query('SELECT id, aura_score FROM players WHERE id = $1', [user.playerId])
    if (res.rows[0]) return { entityId: (res.rows[0] as any).id, entityType: 'player', auraScore: Number((res.rows[0] as any).aura_score) || 0 }
  }
  return {}
}

// ============================================================================
// LOBBY CRUD
// ============================================================================

// List lobbies
app.get('/', async (c) => {
  return c.json(listLobbies())
})

// Get lobby
app.get('/:id', async (c) => {
  const lobby = getLobby(c.req.param('id'))
  if (!lobby) return c.json({ error: 'Not found' }, 404)
  return c.json(lobby)
})

// Create lobby
app.post('/', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { name, mode, teamCount, teams } = body as {
    name: string
    mode: GameMode
    teamCount: number
    teams: { entityId: string; entityName: string; entityType: string; entityImg?: string; auraScore: number }[]
  }

  if (!name || !mode) return c.json({ error: 'Missing name or mode' }, 400)
  if (mode === 'battle' && (!teamCount || teamCount < 2 || teamCount > 4)) {
    return c.json({ error: 'Battle mode requires 2-4 teams' }, 400)
  }
  if (mode === 'dust2' && teamCount !== 2) {
    return c.json({ error: 'Dust2 mode requires exactly 2 teams' }, 400)
  }

  const displayName = await getUserDisplayName(user)
  const lobby = createLobby(user.id, displayName, mode, teamCount || 0, teams || [], name)

  return c.json(lobby)
})

// Join lobby
app.post('/:id/join', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { team } = body as { team: number }

  const displayName = await getUserDisplayName(user)
  const profileImg = await getUserProfileImg(user)
  const entityInfo = await getUserEntityInfo(user)
  const result = joinLobby(c.req.param('id'), user.id, displayName, team || 0, profileImg, entityInfo.entityId, entityInfo.entityType, entityInfo.auraScore)

  if (!result.success) return c.json({ error: result.error }, 400)
  return c.json({ success: true })
})

// Leave lobby
app.post('/:id/leave', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  leaveLobby(c.req.param('id'), user.id)
  return c.json({ success: true })
})

// Start game (host only)
app.post('/:id/start', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const lobby = getLobby(c.req.param('id'))
  if (!lobby) return c.json({ error: 'Not found' }, 404)
  if (lobby.hostId !== user.id) return c.json({ error: 'Only host can start' }, 403)

  const result = startGame(c.req.param('id'))
  if (!result.success) return c.json({ error: result.error }, 400)
  return c.json({ success: true })
})

// ============================================================================
// PERSONAL BOTS
// ============================================================================

// Get user's unlocked bots
app.get('/bots/my', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const res = await pool.query(
    'SELECT id, user_id as "userId", entity_id as "entityId", entity_name as "entityName", entity_type as "entityType", entity_img as "entityImg", aura_score as "auraScore" FROM personal_bots WHERE user_id = $1',
    [user.id]
  )
  return c.json(res.rows)
})

// Unlock a personal bot
app.post('/bots/unlock', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { entityId, entityName, entityType, entityImg, auraScore } = body as PersonalBot

  if (!entityId || !entityName || !entityType) return c.json({ error: 'Missing fields' }, 400)

  // Check if already unlocked
  const existing = await pool.query(
    'SELECT id FROM personal_bots WHERE user_id = $1 AND entity_id = $2',
    [user.id, entityId]
  )
  if (existing.rows.length > 0) return c.json({ error: 'Already unlocked' }, 400)

  const id = Math.random().toString(36).substring(2, 10)
  await pool.query(
    'INSERT INTO personal_bots (id, user_id, entity_id, entity_name, entity_type, entity_img, aura_score) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, user.id, entityId, entityName, entityType, entityImg || null, auraScore || 0]
  )

  return c.json({ id, userId: user.id, entityId, entityName, entityType, entityImg, auraScore })
})

// Deploy a personal bot in a lobby
app.post('/:id/deploy-bot', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { botId, team } = body as { botId: string; team: number }

  // Get bot
  const res = await pool.query(
    'SELECT id, user_id as "userId", entity_id as "entityId", entity_name as "entityName", entity_type as "entityType", entity_img as "entityImg", aura_score as "auraScore" FROM personal_bots WHERE id = $1 AND user_id = $2',
    [botId, user.id]
  )
  if (res.rows.length === 0) return c.json({ error: 'Bot not found' }, 404)

  const bot = res.rows[0] as PersonalBot
  const result = deployPersonalBotInLobby(c.req.param('id'), bot, team)
  if (!result.success) return c.json({ error: result.error }, 400)
  return c.json({ success: true })
})

export default app
