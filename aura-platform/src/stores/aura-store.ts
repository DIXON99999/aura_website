import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  type EntitiesState,
  type Entity,
  type EntityType,
  type Vote,
  type Country,
  type Game,
  type Region,
  type Organisation,
  type OrganisationGame,
  type Role,
  type Weapon,
  type Character,
  type Brand,
  type Peripheral,
  type Player,
  EntityTypes,
  VoteDirection,
  AURA_PROPAGATION_FACTOR,
  VOTE_VALUE,
} from '@/types'

// ============================================================================
// STORE STATE INTERFACE
// ============================================================================

interface AuraStoreState extends EntitiesState {
  // Actions - Entity CRUD
  addEntity: <T extends Entity>(entity: T) => void
  removeEntity: (entityType: EntityType, entityId: string) => void
  updateEntity: <T extends Entity>(entityType: EntityType, entityId: string, updates: Partial<T>) => void

  // Actions - Voting
  vote: (visitorId: string, entityId: string, entityType: EntityType, direction: VoteDirection) => void
  removeVote: (visitorId: string, entityId: string, entityType: EntityType) => void
  getVisitorVote: (visitorId: string, entityId: string, entityType: EntityType) => Vote | undefined

  // Actions - User Profile
  createUserProfile: (visitorId: string) => Player
  updateUserProfile: (visitorId: string, updates: {
    name?: string
    countryId?: string
    organisationId?: string | null
    mainGameId?: string
    regionId?: string
    gameIds?: string[]
    associatedEntityIds?: string[]
  }) => void
  getUserProfile: (visitorId: string) => Player | undefined

  // Getters
  getEntity: (entityType: EntityType, entityId: string) => Entity | undefined
  getEntitiesByType: (entityType: EntityType) => Entity[]
  getRelatedEntities: (entity: Entity) => Entity[]

