// ============================================================================
// ENUMS (as const objects for erasableSyntaxOnly compatibility)
// ============================================================================

export const GameType = {
  FPS: 'FPS',
  MOBA: 'MOBA',
  FIGHTING: 'FIGHTING',
  CARD: 'CARD',
  BATTLE_ROYALE: 'BATTLE_ROYALE',
  SPORTS: 'SPORTS',
  OTHER: 'OTHER',
} as const

export type GameType = (typeof GameType)[keyof typeof GameType]

export const PeripheralType = {
  MOUSE: 'MOUSE',
  KEYBOARD: 'KEYBOARD',
  HEADSET: 'HEADSET',
  MONITOR: 'MONITOR',
  MOUSEPAD: 'MOUSEPAD',
  CONTROLLER: 'CONTROLLER',
} as const

export type PeripheralType = (typeof PeripheralType)[keyof typeof PeripheralType]

export const VoteDirection = {
  UP: 'UP',
  DOWN: 'DOWN',
} as const

export type VoteDirection = (typeof VoteDirection)[keyof typeof VoteDirection]

// ============================================================================
// ENTITY TYPE IDENTIFIERS
// ============================================================================

export const EntityTypes = {
  COUNTRY: 'country',
  GAME: 'game',
  REGION: 'region',
  ORGANISATION: 'organisation',
  ORGANISATION_GAME: 'organisationGame',
  ROLE: 'role',
  WEAPON: 'weapon',
  CHARACTER: 'character',
  BRAND: 'brand',
  PERIPHERAL: 'peripheral',
  PLAYER: 'player',
} as const

export type EntityType = (typeof EntityTypes)[keyof typeof EntityTypes]

// ============================================================================
// BASE ENTITY
// ============================================================================

export interface BaseEntity {
  id: string
  name: string
  slug: string
  auraScore: number
  createdAt: Date
  imageUrl?: string
  aliases?: string[]
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface Country extends BaseEntity {
  type: typeof EntityTypes.COUNTRY
  flagCode: string
}

export interface Game extends BaseEntity {
  type: typeof EntityTypes.GAME
  gameType: GameType
}

export interface Region extends BaseEntity {
  type: typeof EntityTypes.REGION
  gameId: string
}

export interface Organisation extends BaseEntity {
  type: typeof EntityTypes.ORGANISATION
}

export interface OrganisationGame extends BaseEntity {
  type: typeof EntityTypes.ORGANISATION_GAME
  organisationId: string
  gameId: string
}

export interface Role extends BaseEntity {
  type: typeof EntityTypes.ROLE
  gameId: string
}

export interface Weapon extends BaseEntity {
  type: typeof EntityTypes.WEAPON
  gameId: string
}

export interface Character extends BaseEntity {
  type: typeof EntityTypes.CHARACTER
  gameId: string
}

export interface Brand extends BaseEntity {
  type: typeof EntityTypes.BRAND
}

export interface Peripheral extends BaseEntity {
  type: typeof EntityTypes.PERIPHERAL
  peripheralType: PeripheralType
  brandId: string
}

export interface Player extends BaseEntity {
  type: typeof EntityTypes.PLAYER
  countryId: string
  organisationId?: string
  mainGameId: string
  regionId: string
  gameIds: string[]
  associatedEntityIds?: string[]
  isUserProfile?: boolean
  visitorId?: string
  bio?: string
}

// ============================================================================
// UNION TYPES
// ============================================================================

export type Entity =
  | Country
  | Game
  | Region
  | Organisation
  | OrganisationGame
  | Role
  | Weapon
  | Character
  | Brand
  | Peripheral
  | Player

// ============================================================================
// VOTE TYPES
// ============================================================================

export interface Vote {
  id: string
  visitorId: string
  entityId: string
  entityType: EntityType
  direction: VoteDirection
  timestamp: Date
}

// ============================================================================
// ENTITY STATE MAPS
// ============================================================================

export interface EntitiesState {
  countries: Record<string, Country>
  games: Record<string, Game>
  regions: Record<string, Region>
  organisations: Record<string, Organisation>
  organisationGames: Record<string, OrganisationGame>
  roles: Record<string, Role>
  weapons: Record<string, Weapon>
  characters: Record<string, Character>
  brands: Record<string, Brand>
  peripherals: Record<string, Peripheral>
  players: Record<string, Player>
  votes: Record<string, Vote>
  userProfiles: Record<string, string> // visitorId -> playerId
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function isCountry(entity: Entity): entity is Country {
  return entity.type === EntityTypes.COUNTRY
}

export function isGame(entity: Entity): entity is Game {
  return entity.type === EntityTypes.GAME
}

export function isRegion(entity: Entity): entity is Region {
  return entity.type === EntityTypes.REGION
}

export function isOrganisation(entity: Entity): entity is Organisation {
  return entity.type === EntityTypes.ORGANISATION
}

export function isOrganisationGame(entity: Entity): entity is OrganisationGame {
  return entity.type === EntityTypes.ORGANISATION_GAME
}

export function isRole(entity: Entity): entity is Role {
  return entity.type === EntityTypes.ROLE
}

export function isWeapon(entity: Entity): entity is Weapon {
  return entity.type === EntityTypes.WEAPON
}

export function isCharacter(entity: Entity): entity is Character {
  return entity.type === EntityTypes.CHARACTER
}

export function isBrand(entity: Entity): entity is Brand {
  return entity.type === EntityTypes.BRAND
}

export function isPeripheral(entity: Entity): entity is Peripheral {
  return entity.type === EntityTypes.PERIPHERAL
}

export function isPlayer(entity: Entity): entity is Player {
  return entity.type === EntityTypes.PLAYER
}

// ============================================================================
// AURA PROPAGATION CONFIG
// ============================================================================

export const AURA_PROPAGATION_FACTOR = 0.1 // 10% of vote value propagates to parent entities
export const VOTE_VALUE = 1 // Base value of a single vote
