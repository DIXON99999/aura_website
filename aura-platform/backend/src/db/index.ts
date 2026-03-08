import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('digitalocean') ? { rejectUnauthorized: false } : undefined,
})

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
}

async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS countries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      flag_code TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      game_type TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      game_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organisations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organisation_games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      organisation_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS peripherals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      peripheral_type TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      game_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS weapons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      game_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      game_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      country_id TEXT,
      organisation_id TEXT,
      main_game_id TEXT,
      region_id TEXT,
      game_ids TEXT,
      associated_entity_ids TEXT,
      is_user_profile INTEGER DEFAULT 0,
      visitor_id TEXT,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT,
      aliases TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      visitor_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      player_id TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      game_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      image_url TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_participants (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      player_id TEXT,
      temp_name TEXT,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_votes (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_events (
      id TEXT PRIMARY KEY,
      leaderboard_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      image_url TEXT,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_comments (
      id TEXT PRIMARY KEY,
      sub_event_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_participants (
      id TEXT PRIMARY KEY,
      sub_event_id TEXT NOT NULL,
      leaderboard_participant_id TEXT NOT NULL,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_votes (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      sub_event_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aura_farms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      image_url TEXT,
      aura_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aura_farm_votes (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      farm_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      links TEXT,
      submitted_by_visitor_id TEXT,
      submitted_by_user_id TEXT,
      submitted_by_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      from_user_id TEXT,
      from_username TEXT NOT NULL,
      content TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aura_farm_comments (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      user_id TEXT,
      username TEXT NOT NULL,
      content TEXT,
      parent_id TEXT,
      vote_count INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aura_farm_comment_votes (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_event_comment_votes (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `)

  // Add missing columns to sub_event_comments if they don't exist
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS user_id TEXT;
      ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS parent_id TEXT;
      ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sub_event_comments ADD COLUMN IF NOT EXISTS image_url TEXT;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$
  `)

  // Seed CS2 weapons
  const cs2Weapons = [
    { id: 'weapon-cs2-ak47', name: 'AK-47', slug: 'cs2-ak47' },
    { id: 'weapon-cs2-m4a4', name: 'M4A4', slug: 'cs2-m4a4' },
    { id: 'weapon-cs2-m4a1s', name: 'M4A1-S', slug: 'cs2-m4a1s' },
    { id: 'weapon-cs2-awp', name: 'AWP', slug: 'cs2-awp' },
    { id: 'weapon-cs2-desert-eagle', name: 'Desert Eagle', slug: 'cs2-desert-eagle' },
    { id: 'weapon-cs2-usp-s', name: 'USP-S', slug: 'cs2-usp-s' },
    { id: 'weapon-cs2-glock', name: 'Glock-18', slug: 'cs2-glock' },
    { id: 'weapon-cs2-p2000', name: 'P2000', slug: 'cs2-p2000' },
    { id: 'weapon-cs2-famas', name: 'FAMAS', slug: 'cs2-famas' },
    { id: 'weapon-cs2-galil', name: 'Galil AR', slug: 'cs2-galil' },
    { id: 'weapon-cs2-sg553', name: 'SG 553', slug: 'cs2-sg553' },
    { id: 'weapon-cs2-aug', name: 'AUG', slug: 'cs2-aug' },
    { id: 'weapon-cs2-ssg08', name: 'SSG 08', slug: 'cs2-ssg08' },
    { id: 'weapon-cs2-scar20', name: 'SCAR-20', slug: 'cs2-scar20' },
    { id: 'weapon-cs2-g3sg1', name: 'G3SG1', slug: 'cs2-g3sg1' },
    { id: 'weapon-cs2-mac10', name: 'MAC-10', slug: 'cs2-mac10' },
    { id: 'weapon-cs2-mp9', name: 'MP9', slug: 'cs2-mp9' },
    { id: 'weapon-cs2-mp7', name: 'MP7', slug: 'cs2-mp7' },
    { id: 'weapon-cs2-ump45', name: 'UMP-45', slug: 'cs2-ump45' },
    { id: 'weapon-cs2-p90', name: 'P90', slug: 'cs2-p90' },
    { id: 'weapon-cs2-pp-bizon', name: 'PP-Bizon', slug: 'cs2-pp-bizon' },
    { id: 'weapon-cs2-mp5sd', name: 'MP5-SD', slug: 'cs2-mp5sd' },
    { id: 'weapon-cs2-nova', name: 'Nova', slug: 'cs2-nova' },
    { id: 'weapon-cs2-xm1014', name: 'XM1014', slug: 'cs2-xm1014' },
    { id: 'weapon-cs2-mag7', name: 'MAG-7', slug: 'cs2-mag7' },
    { id: 'weapon-cs2-sawedoff', name: 'Sawed-Off', slug: 'cs2-sawedoff' },
    { id: 'weapon-cs2-m249', name: 'M249', slug: 'cs2-m249' },
    { id: 'weapon-cs2-negev', name: 'Negev', slug: 'cs2-negev' },
    { id: 'weapon-cs2-p250', name: 'P250', slug: 'cs2-p250' },
    { id: 'weapon-cs2-tec9', name: 'Tec-9', slug: 'cs2-tec9' },
    { id: 'weapon-cs2-fiveseven', name: 'Five-SeveN', slug: 'cs2-fiveseven' },
    { id: 'weapon-cs2-cz75', name: 'CZ75-Auto', slug: 'cs2-cz75' },
    { id: 'weapon-cs2-dualberettas', name: 'Dual Berettas', slug: 'cs2-dualberettas' },
    { id: 'weapon-cs2-r8revolver', name: 'R8 Revolver', slug: 'cs2-r8revolver' },
    { id: 'weapon-cs2-knife', name: 'Knife', slug: 'cs2-knife' },
  ]

  const gameCs2Id = 'game-cs2'
  const now = new Date().toISOString()
  for (const w of cs2Weapons) {
    await pool.query(
      `INSERT INTO weapons (id, name, slug, game_id, aura_score, created_at) 
       VALUES ($1, $2, $3, $4, 0, $5) 
       ON CONFLICT (id) DO NOTHING`,
      [w.id, w.name, w.slug, gameCs2Id, now]
    )
  }
}

initTables().catch(console.error)

// Helper types
export interface DbEntity {
  id: string
  name: string
  slug: string
  aura_score: number
  image_url: string | null
  aliases: string | null
  created_at: number
}

export interface DbCountry extends DbEntity {
  flag_code: string
}

export interface DbGame extends DbEntity {
  game_type: string
}

export interface DbRegion extends DbEntity {
  game_id: string
}

export interface DbOrganisation extends DbEntity {}

export interface DbOrganisationGame extends DbEntity {
  organisation_id: string
  game_id: string
}

export interface DbBrand extends DbEntity {}

export interface DbPeripheral extends DbEntity {
  peripheral_type: string
  brand_id: string
}

export interface DbRole extends DbEntity {
  game_id: string
}

export interface DbWeapon extends DbEntity {
  game_id: string
}

export interface DbCharacter extends DbEntity {
  game_id: string
}

export interface DbPlayer extends DbEntity {
  country_id: string | null
  organisation_id: string | null
  main_game_id: string | null
  region_id: string | null
  game_ids: string | null
  associated_entity_ids: string | null
  is_user_profile: number
  visitor_id: string | null
}

export interface DbVote {
  id: string
  visitor_id: string
  entity_id: string
  entity_type: string
  direction: string
  timestamp: number
}

export interface DbUserProfile {
  visitor_id: string
  player_id: string
}

export interface DbUser {
  id: string
  email: string
  password_hash: string
  player_id: string | null
  created_at: number
}

export interface DbSession {
  id: string
  user_id: string
  expires_at: number
  created_at: number
}

export interface DbEvent {
  id: string
  name: string
  slug: string
  game_id: string
  owner_id: string
  is_public: number
  created_at: number
}

export interface DbEventParticipant {
  id: string
  event_id: string
  player_id: string | null
  temp_name: string | null
  aura_score: number
  created_at: number
}

export interface DbEventVote {
  id: string
  visitor_id: string
  event_id: string
  participant_id: string
  direction: string
  timestamp: number
}

export interface DbSubEvent {
  id: string
  leaderboard_id: string
  name: string
  slug: string
  image_url: string | null
  created_at: number
}

export interface DbSubEventComment {
  id: string
  sub_event_id: string
  visitor_id: string
  user_id: string | null
  username: string | null
  content: string
  parent_id: string | null
  vote_count: number
  image_url: string | null
  created_at: number
}

export interface DbSubEventParticipant {
  id: string
  sub_event_id: string
  leaderboard_participant_id: string
  aura_score: number
  created_at: number
}

export interface DbSubEventVote {
  id: string
  visitor_id: string
  sub_event_id: string
  participant_id: string
  direction: string
  timestamp: number
}

export interface DbAuraFarm {
  id: string
  title: string
  description: string | null
  entity_id: string
  entity_type: string
  owner_id: string
  image_url: string | null
  aura_score: number
  created_at: number
}

export interface DbAuraFarmVote {
  id: string
  visitor_id: string
  farm_id: string
  direction: string
  timestamp: number
}
