import { Hono } from 'hono'
import { pool } from '../db/index.js'
import type { DbCountry, DbGame, DbRegion, DbOrganisation, DbBrand, DbPeripheral, DbRole, DbCharacter, DbPlayer } from '../db/index.js'

const app = new Hono()

function toApiEntity(row: Record<string, unknown>, type: string) {
  const result: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    auraScore: row.aura_score,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    type,
  }

  if (row.aliases) {
    result.aliases = typeof row.aliases === 'string' ? JSON.parse(row.aliases) : row.aliases
  }
  if (row.game_ids) {
    result.gameIds = typeof row.game_ids === 'string' ? JSON.parse(row.game_ids) : row.game_ids
  }
  if (row.associated_entity_ids) {
    result.associatedEntityIds = typeof row.associated_entity_ids === 'string' ? JSON.parse(row.associated_entity_ids) : row.associated_entity_ids
  }

  if ('flag_code' in row) result.flagCode = row.flag_code
  if ('game_type' in row) result.gameType = row.game_type
  if ('game_id' in row) result.gameId = row.game_id
  if ('organisation_id' in row) result.organisationId = row.organisation_id
  if ('brand_id' in row) result.brandId = row.brand_id
  if ('peripheral_type' in row) result.peripheralType = row.peripheral_type
  if ('country_id' in row) result.countryId = row.country_id
  if ('main_game_id' in row) result.mainGameId = row.main_game_id
  if ('region_id' in row) result.regionId = row.region_id
  if ('is_user_profile' in row) result.isUserProfile = Boolean(row.is_user_profile)
  if ('visitor_id' in row) result.visitorId = row.visitor_id

  return result
}

app.get('/countries', async (c) => {
  const result = await pool.query('SELECT * FROM countries ORDER BY aura_score DESC')
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'country')))
})

app.get('/countries/:id', async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM countries WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'country'))
})

app.get('/games', async (c) => {
  const result = await pool.query('SELECT * FROM games ORDER BY aura_score DESC')
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'game')))
})

app.get('/games/:id', async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM games WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'game'))
})

app.get('/regions', async (c) => {
  const gameId = c.req.query('gameId')
  let result
  if (gameId) {
    result = await pool.query('SELECT * FROM regions WHERE game_id = $1 ORDER BY aura_score DESC', [gameId])
  } else {
    result = await pool.query('SELECT * FROM regions ORDER BY aura_score DESC')
  }
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'region')))
})

app.get('/regions/:id', async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM regions WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'region'))
})

app.get('/organisations', async (c) => {
  const result = await pool.query('SELECT * FROM organisations ORDER BY aura_score DESC')
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'organisation')))
})

app.get('/organisations/:id', async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM organisations WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'organisation'))
})

app.get('/organisation-games', async (c) => {
  const result = await pool.query('SELECT * FROM organisation_games ORDER BY aura_score DESC')
  return c.json(result.rows.map(r => toApiEntity(r as Record<string, unknown>, 'organisationGame')))
})

app.get('/brands', async (c) => {
  const result = await pool.query('SELECT * FROM brands ORDER BY aura_score DESC')
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'brand')))
})

app.get('/brands/:id', async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM brands WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'brand'))
})

app.get('/peripherals', async (c) => {
  const brandId = c.req.query('brandId')
  const peripheralType = c.req.query('type')
  let sql = 'SELECT * FROM peripherals WHERE 1=1'
  const params: string[] = []
  let paramIndex = 1
  if (brandId) { sql += ` AND brand_id = $${paramIndex++}`; params.push(brandId) }
  if (peripheralType) { sql += ` AND peripheral_type = $${paramIndex++}`; params.push(peripheralType) }
  sql += ' ORDER BY aura_score DESC'
  const result = await pool.query(sql, params)
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'peripheral')))
})

app.get('/peripherals/:id', async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM peripherals WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'peripheral'))
})

app.get('/roles', async (c) => {
  const gameId = c.req.query('gameId')
  let result
  if (gameId) {
    result = await pool.query('SELECT * FROM roles WHERE game_id = $1 ORDER BY aura_score DESC', [gameId])
  } else {
    result = await pool.query('SELECT * FROM roles ORDER BY aura_score DESC')
  }
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'role')))
})

app.get('/weapons', async (c) => {
  const gameId = c.req.query('gameId')
  let result
  if (gameId) {
    result = await pool.query('SELECT * FROM weapons WHERE game_id = $1 ORDER BY aura_score DESC', [gameId])
  } else {
    result = await pool.query('SELECT * FROM weapons ORDER BY aura_score DESC')
  }
  return c.json(result.rows.map(r => toApiEntity(r as Record<string, unknown>, 'weapon')))
})