  // Aura helpers
  calculatePropagatedAura: (entity: Entity, deltaAura: number) => Map<string, number>
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getEntityMap(state: EntitiesState, entityType: EntityType): Record<string, Entity> {
  switch (entityType) {
    case EntityTypes.COUNTRY:
      return state.countries
    case EntityTypes.GAME:
      return state.games
    case EntityTypes.REGION:
      return state.regions
    case EntityTypes.ORGANISATION:
      return state.organisations
    case EntityTypes.ORGANISATION_GAME:
      return state.organisationGames
    case EntityTypes.ROLE:
      return state.roles
    case EntityTypes.WEAPON:
      return state.weapons
    case EntityTypes.CHARACTER:
      return state.characters
    case EntityTypes.BRAND:
      return state.brands
    case EntityTypes.PERIPHERAL:
      return state.peripherals
    case EntityTypes.PLAYER:
      return state.players
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

function generateVoteKey(visitorId: string, entityId: string, entityType: EntityType): string {
  return `${visitorId}:${entityType}:${entityId}`
}

function generateVoteId(): string {
  return crypto.randomUUID()
}

// ============================================================================
// AURA PROPAGATION LOGIC
// ============================================================================

function getParentEntities(entity: Entity): Array<{ type: EntityType; id: string }> {
  const parents: Array<{ type: EntityType; id: string }> = []

  switch (entity.type) {
    case EntityTypes.PLAYER: {
      const player = entity as Player
      // Player votes affect: organisation, country, region, main game
      if (player.organisationId) {
        parents.push({ type: EntityTypes.ORGANISATION, id: player.organisationId })
      }
      parents.push({ type: EntityTypes.COUNTRY, id: player.countryId })
      parents.push({ type: EntityTypes.REGION, id: player.regionId })
      parents.push({ type: EntityTypes.GAME, id: player.mainGameId })
      break
    }

    case EntityTypes.ORGANISATION_GAME: {
      const orgGame = entity as OrganisationGame
      // OrganisationGame votes affect: parent organisation and game
      parents.push({ type: EntityTypes.ORGANISATION, id: orgGame.organisationId })
      parents.push({ type: EntityTypes.GAME, id: orgGame.gameId })
      break
    }

    case EntityTypes.REGION: {
      const region = entity as Region
      // Region votes affect: game
      parents.push({ type: EntityTypes.GAME, id: region.gameId })
      break
    }

    case EntityTypes.ROLE:
    case EntityTypes.WEAPON:
    case EntityTypes.CHARACTER: {
      const gameEntity = entity as Role | Weapon | Character
      // Game-specific entities affect: game
      parents.push({ type: EntityTypes.GAME, id: gameEntity.gameId })
      break
    }

    case EntityTypes.PERIPHERAL: {
      const peripheral = entity as Peripheral
      // Peripheral votes affect: brand
      parents.push({ type: EntityTypes.BRAND, id: peripheral.brandId })
      break
    }

    // Top-level entities (no parents)
    case EntityTypes.COUNTRY:
    case EntityTypes.GAME:
    case EntityTypes.ORGANISATION:
    case EntityTypes.BRAND:
      break
  }

  return parents
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const useAuraStore = create<AuraStoreState>()(
  persist(
    immer((set, get) => ({
    // Initial empty state
    countries: {},
    games: {},
    regions: {},
    organisations: {},
    organisationGames: {},
    roles: {},
    weapons: {},
    characters: {},
    brands: {},
    peripherals: {},
    players: {},
    votes: {},
    userProfiles: {},

    // ========================================================================
    // ENTITY CRUD
    // ========================================================================

    addEntity: <T extends Entity>(entity: T) => {
      set((state) => {
        switch (entity.type) {
          case EntityTypes.COUNTRY:
            state.countries[entity.id] = entity as Country
            break
          case EntityTypes.GAME:
            state.games[entity.id] = entity as Game
            break
          case EntityTypes.REGION:
            state.regions[entity.id] = entity as Region
            break
          case EntityTypes.ORGANISATION:
            state.organisations[entity.id] = entity as Organisation
            break
          case EntityTypes.ORGANISATION_GAME:
            state.organisationGames[entity.id] = entity as OrganisationGame
            break
          case EntityTypes.ROLE:
            state.roles[entity.id] = entity as Role
            break
          case EntityTypes.WEAPON:
            state.weapons[entity.id] = entity as Weapon
            break
          case EntityTypes.CHARACTER:
            state.characters[entity.id] = entity as Character
            break
          case EntityTypes.BRAND:
            state.brands[entity.id] = entity as Brand
            break
          case EntityTypes.PERIPHERAL:
            state.peripherals[entity.id] = entity as Peripheral
            break
          case EntityTypes.PLAYER:
            state.players[entity.id] = entity as Player
            break
        }
      })
    },

    removeEntity: (entityType: EntityType, entityId: string) => {
      set((state) => {
        const entityMap = getEntityMap(state, entityType)
        delete entityMap[entityId]
      })
    },

    updateEntity: <T extends Entity>(entityType: EntityType, entityId: string, updates: Partial<T>) => {
      set((state) => {
        const entityMap = getEntityMap(state, entityType)
        if (entityMap[entityId]) {
          Object.assign(entityMap[entityId], updates)
        }
      })
    },

    // ========================================================================
    // VOTING
    // ========================================================================

    vote: (visitorId: string, entityId: string, entityType: EntityType, direction: VoteDirection) => {
      const state = get()
      const voteKey = generateVoteKey(visitorId, entityId, entityType)

      // Check for existing vote
      const existingVote = state.votes[voteKey]

      set((draft) => {
        const entity = getEntityMap(draft, entityType)[entityId]
        if (!entity) return

        let auraDelta = 0

        if (existingVote) {
          // If same direction, do nothing (already voted)
          if (existingVote.direction === direction) return

          // Switching vote direction: remove old vote effect, apply new
          const oldEffect = existingVote.direction === VoteDirection.UP ? VOTE_VALUE : -VOTE_VALUE
          const newEffect = direction === VoteDirection.UP ? VOTE_VALUE : -VOTE_VALUE
          auraDelta = newEffect - oldEffect // Will be +2 or -2

          // Update existing vote
          draft.votes[voteKey] = {
            ...existingVote,
            direction,
            timestamp: new Date(),
          }
        } else {
          // New vote
          auraDelta = direction === VoteDirection.UP ? VOTE_VALUE : -VOTE_VALUE

          const newVote: Vote = {
            id: generateVoteId(),
            visitorId,
            entityId,
            entityType,
            direction,
            timestamp: new Date(),
          }
          draft.votes[voteKey] = newVote
        }

        // Apply aura change to voted entity
        entity.auraScore += auraDelta

        // Propagate aura to parent entities
        const parents = getParentEntities(entity)
        const propagatedDelta = auraDelta * AURA_PROPAGATION_FACTOR

        for (const parent of parents) {
          const parentEntity = getEntityMap(draft, parent.type)[parent.id]
          if (parentEntity) {
            parentEntity.auraScore += propagatedDelta
          }
        }
      })
    },

    removeVote: (visitorId: string, entityId: string, entityType: EntityType) => {
      const state = get()
      const voteKey = generateVoteKey(visitorId, entityId, entityType)
      const existingVote = state.votes[voteKey]

      if (!existingVote) return

      set((draft) => {
        const entity = getEntityMap(draft, entityType)[entityId]
        if (!entity) return

        // Reverse the vote effect
        const auraDelta = existingVote.direction === VoteDirection.UP ? -VOTE_VALUE : VOTE_VALUE
        entity.auraScore += auraDelta

        // Reverse propagation to parents
        const parents = getParentEntities(entity)
        const propagatedDelta = auraDelta * AURA_PROPAGATION_FACTOR

        for (const parent of parents) {
          const parentEntity = getEntityMap(draft, parent.type)[parent.id]
          if (parentEntity) {
            parentEntity.auraScore += propagatedDelta
          }
        }

        // Remove the vote
        delete draft.votes[voteKey]
      })
    },

    getVisitorVote: (visitorId: string, entityId: string, entityType: EntityType) => {
      const state = get()
      const voteKey = generateVoteKey(visitorId, entityId, entityType)
      return state.votes[voteKey]
    },

    // ========================================================================
    // USER PROFILE
    // ========================================================================

    createUserProfile: (visitorId: string) => {
      const state = get()

      // Check if profile already exists
      const existingProfileId = state.userProfiles[visitorId]
      if (existingProfileId && state.players[existingProfileId]) {
        return state.players[existingProfileId]
      }

      const playerId = `player-user-${visitorId.slice(0, 8)}`
      const newPlayer: Player = {
        id: playerId,
        name: '',
        slug: `user-${visitorId.slice(0, 8)}`,
        auraScore: 0,
        createdAt: new Date(),
        type: EntityTypes.PLAYER,
        countryId: '',
        mainGameId: '',
        regionId: '',
        gameIds: [],
        isUserProfile: true,
        visitorId,
      }

      set((draft) => {
        draft.players[playerId] = newPlayer
        draft.userProfiles[visitorId] = playerId
      })

      return newPlayer
    },

    updateUserProfile: (visitorId: string, updates: {
      name?: string
      countryId?: string
      organisationId?: string | null
      mainGameId?: string
      regionId?: string
      gameIds?: string[]
      associatedEntityIds?: string[]
    }) => {
      const state = get()
      const playerId = state.userProfiles[visitorId]
      if (!playerId) return

      set((draft) => {
        const player = draft.players[playerId]
        if (!player) return

        if (updates.name !== undefined) {
          player.name = updates.name
          player.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `user-${visitorId.slice(0, 8)}`
        }
        if (updates.countryId !== undefined) {
          player.countryId = updates.countryId
        }
        if (updates.organisationId !== undefined) {
          player.organisationId = updates.organisationId || undefined
        }
        if (updates.mainGameId !== undefined) {
          player.mainGameId = updates.mainGameId
        }
        if (updates.regionId !== undefined) {
          player.regionId = updates.regionId
        }
        if (updates.gameIds !== undefined) {
          player.gameIds = updates.gameIds
        }
        if (updates.associatedEntityIds !== undefined) {
          player.associatedEntityIds = updates.associatedEntityIds
        }
      })
    },

    getUserProfile: (visitorId: string) => {
      const state = get()
      const playerId = state.userProfiles[visitorId]
      if (!playerId) return undefined
      return state.players[playerId]
    },

    // ========================================================================
    // GETTERS
    // ========================================================================

    getEntity: (entityType: EntityType, entityId: string) => {
      const state = get()
      return getEntityMap(state, entityType)[entityId]
    },

    getEntitiesByType: (entityType: EntityType) => {
      const state = get()
      return Object.values(getEntityMap(state, entityType))
    },

    getRelatedEntities: (entity: Entity) => {
      const state = get()
      const related: Entity[] = []

      switch (entity.type) {
        case EntityTypes.PLAYER: {
          const player = entity as Player
          if (player.organisationId && state.organisations[player.organisationId]) {
            related.push(state.organisations[player.organisationId])
          }
          if (state.countries[player.countryId]) {
            related.push(state.countries[player.countryId])
          }
          if (state.regions[player.regionId]) {
            related.push(state.regions[player.regionId])
          }
          if (state.games[player.mainGameId]) {
            related.push(state.games[player.mainGameId])
          }
          break
        }

        case EntityTypes.ORGANISATION: {
          // Find all OrganisationGames for this org
          for (const orgGame of Object.values(state.organisationGames)) {
            if (orgGame.organisationId === entity.id) {
              related.push(orgGame)
            }
          }
          // Find all players in this org
          for (const player of Object.values(state.players)) {
            if (player.organisationId === entity.id) {
              related.push(player)
            }
          }
          break
        }

        case EntityTypes.GAME: {
          // Find all regions for this game
          for (const region of Object.values(state.regions)) {
            if (region.gameId === entity.id) {
              related.push(region)
            }
          }
          // Find all roles, weapons, characters for this game
          for (const role of Object.values(state.roles)) {
            if (role.gameId === entity.id) {
              related.push(role)
            }
          }
          for (const weapon of Object.values(state.weapons)) {
            if (weapon.gameId === entity.id) {
              related.push(weapon)
            }
          }
          for (const character of Object.values(state.characters)) {
            if (character.gameId === entity.id) {
              related.push(character)
            }
          }
          break
        }

        case EntityTypes.BRAND: {
          // Find all peripherals for this brand
          for (const peripheral of Object.values(state.peripherals)) {
            if (peripheral.brandId === entity.id) {
              related.push(peripheral)
            }
          }
          break
        }

        case EntityTypes.COUNTRY: {
          // Find all players from this country
          for (const player of Object.values(state.players)) {
            if (player.countryId === entity.id) {
              related.push(player)
            }
          }
          break
        }

        case EntityTypes.REGION: {
          const region = entity as Region
          // Add parent game
          if (state.games[region.gameId]) {
            related.push(state.games[region.gameId])
          }
          // Find all players in this region
          for (const player of Object.values(state.players)) {
            if (player.regionId === entity.id) {
              related.push(player)
            }
          }
          break
        }
      }

      return related
    },

    // ========================================================================
    // AURA HELPERS
    // ========================================================================

    calculatePropagatedAura: (entity: Entity, deltaAura: number) => {
      const propagationMap = new Map<string, number>()

      const parents = getParentEntities(entity)
      const propagatedDelta = deltaAura * AURA_PROPAGATION_FACTOR

      for (const parent of parents) {
        const key = `${parent.type}:${parent.id}`
        propagationMap.set(key, propagatedDelta)
      }

      return propagationMap
    },
  })),
    {
      name: 'aura-data',
      partialize: (state) => ({
        votes: state.votes,
        userProfiles: state.userProfiles,
        players: Object.fromEntries(
          Object.entries(state.players).filter(([, p]) => p.isUserProfile)
        ),
      }),
    }
  )
)

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export const useCountries = () => useAuraStore((state) => state.countries)
export const useGames = () => useAuraStore((state) => state.games)
export const useRegions = () => useAuraStore((state) => state.regions)
export const useOrganisations = () => useAuraStore((state) => state.organisations)
export const useOrganisationGames = () => useAuraStore((state) => state.organisationGames)
export const useRoles = () => useAuraStore((state) => state.roles)
export const useWeapons = () => useAuraStore((state) => state.weapons)
export const useCharacters = () => useAuraStore((state) => state.characters)
export const useBrands = () => useAuraStore((state) => state.brands)
export const usePeripherals = () => useAuraStore((state) => state.peripherals)
export const usePlayers = () => useAuraStore((state) => state.players)
export const useVotes = () => useAuraStore((state) => state.votes)
