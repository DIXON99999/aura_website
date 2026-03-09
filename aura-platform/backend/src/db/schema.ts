import { pgTable, text, doublePrecision, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core'

// Countries
export const countries = pgTable('countries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  flagCode: text('flag_code').notNull(),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Games
export const games = pgTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameType: text('game_type').notNull(),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Regions
export const regions = pgTable('regions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Organisations
export const organisations = pgTable('organisations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Organisation Games (teams for specific games)
export const organisationGames = pgTable('organisation_games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  organisationId: text('organisation_id').notNull().references(() => organisations.id),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Brands
export const brands = pgTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Peripherals
export const peripherals = pgTable('peripherals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  peripheralType: text('peripheral_type').notNull(),
  brandId: text('brand_id').notNull().references(() => brands.id),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Roles (game-specific)
export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Weapons (game-specific)
export const weapons = pgTable('weapons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Characters (game-specific)
export const characters = pgTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull().references(() => games.id),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Players
export const players = pgTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  countryId: text('country_id').references(() => countries.id),
  organisationId: text('organisation_id').references(() => organisations.id),
  mainGameId: text('main_game_id').references(() => games.id),
  regionId: text('region_id').references(() => regions.id),
  gameIds: jsonb('game_ids').$type<string[]>(),
  associatedEntityIds: jsonb('associated_entity_ids').$type<string[]>(),
  isUserProfile: boolean('is_user_profile').default(false),
  visitorId: text('visitor_id'),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  imageUrl: text('image_url'),
  aliases: jsonb('aliases').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Votes
export const votes = pgTable('votes', {
  id: text('id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  direction: text('direction').notNull(), // 'UP' or 'DOWN'
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
})

// User Profiles mapping (visitorId -> playerId)
export const userProfiles = pgTable('user_profiles', {
  visitorId: text('visitor_id').primaryKey(),
  playerId: text('player_id').notNull().references(() => players.id),
})

// Users (auth)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  playerId: text('player_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Sessions (auth)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Events
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  gameId: text('game_id').notNull(),
  ownerId: text('owner_id').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  description: text('description'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Event Participants
export const eventParticipants = pgTable('event_participants', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  playerId: text('player_id'),
  tempName: text('temp_name'),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Event Votes
export const eventVotes = pgTable('event_votes', {
  id: text('id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  eventId: text('event_id').notNull(),
  participantId: text('participant_id').notNull(),
  direction: text('direction').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
})

// Sub Events
export const subEvents = pgTable('sub_events', {
  id: text('id').primaryKey(),
  leaderboardId: text('leaderboard_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Sub Event Comments
export const subEventComments = pgTable('sub_event_comments', {
  id: text('id').primaryKey(),
  subEventId: text('sub_event_id').notNull(),
  visitorId: text('visitor_id').notNull(),
  username: text('username'),
  content: text('content').notNull(),
  parentId: text('parent_id'),
  voteCount: integer('vote_count').notNull().default(0),
  imageUrl: text('image_url'),
  userId: text('user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Sub Event Participants
export const subEventParticipants = pgTable('sub_event_participants', {
  id: text('id').primaryKey(),
  subEventId: text('sub_event_id').notNull(),
  leaderboardParticipantId: text('leaderboard_participant_id').notNull(),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Sub Event Votes
export const subEventVotes = pgTable('sub_event_votes', {
  id: text('id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  subEventId: text('sub_event_id').notNull(),
  participantId: text('participant_id').notNull(),
  direction: text('direction').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
})

// Aura Farms
export const auraFarms = pgTable('aura_farms', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug'),
  description: text('description'),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  ownerId: text('owner_id').notNull(),
  imageUrl: text('image_url'),
  auraScore: doublePrecision('aura_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Aura Farm Votes
export const auraFarmVotes = pgTable('aura_farm_votes', {
  id: text('id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  farmId: text('farm_id').notNull(),
  direction: text('direction').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
})

// Notifications
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(), // The user being notified
  type: text('type').notNull(), // 'mention', 'reply', etc.
  sourceType: text('source_type').notNull(), // 'aura_farm_comment', 'sub_event_comment'
  sourceId: text('source_id').notNull(), // The comment ID
  sourceUrl: text('source_url').notNull(), // URL to navigate to
  fromUserId: text('from_user_id'), // Who triggered the notification
  fromUsername: text('from_username').notNull(),
  content: text('content').notNull(), // Preview of the content
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Aura Farm Comments
export const auraFarmComments = pgTable('aura_farm_comments', {
  id: text('id').primaryKey(),
  farmId: text('farm_id').notNull(),
  visitorId: text('visitor_id').notNull(),
  userId: text('user_id'),
  username: text('username').notNull(),
  content: text('content'),
  parentId: text('parent_id'),
  voteCount: integer('vote_count').notNull().default(0),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

// Aura Farm Comment Votes
export const auraFarmCommentVotes = pgTable('aura_farm_comment_votes', {
  id: text('id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  commentId: text('comment_id').notNull(),
  direction: text('direction').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
})

// Sub Event Comment Votes
export const subEventCommentVotes = pgTable('sub_event_comment_votes', {
  id: text('id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  commentId: text('comment_id').notNull(),
  direction: text('direction').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
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
export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Event = typeof events.$inferSelect
export type EventParticipant = typeof eventParticipants.$inferSelect
export type EventVote = typeof eventVotes.$inferSelect
export type SubEvent = typeof subEvents.$inferSelect
export type SubEventComment = typeof subEventComments.$inferSelect
export type SubEventParticipant = typeof subEventParticipants.$inferSelect
export type SubEventVote = typeof subEventVotes.$inferSelect
export type AuraFarm = typeof auraFarms.$inferSelect
export type AuraFarmVote = typeof auraFarmVotes.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type AuraFarmComment = typeof auraFarmComments.$inferSelect
export type AuraFarmCommentVote = typeof auraFarmCommentVotes.$inferSelect
export type SubEventCommentVote = typeof subEventCommentVotes.$inferSelect
