import { Hono } from 'hono'
import { pool } from '../db/index.js'

const CLICK_AURA_VALUE = 1 // Each play click adds 1 aura
const AURA_PROPAGATION_FACTOR = 0.1

const app = new Hono()

function getTableName(entityType: string): string {
  const map: Record<string, string> = {
    country: 'countries',
    game: 'games',
    region: 'regions',
    organisation: 'organisations',
    organisationGame: 'organisation_games',
    brand: 'brands',
    peripheral: 'peripherals',
    role: 'roles',
    weapon: 'weapons',
    character: 'characters',
    player: 'players',
  }
  return map[entityType] || entityType
}

// POST /play/click - add aura from play page clicks
app.post('/click', async (c) => {
  const body = await c.req.json()
  const { entityId, entityType, clicks } = body

  if (!entityId || !entityType) {
    return c.json({ error: 'Missing entityId or entityType' }, 400)
  }

  const table = getTableName(entityType)
  if (!table) {
    return c.json({ error: 'Invalid entity type' }, 400)
  }

  // Support batched clicks (default 1)
  const clickCount = Math.min(Math.max(1, clicks || 1), 100) // Cap at 100 per request
  const auraDelta = CLICK_AURA_VALUE * clickCount

  await pool.query(
    `UPDATE ${table} SET aura_score = ROUND((aura_score + $1)::numeric, 2) WHERE id = $2`,
    [auraDelta, entityId]
  )

  // Get updated score
  const result = await pool.query(`SELECT aura_score FROM ${table} WHERE id = $1`, [entityId])
  const newScore = result.rows.length > 0 ? (result.rows[0] as any).aura_score : 0

  return c.json({ auraScore: newScore, added: auraDelta })
})

export default app
