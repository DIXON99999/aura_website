import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { api, type Entity } from '@/lib/api'
import {
  type EntitiesState,
  type EntityType,
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
} from '@/types'

// ============================================================================
// STORE STATE INTERFACE
// ============================================================================

interface Credits {
  upvotesRemaining: number
  downvotesRemaining: number
}

interface AuraStoreState extends EntitiesState {
  // Loading states
  loading: boolean
  initialized: boolean
  error: string | null

  // Credits
  credits: Credits

  // Actions - Data fetching
  fetchAllData: () => Promise<void>
  refreshEntity: (entityType: EntityType, entityId: string) => Promise<void>

  // Actions - Voting
  vote: (visitorId: string, entityId: string, entityType: EntityType, direction: VoteDirection, userId?: string) => Promise<void>
  removeVote: (visitorId: string, entityId: string, entityType: EntityType) => Promise<void>
  getVisitorVote: (visitorId: string, entityId: string, entityType: EntityType) => import('@/types').Vote | undefined
  loadVisitorVotes: (visitorId: string) => Promise<void>

  // Actions - Credits
  loadCredits: (visitorId: string) => Promise<void>
  refreshCredits: (visitorId: string, userId?: string) => Promise<void>
  setCredits: (credits: Credits) => void

  // Actions - User Profile
  createUserProfile: (visitorId: string) => Promise<Player>
  updateUserProfile: (visitorId: string, updates: {
    name?: string
    countryId?: string
    organisationId?: string | null
    mainGameId?: string
    regionId?: string
    gameIds?: string[]
    associatedEntityIds?: string[]
  }) => Promise<void>
  getUserProfile: (visitorId: string) => Player | undefined
  loadUserProfile: (visitorId: string) => Promise<Player | undefined>
  clearUserProfile: (visitorId: string) => void

  // Getters
  getEntity: (entityType: EntityType, entityId: string) => import('@/types').Entity | undefined
  getEntitiesByType: (entityType: EntityType) => import('@/types').Entity[]
}

// ============================================================================
// PERK HELPERS
// ============================================================================

const PERK_STORAGE_KEY = 'aura_equipped_perks'

