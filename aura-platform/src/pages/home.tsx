import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchBar, useSearch } from '@/components/layout'
import {
  Leaderboard,
  SortButton,
  PlayerFilter,
  PlayerActiveFilters,
  TeamGameFilter,
  ActiveFilters,
  PeripheralFilter,
  PeripheralActiveFilters,
  MetaFilter,
  MetaActiveFilters,
  RegionFilter,
  RegionActiveFilters,
  type SortDirection,
  type PlayerFilters,
  type PeripheralFilters,
  type MetaFilters,
} from '@/components/leaderboard'
import { useAuraStore } from '@/stores'
import type { Entity, Player, OrganisationGame } from '@/types'
import { EntityTypes } from '@/types'
import { cn } from '@/lib/utils'
import {
  LayoutGrid,
  Users,
  Building2,
  Gamepad2,
  Globe,
  Mouse,
  Swords,
} from 'lucide-react'

type FilterType = 'all' | 'players' | 'teams' | 'games' | 'regions' | 'peripherals' | 'meta'

const filterButtons: { type: FilterType; label: string; icon: typeof LayoutGrid }[] = [
  { type: 'all', label: 'All', icon: LayoutGrid },
  { type: 'players', label: 'Players', icon: Users },
  { type: 'teams', label: 'Teams', icon: Building2 },
  { type: 'games', label: 'Games', icon: Gamepad2 },
  { type: 'regions', label: 'Regions', icon: Globe },
  { type: 'peripherals', label: 'Peripherals', icon: Mouse },
  { type: 'meta', label: 'Meta', icon: Swords },
]

const emptyPlayerFilters: PlayerFilters = {
  gameIds: [],
  organisationIds: [],
  countryIds: [],
  playerIds: [],
}

const emptyPeripheralFilters: PeripheralFilters = {
  types: [],
  brandIds: [],
}

const emptyMetaFilters: MetaFilters = {
  gameIds: [],
  types: [],
}

