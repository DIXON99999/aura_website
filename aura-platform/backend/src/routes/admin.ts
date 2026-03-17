import { Hono } from 'hono'
import { pool } from '../db/index.js'

const app = new Hono()

// Admin user email (only this user can create entities)
const ADMIN_EMAIL = 'liam.t.dixon@gmail.com'

// Verify admin middleware
async function verifyAdmin(c: any, next: () => Promise<void>) {
  const sessionId = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionResult = await pool.query(
    'SELECT s.*, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > NOW()',
    [sessionId]
  )

  if (sessionResult.rows.length === 0) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const session = sessionResult.rows[0] as { email: string; user_id: string }

  if (session.email !== ADMIN_EMAIL) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  c.set('userId', session.user_id)
  await next()
}

// Apply admin verification to all routes
app.use('*', verifyAdmin)

// Helper to generate slug
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Helper to generate ID
function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

// Create Country
app.post('/countries', async (c) => {
  const body = await c.req.json()
  const { name, flagCode, imageUrl, aliases } = body

  if (!name || !flagCode) {
    return c.json({ error: 'Name and flag code are required' }, 400)
  }

  const id = generateId('country')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO countries (id, name, slug, flag_code, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())`,
    [id, name, slug, flagCode.toLowerCase(), imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM countries WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Game
app.post('/games', async (c) => {
  const body = await c.req.json()
  const { name, gameType, imageUrl, aliases } = body

  if (!name || !gameType) {
    return c.json({ error: 'Name and game type are required' }, 400)
  }

  const id = generateId('game')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO games (id, name, slug, game_type, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())`,
    [id, name, slug, gameType, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM games WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Region
app.post('/regions', async (c) => {
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  if (!name || !gameId) {
    return c.json({ error: 'Name and game ID are required' }, 400)
  }

  const id = generateId('region')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO regions (id, name, slug, game_id, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())`,
    [id, name, slug, gameId, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM regions WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Organisation
app.post('/organisations', async (c) => {
  const body = await c.req.json()
  const { name, imageUrl, aliases } = body

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const id = generateId('org')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO organisations (id, name, slug, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, 0, $4, $5, NOW())`,
    [id, name, slug, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM organisations WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Organisation Game (Team)
app.post('/organisation-games', async (c) => {
  const body = await c.req.json()
  const { name, organisationId, gameId, imageUrl, aliases } = body

  if (!name || !organisationId || !gameId) {
    return c.json({ error: 'Name, organisation ID, and game ID are required' }, 400)
  }

  const id = generateId('orgGame')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO organisation_games (id, name, slug, organisation_id, game_id, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $7, NOW())`,
    [id, name, slug, organisationId, gameId, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM organisation_games WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Brand
app.post('/brands', async (c) => {
  const body = await c.req.json()
  const { name, imageUrl, aliases } = body

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const id = generateId('brand')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO brands (id, name, slug, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, 0, $4, $5, NOW())`,
    [id, name, slug, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM brands WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Peripheral
app.post('/peripherals', async (c) => {
  const body = await c.req.json()
  const { name, peripheralType, brandId, imageUrl, aliases } = body

  if (!name || !peripheralType || !brandId) {
    return c.json({ error: 'Name, peripheral type, and brand ID are required' }, 400)
  }

  const id = generateId('peripheral')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO peripherals (id, name, slug, peripheral_type, brand_id, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $7, NOW())`,
    [id, name, slug, peripheralType, brandId, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM peripherals WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Role
app.post('/roles', async (c) => {
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  if (!name || !gameId) {
    return c.json({ error: 'Name and game ID are required' }, 400)
  }

  const id = generateId('role')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO roles (id, name, slug, game_id, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())`,
    [id, name, slug, gameId, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Weapon
app.post('/weapons', async (c) => {
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  if (!name || !gameId) {
    return c.json({ error: 'Name and game ID are required' }, 400)
  }

  const id = generateId('weapon')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO weapons (id, name, slug, game_id, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())`,
    [id, name, slug, gameId, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM weapons WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Character
app.post('/characters', async (c) => {
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  if (!name || !gameId) {
    return c.json({ error: 'Name and game ID are required' }, 400)
  }

  const id = generateId('char')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO characters (id, name, slug, game_id, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())`,
    [id, name, slug, gameId, imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM characters WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Create Player (non-user profile)
app.post('/players', async (c) => {
  const body = await c.req.json()
  const { name, countryId, organisationId, mainGameId, regionId, imageUrl, aliases, associatedEntityIds } = body

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const id = generateId('player')
  const slug = generateSlug(name)

  await pool.query(
    `INSERT INTO players (id, name, slug, country_id, organisation_id, main_game_id, region_id,
     associated_entity_ids, is_user_profile, aura_score, image_url, aliases, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 0, $9, $10, NOW())`,
    [id, name, slug, countryId || null, organisationId || null, mainGameId || null, regionId || null,
     JSON.stringify(associatedEntityIds || []), imageUrl || null, JSON.stringify(aliases || [])]
  )

  const result = await pool.query('SELECT * FROM players WHERE id = $1', [id])
  return c.json(result.rows[0])
})

// Check if user is admin
app.get('/check', async (c) => {
  return c.json({ isAdmin: true })
})

// ============================================================================
// UPDATE ROUTES (PATCH)
// ============================================================================

// Update Country
app.patch('/countries/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, flagCode, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (flagCode !== undefined) {
    updates.push(`flag_code = $${paramIndex++}`)
    params.push(flagCode.toLowerCase())
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE countries SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM countries WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Game
app.patch('/games/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, gameType, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (gameType !== undefined) {
    updates.push(`game_type = $${paramIndex++}`)
    params.push(gameType)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE games SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM games WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Region
app.patch('/regions/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (gameId !== undefined) {
    updates.push(`game_id = $${paramIndex++}`)
    params.push(gameId)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE regions SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM regions WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Organisation
app.patch('/organisations/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE organisations SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM organisations WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Organisation Game (Team)
app.patch('/organisation-games/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, organisationId, gameId, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (organisationId !== undefined) {
    updates.push(`organisation_id = $${paramIndex++}`)
    params.push(organisationId)
  }
  if (gameId !== undefined) {
    updates.push(`game_id = $${paramIndex++}`)
    params.push(gameId)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE organisation_games SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM organisation_games WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Brand
app.patch('/brands/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE brands SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM brands WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Peripheral
app.patch('/peripherals/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, peripheralType, brandId, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (peripheralType !== undefined) {
    updates.push(`peripheral_type = $${paramIndex++}`)
    params.push(peripheralType)
  }
  if (brandId !== undefined) {
    updates.push(`brand_id = $${paramIndex++}`)
    params.push(brandId)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE peripherals SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM peripherals WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Role
app.patch('/roles/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (gameId !== undefined) {
    updates.push(`game_id = $${paramIndex++}`)
    params.push(gameId)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE roles SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Weapon
app.patch('/weapons/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (gameId !== undefined) {
    updates.push(`game_id = $${paramIndex++}`)
    params.push(gameId)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE weapons SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM weapons WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Character
app.patch('/characters/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, gameId, imageUrl, aliases } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (gameId !== undefined) {
    updates.push(`game_id = $${paramIndex++}`)
    params.push(gameId)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE characters SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM characters WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Update Player
app.patch('/players/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, countryId, organisationId, mainGameId, regionId, imageUrl, aliases, associatedEntityIds } = body

  const updates: string[] = []
  const params: (string | null)[] = []
  let paramIndex = 1

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(name, generateSlug(name))
  }
  if (countryId !== undefined) {
    updates.push(`country_id = $${paramIndex++}`)
    params.push(countryId || null)
  }
  if (organisationId !== undefined) {
    updates.push(`organisation_id = $${paramIndex++}`)
    params.push(organisationId || null)
  }
  if (mainGameId !== undefined) {
    updates.push(`main_game_id = $${paramIndex++}`)
    params.push(mainGameId || null)
  }
  if (regionId !== undefined) {
    updates.push(`region_id = $${paramIndex++}`)
    params.push(regionId || null)
  }
  if (imageUrl !== undefined) {
    updates.push(`image_url = $${paramIndex++}`)
    params.push(imageUrl || null)
  }
  if (aliases !== undefined) {
    updates.push(`aliases = $${paramIndex++}`)
    params.push(JSON.stringify(aliases))
  }
  if (associatedEntityIds !== undefined) {
    updates.push(`associated_entity_ids = $${paramIndex++}`)
    params.push(JSON.stringify(associatedEntityIds))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)
  await pool.query(`UPDATE players SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)

  const result = await pool.query('SELECT * FROM players WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(result.rows[0])
})

// Delete entity (generic)
app.delete('/:entityType/:id', async (c) => {
  const entityType = c.req.param('entityType')
  const id = c.req.param('id')

  const tableMap: Record<string, string> = {
    'countries': 'countries',
    'games': 'games',
    'regions': 'regions',
    'organisations': 'organisations',
    'organisation-games': 'organisation_games',
    'brands': 'brands',
    'peripherals': 'peripherals',
    'roles': 'roles',
    'weapons': 'weapons',
    'characters': 'characters',
    'players': 'players',
  }

  const table = tableMap[entityType]
  if (!table) {
    return c.json({ error: 'Invalid entity type' }, 400)
  }

  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id])
  return c.json({ success: true })
})

export default app
