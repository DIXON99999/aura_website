import { Hono } from 'hono'
import { db } from '../db/index.js'
import type { DbCountry, DbGame, DbRegion, DbOrganisation, DbBrand, DbPeripheral, DbRole, DbCharacter, DbPlayer } from '../db/index.js'

const app = new Hono()

// Transform DB row to API response
function toApiEntity(row: Record<string, unknown>, type: string) {
  const result: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    auraScore: row.aura_score,
    imageUrl: row.image_url,
    createdAt: new Date(row.created_at as number),
    type,
  }

  // Parse JSON fields
  if (row.aliases && typeof row.aliases === 'string') {
    try { result.aliases = JSON.parse(row.aliases) } catch { result.aliases = [] }
  }
  if (row.game_ids && typeof row.game_ids === 'string') {
    try { result.gameIds = JSON.parse(row.game_ids) } catch { result.gameIds = [] }
  }
  if (row.associated_entity_ids && typeof row.associated_entity_ids === 'string') {
    try { result.associatedEntityIds = JSON.parse(row.associated_entity_ids) } catch { result.associatedEntityIds = [] }
  }

  // Map snake_case to camelCase
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

// GET /countries
app.get('/countries', (c) => {
  const rows = db.query('SELECT * FROM countries ORDER BY aura_score DESC').all() as DbCountry[]
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'country')))
})

// GET /countries/:id
app.get('/countries/:id', (c) => {
  const id = c.req.param('id')
  const row = db.query('SELECT * FROM countries WHERE id = ?').get(id) as DbCountry | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'country'))
})

// GET /games
app.get('/games', (c) => {
  const rows = db.query('SELECT * FROM games ORDER BY aura_score DESC').all() as DbGame[]
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'game')))
})

// GET /games/:id
app.get('/games/:id', (c) => {
  const id = c.req.param('id')
  const row = db.query('SELECT * FROM games WHERE id = ?').get(id) as DbGame | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'game'))
})

// GET /regions
app.get('/regions', (c) => {
  const gameId = c.req.query('gameId')
  let rows: DbRegion[]
  if (gameId) {
    rows = db.query('SELECT * FROM regions WHERE game_id = ? ORDER BY aura_score DESC').all(gameId) as DbRegion[]
  } else {
    rows = db.query('SELECT * FROM regions ORDER BY aura_score DESC').all() as DbRegion[]
  }
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'region')))
})

// GET /regions/:id
app.get('/regions/:id', (c) => {
  const id = c.req.param('id')
  const row = db.query('SELECT * FROM regions WHERE id = ?').get(id) as DbRegion | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'region'))
})

// GET /organisations
app.get('/organisations', (c) => {
  const rows = db.query('SELECT * FROM organisations ORDER BY aura_score DESC').all() as DbOrganisation[]
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'organisation')))
})

// GET /organisations/:id
app.get('/organisations/:id', (c) => {
  const id = c.req.param('id')
  const row = db.query('SELECT * FROM organisations WHERE id = ?').get(id) as DbOrganisation | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'organisation'))
})

// GET /organisation-games
app.get('/organisation-games', (c) => {
  const rows = db.query('SELECT * FROM organisation_games ORDER BY aura_score DESC').all()
  return c.json(rows.map(r => toApiEntity(r as Record<string, unknown>, 'organisationGame')))
})

// GET /brands
app.get('/brands', (c) => {
  const rows = db.query('SELECT * FROM brands ORDER BY aura_score DESC').all() as DbBrand[]
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'brand')))
})

// GET /brands/:id
app.get('/brands/:id', (c) => {
  const id = c.req.param('id')
  const row = db.query('SELECT * FROM brands WHERE id = ?').get(id) as DbBrand | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'brand'))
})

// GET /peripherals
app.get('/peripherals', (c) => {
  const brandId = c.req.query('brandId')
  const peripheralType = c.req.query('type')
  let sql = 'SELECT * FROM peripherals WHERE 1=1'
  const params: string[] = []
  if (brandId) { sql += ' AND brand_id = ?'; params.push(brandId) }
  if (peripheralType) { sql += ' AND peripheral_type = ?'; params.push(peripheralType) }
  sql += ' ORDER BY aura_score DESC'
  const rows = db.query(sql).all(...params) as DbPeripheral[]
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'peripheral')))
})

// GET /peripherals/:id
app.get('/peripherals/:id', (c) => {
  const id = c.req.param('id')
  const row = db.query('SELECT * FROM peripherals WHERE id = ?').get(id) as DbPeripheral | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'peripheral'))
})

// GET /roles
app.get('/roles', (c) => {
  const gameId = c.req.query('gameId')
  let rows: DbRole[]
  if (gameId) {
    rows = db.query('SELECT * FROM roles WHERE game_id = ? ORDER BY aura_score DESC').all(gameId) as DbRole[]
  } else {
    rows = db.query('SELECT * FROM roles ORDER BY aura_score DESC').all() as DbRole[]
  }
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'role')))
})