export function HomePage() {
  const { query, setQuery } = useSearch()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Read filter from URL, default to 'all'
  const filterParam = searchParams.get('tab') as FilterType | null
  const filter: FilterType = filterParam && ['all', 'players', 'teams', 'games', 'regions', 'peripherals', 'meta'].includes(filterParam)
    ? filterParam
    : 'all'

  const setFilter = (newFilter: FilterType) => {
    if (newFilter === 'all') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', newFilter)
    }
    setSearchParams(searchParams, { replace: true })
  }

  // Filter states for each category
  const [playerFilters, setPlayerFilters] = useState<PlayerFilters>(emptyPlayerFilters)
  const [teamGameIds, setTeamGameIds] = useState<string[]>([])
  const [peripheralFilters, setPeripheralFilters] = useState<PeripheralFilters>(emptyPeripheralFilters)
  const [metaFilters, setMetaFilters] = useState<MetaFilters>(emptyMetaFilters)
  const [regionCountryIds, setRegionCountryIds] = useState<string[]>([])

  const countries = useAuraStore((s) => s.countries)
  const games = useAuraStore((s) => s.games)
  const regions = useAuraStore((s) => s.regions)
  const organisations = useAuraStore((s) => s.organisations)
  const organisationGames = useAuraStore((s) => s.organisationGames)
  const roles = useAuraStore((s) => s.roles)
  const weapons = useAuraStore((s) => s.weapons)
  const characters = useAuraStore((s) => s.characters)
  const brands = useAuraStore((s) => s.brands)
  const peripherals = useAuraStore((s) => s.peripherals)
  const players = useAuraStore((s) => s.players)

  // Filter out incomplete user profiles
  const validPlayers = useMemo(() => {
    return Object.values(players).filter((p: Player) => {
      if (p.isUserProfile) {
        return p.name && p.countryId
      }
      return true
    })
  }, [players])

  // Apply category-specific filters
  const filteredEntities = useMemo<Entity[]>(() => {
    switch (filter) {
      case 'players': {
        let result = validPlayers
        if (playerFilters.playerIds.length > 0) {
          result = result.filter((p) => playerFilters.playerIds.includes(p.id))
        }
        if (playerFilters.gameIds.length > 0) {
          result = result.filter((p) => playerFilters.gameIds.includes((p as Player).mainGameId))
        }
        if (playerFilters.organisationIds.length > 0) {
          result = result.filter((p) => {
            const orgId = (p as Player).organisationId
            return orgId && playerFilters.organisationIds.includes(orgId)
          })
        }
        if (playerFilters.countryIds.length > 0) {
          result = result.filter((p) => playerFilters.countryIds.includes((p as Player).countryId))
        }
        return result
      }
      case 'teams': {
        if (teamGameIds.length > 0) {
          return Object.values(organisationGames).filter((og) =>
            teamGameIds.includes((og as OrganisationGame).gameId)
          )
        }
        return Object.values(organisations)
      }
      case 'games':
        return Object.values(games)
      case 'regions': {
        if (regionCountryIds.length > 0) {
          return Object.values(countries).filter((c) => regionCountryIds.includes(c.id))
        }
        return [...Object.values(regions), ...Object.values(countries)]
      }
      case 'peripherals': {
        let result = [...Object.values(peripherals), ...Object.values(brands)]
        if (peripheralFilters.types.length > 0) {
          const typesLower = peripheralFilters.types.map(t => t.toLowerCase())
          result = result.filter((p) => {
            if (p.type === EntityTypes.PERIPHERAL) {
              return typesLower.includes((p as any).peripheralType?.toLowerCase())
            }
            return false // brands don't have types
          })
        }
        if (peripheralFilters.brandIds.length > 0) {
          result = result.filter((p) => {
            if (p.type === EntityTypes.PERIPHERAL) {
              return peripheralFilters.brandIds.includes((p as any).brandId)
            }
            return peripheralFilters.brandIds.includes(p.id)
          })
        }
        return result
      }
      case 'meta': {
        let rolesList = Object.values(roles)
        let weaponsList = Object.values(weapons)
        let charactersList = Object.values(characters)

        if (metaFilters.gameIds.length > 0) {
          rolesList = rolesList.filter((r) => metaFilters.gameIds.includes((r as any).gameId))
          weaponsList = weaponsList.filter((w) => metaFilters.gameIds.includes((w as any).gameId))
          charactersList = charactersList.filter((c) => metaFilters.gameIds.includes((c as any).gameId))
        }

        if (metaFilters.types.length > 0) {
          const result: Entity[] = []
          if (metaFilters.types.includes('role')) result.push(...rolesList)
          if (metaFilters.types.includes('weapon')) result.push(...weaponsList)
          if (metaFilters.types.includes('character')) result.push(...charactersList)
          return result
        }

        return [...rolesList, ...weaponsList, ...charactersList]
      }
      case 'all':
      default:
        return [
          ...Object.values(countries),
          ...Object.values(games),
          ...Object.values(regions),
          ...Object.values(organisations),
          ...Object.values(roles),
          ...Object.values(weapons),
          ...Object.values(characters),
          ...Object.values(brands),
          ...Object.values(peripherals),
          ...validPlayers,
        ]
    }
  }, [
    filter,
    countries,
    games,
    regions,
    organisations,
    organisationGames,
    roles,
    weapons,
    characters,
    brands,
    peripherals,
    validPlayers,
    playerFilters,
    teamGameIds,
    peripheralFilters,
    metaFilters,
    regionCountryIds,
  ])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    switch (filter) {
      case 'players':
        return playerFilters.gameIds.length > 0 ||
          playerFilters.organisationIds.length > 0 ||
          playerFilters.countryIds.length > 0 ||
          playerFilters.playerIds.length > 0
      case 'teams':
        return teamGameIds.length > 0
      case 'regions':
        return regionCountryIds.length > 0
      case 'peripherals':
        return peripheralFilters.types.length > 0 || peripheralFilters.brandIds.length > 0
      case 'meta':
        return metaFilters.gameIds.length > 0 || metaFilters.types.length > 0
      default:
        return false
    }
  }, [filter, playerFilters, teamGameIds, regionCountryIds, peripheralFilters, metaFilters])

  // Filter removal handlers
  const removePlayerFilter = (type: keyof PlayerFilters, id: string) => {
    setPlayerFilters({ ...playerFilters, [type]: playerFilters[type].filter((i) => i !== id) })
  }
  const clearPlayerFilters = () => setPlayerFilters(emptyPlayerFilters)

  const removeTeamGameFilter = (gameId: string) => {
    setTeamGameIds(teamGameIds.filter((id) => id !== gameId))
  }
  const clearTeamFilters = () => setTeamGameIds([])

  const removePeripheralFilter = (type: 'types' | 'brandIds', id: string) => {
    setPeripheralFilters({ ...peripheralFilters, [type]: peripheralFilters[type].filter((i) => i !== id) })
  }
  const clearPeripheralFilters = () => setPeripheralFilters(emptyPeripheralFilters)

  const removeMetaFilter = (type: 'gameIds' | 'types', id: string) => {
    setMetaFilters({ ...metaFilters, [type]: metaFilters[type].filter((i: string) => i !== id) })
  }
  const clearMetaFilters = () => setMetaFilters(emptyMetaFilters)

  const removeRegionFilter = (countryId: string) => {
    setRegionCountryIds(regionCountryIds.filter((id) => id !== countryId))
  }
  const clearRegionFilters = () => setRegionCountryIds([])

  // Get entity type for leaderboard
  const entityType = useMemo(() => {
    switch (filter) {
      case 'players': return EntityTypes.PLAYER
      case 'teams': return teamGameIds.length > 0 ? EntityTypes.ORGANISATION_GAME : EntityTypes.ORGANISATION
      case 'games': return EntityTypes.GAME
      case 'regions': return 'mixed'
      case 'peripherals': return 'mixed'
      case 'meta': return 'mixed'
      default: return 'mixed'
    }
  }, [filter, teamGameIds])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 flex flex-col items-center pt-16 pb-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Aura Leaderboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Vote on your favorite esports entities
          </p>
        </div>

        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search players, teams, games..."
        />

        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {filterButtons.map((btn) => (
            <button
              key={btn.type}
              onClick={() => setFilter(btn.type)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                filter === btn.type
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <btn.icon className="w-4 h-4" />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="w-full max-w-3xl mt-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {filter === 'players' && (
                <PlayerFilter filters={playerFilters} onChange={setPlayerFilters} />
              )}
              {filter === 'teams' && (
                <TeamGameFilter selectedGameIds={teamGameIds} onChange={setTeamGameIds} />
              )}
              {filter === 'peripherals' && (
                <PeripheralFilter filters={peripheralFilters} onChange={setPeripheralFilters} />
              )}
              {filter === 'meta' && (
                <MetaFilter filters={metaFilters} onChange={setMetaFilters} />
              )}
              {filter === 'regions' && (
                <RegionFilter selectedCountryIds={regionCountryIds} onChange={setRegionCountryIds} />
              )}
              <SortButton
                direction={sortDirection}
                onChange={setSortDirection}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredEntities.length} {filter === 'all' ? 'entities' : filter}
            </span>
          </div>

          {filter === 'players' && (
            <PlayerActiveFilters
              filters={playerFilters}
              onRemove={removePlayerFilter}
              onClearAll={clearPlayerFilters}
            />
          )}
          {filter === 'teams' && (
            <ActiveFilters
              selectedGameIds={teamGameIds}
              onRemove={removeTeamGameFilter}
              onClearAll={clearTeamFilters}
            />
          )}
          {filter === 'peripherals' && (
            <PeripheralActiveFilters
              filters={peripheralFilters}
              onRemove={removePeripheralFilter}
              onClearAll={clearPeripheralFilters}
            />
          )}
          {filter === 'meta' && (
            <MetaActiveFilters
              filters={metaFilters}
              onRemove={removeMetaFilter}
              onClearAll={clearMetaFilters}
            />
          )}
          {filter === 'regions' && (
            <RegionActiveFilters
              selectedCountryIds={regionCountryIds}
              onRemove={removeRegionFilter}
              onClearAll={clearRegionFilters}
            />
          )}

          <div className={hasActiveFilters ? 'mt-4' : 'mt-2'}>
            <Leaderboard
              entities={filteredEntities}
              entityType={entityType}
              searchQuery={query}
              sortDirection={sortDirection}
              emptyMessage={hasActiveFilters ? "No results match your filters" : "No entities yet"}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