app.get('/characters', async (c) => {
  const gameId = c.req.query('gameId')
  let result
  if (gameId) {
    result = await pool.query('SELECT * FROM characters WHERE game_id = $1 ORDER BY aura_score DESC', [gameId])
  } else {
    result = await pool.query('SELECT * FROM characters ORDER BY aura_score DESC')
  }
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'character')))
})

app.get('/players', async (c) => {
  const gameId = c.req.query('gameId')
  const organisationId = c.req.query('organisationId')
  const countryId = c.req.query('countryId')
  const search = c.req.query('search')

  let sql = 'SELECT * FROM players WHERE 1=1'
  const params: string[] = []
  let paramIndex = 1

  if (gameId) { sql += ` AND main_game_id = $${paramIndex++}`; params.push(gameId) }
  if (organisationId) { sql += ` AND organisation_id = $${paramIndex++}`; params.push(organisationId) }
  if (countryId) { sql += ` AND country_id = $${paramIndex++}`; params.push(countryId) }
  if (search) { sql += ` AND LOWER(name) LIKE $${paramIndex++}`; params.push(`%${search.toLowerCase()}%`) }

  sql += ' ORDER BY aura_score DESC LIMIT 20'
  const result = await pool.query(sql, params)
  return c.json(result.rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'player')))
})

app.get('/players/:id', async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM players WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'player'))
})

app.post('/players', async (c) => {
  const body = await c.req.json()
  const { visitorId, name, countryId, organisationId, mainGameId, regionId, gameIds } = body

  const playerId = `player-user-${visitorId.slice(0, 8)}`
  const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `user-${visitorId.slice(0, 8)}`

  await pool.query(
    `INSERT INTO players (id, name, slug, country_id, organisation_id, main_game_id, region_id, game_ids, is_user_profile, visitor_id, aura_score, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, 0, $10)
     ON CONFLICT (id) DO NOTHING`,
    [playerId, name || '', slug, countryId || null, organisationId || null, mainGameId || null, regionId || null,
     JSON.stringify(gameIds || []), visitorId, new Date().toISOString()]
  )

  await pool.query(
    'INSERT INTO user_profiles (visitor_id, player_id) VALUES ($1, $2) ON CONFLICT (visitor_id) DO NOTHING',
    [visitorId, playerId]
  )

  const result = await pool.query('SELECT * FROM players WHERE id = $1', [playerId])
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'player'))
})

app.patch('/players/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const updates: string[] = []
  const params: (string | number | null)[] = []
  let paramIndex = 1

  if (body.name !== undefined) {
    updates.push(`name = $${paramIndex++}`, `slug = $${paramIndex++}`)
    params.push(body.name, body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  }
  if (body.countryId !== undefined) { updates.push(`country_id = $${paramIndex++}`); params.push(body.countryId) }
  if (body.organisationId !== undefined) { updates.push(`organisation_id = $${paramIndex++}`); params.push(body.organisationId || null) }
  if (body.mainGameId !== undefined) { updates.push(`main_game_id = $${paramIndex++}`); params.push(body.mainGameId) }
  if (body.regionId !== undefined) { updates.push(`region_id = $${paramIndex++}`); params.push(body.regionId) }
  if (body.gameIds !== undefined) { updates.push(`game_ids = $${paramIndex++}`); params.push(JSON.stringify(body.gameIds)) }
  if (body.associatedEntityIds !== undefined) { updates.push(`associated_entity_ids = $${paramIndex++}`); params.push(JSON.stringify(body.associatedEntityIds)) }

  if (updates.length > 0) {
    params.push(id)
    await pool.query(`UPDATE players SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params)
  }

  const result = await pool.query('SELECT * FROM players WHERE id = $1', [id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'player'))
})

app.get('/user-profile/:visitorId', async (c) => {
  const visitorId = c.req.param('visitorId')
  const profileResult = await pool.query('SELECT * FROM user_profiles WHERE visitor_id = $1', [visitorId])

  if (profileResult.rows.length === 0) return c.json({ error: 'Not found' }, 404)

  const profile = profileResult.rows[0] as { player_id: string }
  const result = await pool.query('SELECT * FROM players WHERE id = $1', [profile.player_id])
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404)

  return c.json(toApiEntity(result.rows[0] as unknown as Record<string, unknown>, 'player'))
})

export default app
