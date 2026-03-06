import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// Countries
export const countries = sqliteTable('countries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  flagCode: text('flag_code').notNull(),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Games
export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameType: text('game_type').notNull(),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Regions
export const regions = sqliteTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Organisations
export const organisations = sqliteTable('organisations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Organisation Games (teams for specific games)
export const organisationGames = sqliteTable('organisation_games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  organisationId: text('organisation_id').notNull().references(() => organisations.id),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Brands
export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Peripherals
export const peripherals = sqliteTable('peripherals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  peripheralType: text('peripheral_type').notNull(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Roles (game-specific)
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Weapons (game-specific)
export const weapons = sqliteTable('weapons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Characters (game-specific)
export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Players
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  countryId: text('country_id').references(() => countries.id),
  organisationId: text('organisation_id').references(() => organisations.id),
  mainGameId: text('main_game_id').references(() => games.id),
  regionId: text('region_id').references(() => regions.id),
  gameIds: text('game_ids', { mode: 'json' }).$type<string[]>(),
  associatedEntityIds: text('associated_entity_ids', { mode: 'json' }).$type<string[]>(),
  isUserProfile: integer('is_user_profile', { mode: 'boolean' }).default(false),
  visitorId: text('visitor_id'),
  auraScore: real('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// Votes
export const votes = sqliteTable('votes', {
  id: text('id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  direction: text('direction').notNull(), // 'UP' or 'DOWN'
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
})

// User Profiles mapping (visitorId -> playerId)
export const userProfiles = sqliteTable('user_profiles', {
  visitorId: text('visitor_id').primaryKey(),
  playerId: text('player_id').notNull().references(() => players.id),
})

// Type exports
export type Country = typeof countries.$inferSelect
export type Game = typeof games.$inferSelect
export type Region = typeof regions.$inferSelect
export type Organisation = typeof organisations.$inferSelect
export type OrganisationGame = typeof organisationGames.$inferSelect
export type Brand = typeof brands.$inferSelect
export type Peripheral = typeof peripherals.$inferSelect
export type Role = typeof roles.$inferSelect
export type Weapon = typeof weapons.$inferSelect
export type Character = typeof characters.$inferSelect
export type Player = typeof players.$inferSelect
export type Vote = typeof votes.$inferSelect
export type UserProfile = typeof userProfiles.$inferSelect
