import { Database } from 'bun:sqlite'

export const db = new Database('aura.db', { create: true })

// Initialize tables
db.run(`
  CREATE TABLE IF NOT EXISTS countries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    flag_code TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_type TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS organisations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS organisation_games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    organisation_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS peripherals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    peripheral_type TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS weapons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
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
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    visitor_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL
  )
`)

// Auth tables
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    player_id TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`)

// Events tables
db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS event_participants (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    player_id TEXT,
    temp_name TEXT,
    aura_score REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS event_votes (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`)

// Sub-events (belong to a leaderboard)
db.run(`
  CREATE TABLE IF NOT EXISTS sub_events (
    id TEXT PRIMARY KEY,
    leaderboard_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    image_url TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sub_event_comments (
    id TEXT PRIMARY KEY,
    sub_event_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sub_event_participants (
    id TEXT PRIMARY KEY,
    sub_event_id TEXT NOT NULL,
    leaderboard_participant_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sub_event_votes (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    sub_event_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`)

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
  username: string | null
  content: string
  parent_id: string | null
  vote_count: number
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