// GET /weapons
app.get('/weapons', (c) => {
  const gameId = c.req.query('gameId')
  let rows
  if (gameId) {
    rows = db.query('SELECT * FROM weapons WHERE game_id = ? ORDER BY aura_score DESC').all(gameId)
  } else {
    rows = db.query('SELECT * FROM weapons ORDER BY aura_score DESC').all()
  }
  return c.json(rows.map(r => toApiEntity(r as Record<string, unknown>, 'weapon')))
})

// GET /characters
app.get('/characters', (c) => {
  const gameId = c.req.query('gameId')
  let rows: DbCharacter[]
  if (gameId) {
    rows = db.query('SELECT * FROM characters WHERE game_id = ? ORDER BY aura_score DESC').all(gameId) as DbCharacter[]
  } else {
    rows = db.query('SELECT * FROM characters ORDER BY aura_score DESC').all() as DbCharacter[]
  }
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'character')))
})

// GET /players
app.get('/players', (c) => {
  const gameId = c.req.query('gameId')
  const organisationId = c.req.query('organisationId')
  const countryId = c.req.query('countryId')

  let sql = 'SELECT * FROM players WHERE 1=1'
  const params: string[] = []

  if (gameId) { sql += ' AND main_game_id = ?'; params.push(gameId) }
  if (organisationId) { sql += ' AND organisation_id = ?'; params.push(organisationId) }
  if (countryId) { sql += ' AND country_id = ?'; params.push(countryId) }

  sql += ' ORDER BY aura_score DESC'
  const rows = db.query(sql).all(...params) as DbPlayer[]
  return c.json(rows.map(r => toApiEntity(r as unknown as Record<string, unknown>, 'player')))
})

// GET /players/:id
app.get('/players/:id', (c) => {
  const id = c.req.param('id')
  const row = db.query('SELECT * FROM players WHERE id = ?').get(id) as DbPlayer | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'player'))
})

// POST /players (create user profile)
app.post('/players', async (c) => {
  const body = await c.req.json()
  const { visitorId, name, countryId, organisationId, mainGameId, regionId, gameIds } = body

  const playerId = `player-user-${visitorId.slice(0, 8)}`
  const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `user-${visitorId.slice(0, 8)}`

  db.run(
    `INSERT OR IGNORE INTO players (id, name, slug, country_id, organisation_id, main_game_id, region_id, game_ids, is_user_profile, visitor_id, aura_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?)`,
    playerId, name || '', slug, countryId || null, organisationId || null, mainGameId || null, regionId || null,
    JSON.stringify(gameIds || []), visitorId, Date.now()
  )

  db.run('INSERT OR IGNORE INTO user_profiles (visitor_id, player_id) VALUES (?, ?)', visitorId, playerId)

  const row = db.query('SELECT * FROM players WHERE id = ?').get(playerId) as DbPlayer
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'player'))
})

// PATCH /players/:id
app.patch('/players/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const updates: string[] = []
  const params: (string | number | null)[] = []

  if (body.name !== undefined) {
    updates.push('name = ?', 'slug = ?')
    params.push(body.name, body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  }
  if (body.countryId !== undefined) { updates.push('country_id = ?'); params.push(body.countryId) }
  if (body.organisationId !== undefined) { updates.push('organisation_id = ?'); params.push(body.organisationId || null) }
  if (body.mainGameId !== undefined) { updates.push('main_game_id = ?'); params.push(body.mainGameId) }
  if (body.regionId !== undefined) { updates.push('region_id = ?'); params.push(body.regionId) }
  if (body.gameIds !== undefined) { updates.push('game_ids = ?'); params.push(JSON.stringify(body.gameIds)) }
  if (body.associatedEntityIds !== undefined) { updates.push('associated_entity_ids = ?'); params.push(JSON.stringify(body.associatedEntityIds)) }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`, ...params)
  }

  const row = db.query('SELECT * FROM players WHERE id = ?').get(id) as DbPlayer | null
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'player'))
})

// GET /user-profile/:visitorId
app.get('/user-profile/:visitorId', (c) => {
  const visitorId = c.req.param('visitorId')
  const profile = db.query('SELECT * FROM user_profiles WHERE visitor_id = ?').get(visitorId) as { player_id: string } | null

  if (!profile) return c.json({ error: 'Not found' }, 404)

  const row = db.query('SELECT * FROM players WHERE id = ?').get(profile.player_id) as DbPlayer | null
  if (!row) return c.json({ error: 'Not found' }, 404)

  return c.json(toApiEntity(row as unknown as Record<string, unknown>, 'player'))
})

export default app