function getEquippedPerks(): string[] {
  try {
    const stored = localStorage.getItem(PERK_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function hasPerkEquipped(perkId: string): boolean {
  const perks = getEquippedPerks()
  const has = perks.includes(perkId)
  console.log('hasPerkEquipped check:', perkId, 'equipped perks:', perks, 'result:', has)
  return has
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getEntityMap(state: EntitiesState, entityType: EntityType): Record<string, import('@/types').Entity> {
  switch (entityType) {
    case EntityTypes.COUNTRY: return state.countries
    case EntityTypes.GAME: return state.games
    case EntityTypes.REGION: return state.regions
    case EntityTypes.ORGANISATION: return state.organisations
    case EntityTypes.ORGANISATION_GAME: return state.organisationGames
    case EntityTypes.ROLE: return state.roles
    case EntityTypes.WEAPON: return state.weapons
    case EntityTypes.CHARACTER: return state.characters
    case EntityTypes.BRAND: return state.brands
    case EntityTypes.PERIPHERAL: return state.peripherals
    case EntityTypes.PLAYER: return state.players
    default: throw new Error(`Unknown entity type: ${entityType}`)
  }
}

function apiEntityToStoreEntity(e: Entity): import('@/types').Entity {
  const base = {
    id: e.id,
    name: e.name,
    slug: e.slug,
    auraScore: e.auraScore,
    createdAt: new Date(e.createdAt),
    imageUrl: e.imageUrl,
    aliases: e.aliases,
  }

  switch (e.type) {
    case 'country':
      return { ...base, type: EntityTypes.COUNTRY, flagCode: e.flagCode! } as Country
    case 'game':
      return { ...base, type: EntityTypes.GAME, gameType: e.gameType! } as Game
    case 'region':
      return { ...base, type: EntityTypes.REGION, gameId: e.gameId! } as Region
    case 'organisation':
      return { ...base, type: EntityTypes.ORGANISATION } as Organisation
    case 'organisationGame':
      return { ...base, type: EntityTypes.ORGANISATION_GAME, organisationId: e.organisationId!, gameId: e.gameId! } as OrganisationGame
    case 'role':
      return { ...base, type: EntityTypes.ROLE, gameId: e.gameId! } as Role
    case 'weapon':
      return { ...base, type: EntityTypes.WEAPON, gameId: e.gameId! } as Weapon
    case 'character':
      return { ...base, type: EntityTypes.CHARACTER, gameId: e.gameId! } as Character
    case 'brand':
      return { ...base, type: EntityTypes.BRAND } as Brand
    case 'peripheral':
      return { ...base, type: EntityTypes.PERIPHERAL, peripheralType: e.peripheralType!, brandId: e.brandId! } as Peripheral
    case 'player':
      return {
        ...base,
        type: EntityTypes.PLAYER,
        countryId: e.countryId || '',
        organisationId: e.organisationId,
        mainGameId: e.mainGameId || '',
        regionId: e.regionId || '',
        gameIds: e.gameIds || [],
        associatedEntityIds: e.associatedEntityIds,
        isUserProfile: e.isUserProfile,
        visitorId: e.visitorId,
      } as Player
    default:
      throw new Error(`Unknown entity type: ${e.type}`)
  }
}

function generateVoteKey(visitorId: string, entityId: string, entityType: EntityType): string {
  return `${visitorId}:${entityType}:${entityId}`
}

// Get parent entities that receive propagated aura
function getParentEntities(state: EntitiesState, entityType: EntityType, entityId: string): Array<{ type: EntityType; id: string }> {
  const parents: Array<{ type: EntityType; id: string }> = []

  if (entityType === EntityTypes.PLAYER) {
    const player = state.players[entityId]
    if (player) {
      if (player.organisationId) parents.push({ type: EntityTypes.ORGANISATION, id: player.organisationId })
      if (player.countryId) parents.push({ type: EntityTypes.COUNTRY, id: player.countryId })
      if (player.regionId) parents.push({ type: EntityTypes.REGION, id: player.regionId })
      if (player.mainGameId) parents.push({ type: EntityTypes.GAME, id: player.mainGameId })
    }
  } else if (entityType === EntityTypes.ORGANISATION_GAME) {
    const orgGame = state.organisationGames[entityId]
    if (orgGame) {
      parents.push({ type: EntityTypes.ORGANISATION, id: orgGame.organisationId })
      parents.push({ type: EntityTypes.GAME, id: orgGame.gameId })
    }
  } else if (entityType === EntityTypes.REGION) {
    const region = state.regions[entityId]
    if (region) parents.push({ type: EntityTypes.GAME, id: region.gameId })
  } else if (entityType === EntityTypes.ROLE) {
    const role = state.roles[entityId]
    if (role) parents.push({ type: EntityTypes.GAME, id: role.gameId })
  } else if (entityType === EntityTypes.WEAPON) {
    const weapon = state.weapons[entityId]
    if (weapon) parents.push({ type: EntityTypes.GAME, id: weapon.gameId })
  } else if (entityType === EntityTypes.CHARACTER) {
    const char = state.characters[entityId]
    if (char) parents.push({ type: EntityTypes.GAME, id: char.gameId })
  } else if (entityType === EntityTypes.PERIPHERAL) {
    const peripheral = state.peripherals[entityId]
    if (peripheral) parents.push({ type: EntityTypes.BRAND, id: peripheral.brandId })
  }

  return parents
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const useAuraStore = create<AuraStoreState>()(
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
    loading: false,
    initialized: false,
    error: null,
    credits: { upvotesRemaining: 20, downvotesRemaining: 10 },

    // ========================================================================
    // DATA FETCHING
    // ========================================================================

    fetchAllData: async () => {
      const state = get()
      if (state.loading || state.initialized) return

      set((draft) => { draft.loading = true })

      try {
        const [
          countries,
          games,
          regions,
          organisations,
          organisationGames,
          brands,
          peripherals,
          roles,
          weapons,
          characters,
          players,
        ] = await Promise.all([
          api.getCountries(),
          api.getGames(),
          api.getRegions(),
          api.getOrganisations(),
          api.getOrganisationGames(),
          api.getBrands(),
          api.getPeripherals(),
          api.getRoles(),
          api.getWeapons(),
          api.getCharacters(),
          api.getPlayers(),
        ])

        set((draft) => {
          for (const e of countries) {
            draft.countries[e.id] = apiEntityToStoreEntity(e) as Country
          }
          for (const e of games) {
            draft.games[e.id] = apiEntityToStoreEntity(e) as Game
          }
          for (const e of regions) {
            draft.regions[e.id] = apiEntityToStoreEntity(e) as Region
          }
          for (const e of organisations) {
            draft.organisations[e.id] = apiEntityToStoreEntity(e) as Organisation
          }
          for (const e of organisationGames) {
            draft.organisationGames[e.id] = apiEntityToStoreEntity(e) as OrganisationGame
          }
          for (const e of brands) {
            draft.brands[e.id] = apiEntityToStoreEntity(e) as Brand
          }
          for (const e of peripherals) {
            draft.peripherals[e.id] = apiEntityToStoreEntity(e) as Peripheral
          }
          for (const e of roles) {
            draft.roles[e.id] = apiEntityToStoreEntity(e) as Role
          }
          for (const e of weapons) {
            draft.weapons[e.id] = apiEntityToStoreEntity(e) as Weapon
          }
          for (const e of characters) {
            draft.characters[e.id] = apiEntityToStoreEntity(e) as Character
          }
          for (const e of players) {
            draft.players[e.id] = apiEntityToStoreEntity(e) as Player
          }
          draft.loading = false
          draft.initialized = true
        })
      } catch (error) {
        console.error('Failed to fetch data:', error)
        set((draft) => { draft.loading = false; draft.error = String(error) })
      }
    },

    refreshEntity: async (entityType: EntityType, entityId: string) => {
      // Refetch from API and update local state
      try {
        let entity: Entity | null = null

        switch (entityType) {
          case EntityTypes.COUNTRY:
            entity = await api.getCountry(entityId)
            break
          case EntityTypes.GAME:
            entity = await api.getGame(entityId)
            break
          case EntityTypes.REGION:
            entity = await api.getRegion(entityId)
            break
          case EntityTypes.ORGANISATION:
            entity = await api.getOrganisation(entityId)
            break
          case EntityTypes.BRAND:
            entity = await api.getBrand(entityId)
            break
          case EntityTypes.PERIPHERAL:
            entity = await api.getPeripheral(entityId)
            break
          case EntityTypes.PLAYER:
            entity = await api.getPlayer(entityId)
            break
        }

        if (entity) {
          set((draft) => {
            const map = getEntityMap(draft, entityType)
            map[entityId] = apiEntityToStoreEntity(entity!)
          })
        }
      } catch (error) {
        console.error('Failed to refresh entity:', error)
      }
    },

    // ========================================================================
    // VOTING
    // ========================================================================

    vote: async (visitorId: string, entityId: string, entityType: EntityType, direction: VoteDirection, userId?: string) => {
      // Check credits first
      const state = get()
      if (direction === VoteDirection.UP && state.credits.upvotesRemaining <= 0) {
        throw new Error('No upvote credits remaining')
      }
      if (direction === VoteDirection.DOWN && state.credits.downvotesRemaining <= 0) {
        throw new Error('No downvote credits remaining')
      }

      // Check for double-click perk (only for upvotes)
      const hasDoubleClick = direction === VoteDirection.UP && hasPerkEquipped('double-click')
      const voteMultiplier = hasDoubleClick ? 2 : 1

      // Optimistic update
      set((draft) => {
        const entity = getEntityMap(draft, entityType)[entityId]
        if (!entity) return

        const auraDelta = (direction === VoteDirection.UP ? 1 : -1) * voteMultiplier
        entity.auraScore += auraDelta

        // Deduct credit (only 1 credit regardless of multiplier)
        if (direction === VoteDirection.UP) {
          draft.credits.upvotesRemaining -= 1
        } else {
          draft.credits.downvotesRemaining -= 1
        }
      })

      // Sync with backend
      try {
        // Call API multiple times for double-click perk
        let result
        for (let i = 0; i < voteMultiplier; i++) {
          result = await api.vote({ visitorId, entityId, entityType, direction, userId })
        }
        // Update credits from response (the last call's credits are correct)
        if (result) {
          set((draft) => {
            draft.credits.upvotesRemaining = result.credits.upvotesRemaining
            draft.credits.downvotesRemaining = result.credits.downvotesRemaining
          })
        }
        // Refresh the entity and its parents to get accurate scores
        const newState = get()
        newState.refreshEntity(entityType, entityId)
        const parents = getParentEntities(newState, entityType, entityId)
        for (const parent of parents) {
          newState.refreshEntity(parent.type, parent.id)
        }
      } catch (error) {
        // Revert optimistic update on error
        set((draft) => {
          const entity = getEntityMap(draft, entityType)[entityId]
          if (entity) {
            const auraDelta = (direction === VoteDirection.UP ? -1 : 1) * voteMultiplier
            entity.auraScore += auraDelta
          }
          if (direction === VoteDirection.UP) {
            draft.credits.upvotesRemaining += 1
          } else {
            draft.credits.downvotesRemaining += 1
          }
        })
        throw error
      }
    },

    removeVote: async (visitorId: string, entityId: string, entityType: EntityType) => {
      const voteKey = generateVoteKey(visitorId, entityId, entityType)
      const existingVote = get().votes[voteKey]

      if (!existingVote) return

      // Optimistic update
      set((draft) => {
        const entity = getEntityMap(draft, entityType)[entityId]
        if (!entity) return

        const auraDelta = existingVote.direction === VoteDirection.UP ? -1 : 1
        entity.auraScore += auraDelta
        delete draft.votes[voteKey]
      })

      // Sync with backend
      try {
        await api.removeVote({ visitorId, entityId, entityType })
        // Refresh the entity and its parents to get accurate scores
        const state = get()
        state.refreshEntity(entityType, entityId)
        const parents = getParentEntities(state, entityType, entityId)
        for (const parent of parents) {
          state.refreshEntity(parent.type, parent.id)
        }
      } catch (error) {
        console.error('Failed to remove vote:', error)
      }
    },

    getVisitorVote: (visitorId: string, entityId: string, entityType: EntityType) => {
      const voteKey = generateVoteKey(visitorId, entityId, entityType)
      return get().votes[voteKey]
    },

    loadVisitorVotes: async (visitorId: string) => {
      try {
        const votes = await api.getVisitorVotes(visitorId)
        set((draft) => {
          for (const v of votes) {
            const voteKey = `${v.visitorId}:${v.entityType}:${v.entityId}`
            draft.votes[voteKey] = {
              id: v.id,
              visitorId: v.visitorId,
              entityId: v.entityId,
              entityType: v.entityType as EntityType,
              direction: v.direction as VoteDirection,
              timestamp: new Date(v.timestamp),
            }
          }
        })
      } catch (error) {
        console.error('Failed to load votes:', error)
      }
    },

    loadCredits: async (visitorId: string) => {
      try {
        const credits = await api.getCredits(visitorId)
        set((draft) => {
          draft.credits = credits
        })
      } catch (error) {
        console.error('Failed to load credits:', error)
      }
    },

    refreshCredits: async (visitorId: string, userId?: string) => {
      try {
        const credits = await api.refreshCredits(visitorId, userId)
        set((draft) => {
          draft.credits = credits
        })
      } catch (error) {
        console.error('Failed to refresh credits:', error)
        throw error
      }
    },

    setCredits: (credits: Credits) => {
      set((draft) => {
        draft.credits = credits
      })
    },

    // ========================================================================
    // USER PROFILE
    // ========================================================================

    createUserProfile: async (visitorId: string) => {
      const existingProfileId = get().userProfiles[visitorId]
      if (existingProfileId && get().players[existingProfileId]) {
        // Ensure player is linked to user's database record
        try {
          await api.linkPlayer(existingProfileId)
        } catch {
          // Ignore if not authenticated or already linked
        }
        return get().players[existingProfileId]
      }

      try {
        const entity = await api.createUserProfile({ visitorId })
        const player = apiEntityToStoreEntity(entity) as Player

        set((draft) => {
          draft.players[player.id] = player
          draft.userProfiles[visitorId] = player.id
        })

        // Link the player to the user's database record so ownerName shows on created content
        try {
          await api.linkPlayer(player.id)
        } catch {
          // Ignore if not authenticated or already linked
        }

        return player
      } catch (error) {
        console.error('Failed to create profile:', error)
        throw error
      }
    },

    updateUserProfile: async (visitorId: string, updates) => {
      const playerId = get().userProfiles[visitorId]
      if (!playerId) return

      try {
        const entity = await api.updatePlayer(playerId, updates)
        const player = apiEntityToStoreEntity(entity) as Player

        set((draft) => {
          draft.players[playerId] = player
        })
      } catch (error) {
        console.error('Failed to update profile:', error)
      }
    },

    getUserProfile: (visitorId: string) => {
      const playerId = get().userProfiles[visitorId]
      if (!playerId) return undefined
      return get().players[playerId]
    },

    loadUserProfile: async (visitorId: string) => {
      try {
        const entity = await api.getUserProfile(visitorId)
        if (!entity) return undefined

        const player = apiEntityToStoreEntity(entity) as Player

        set((draft) => {
          draft.players[player.id] = player
          draft.userProfiles[visitorId] = player.id
        })

        return player
      } catch {
        return undefined
      }
    },

    clearUserProfile: (visitorId: string) => {
      set((draft) => {
        const playerId = draft.userProfiles[visitorId]
        if (playerId) {
          delete draft.players[playerId]
        }
        delete draft.userProfiles[visitorId]
      })
    },

    // ========================================================================
    // GETTERS
    // ========================================================================

    getEntity: (entityType: EntityType, entityId: string) => {
      return getEntityMap(get(), entityType)[entityId]
    },

    getEntitiesByType: (entityType: EntityType) => {
      return Object.values(getEntityMap(get(), entityType))
    },
  }))
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
export const useLoading = () => useAuraStore((state) => state.loading)
export const useInitialized = () => useAuraStore((state) => state.initialized)
export const useCredits = () => useAuraStore((state) => state.credits)
