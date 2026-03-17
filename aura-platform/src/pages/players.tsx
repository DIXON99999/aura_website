import { useState, useMemo } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import {
  Leaderboard,
  SortButton,
  SidebarFilter,
  MobileFilterButton,
  type SortDirection,
} from '@/components/leaderboard'
import type { PlayerFilters } from '@/components/leaderboard/sidebar-filter'
import { useAuraStore } from '@/stores'
import { EntityTypes } from '@/types'
import type { Player } from '@/types'

const emptyFilters: PlayerFilters = {
  gameIds: [],
  organisationIds: [],
  countryIds: [],
  playerIds: [],
}

export function PlayersPage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filters, setFilters] = useState<PlayerFilters>(emptyFilters)

  const players = useAuraStore((s) => s.players)

  const filteredPlayers = useMemo(() => {
    let result = Object.values(players)

    // Filter out incomplete user profiles (must have name and country to appear)
    result = result.filter((p) => {
      if (p.isUserProfile) {
        return p.name && p.countryId
      }
      return true
    })

    // Filter by specific player IDs
    if (filters.playerIds.length > 0) {
      result = result.filter((p) => filters.playerIds.includes(p.id))
    }

    // Filter by game
    if (filters.gameIds.length > 0) {
      result = result.filter((p) =>
        filters.gameIds.includes((p as Player).mainGameId)
      )
    }

    // Filter by organisation
    if (filters.organisationIds.length > 0) {
      result = result.filter((p) => {
        const orgId = (p as Player).organisationId
        return orgId && filters.organisationIds.includes(orgId)
      })
    }

    // Filter by country
    if (filters.countryIds.length > 0) {
      result = result.filter((p) =>
        filters.countryIds.includes((p as Player).countryId)
      )
    }

    return result
  }, [players, filters])

  const hasFilters =
    filters.gameIds.length > 0 ||
    filters.organisationIds.length > 0 ||
    filters.countryIds.length > 0 ||
    filters.playerIds.length > 0

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Left Sidebar Filter - Fixed in left margin space */}
      <aside className="hidden xl:block fixed left-4 top-24 w-64 z-40">
        <SidebarFilter filters={filters} onChange={setFilters} />
      </aside>

      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Players</h1>
        <p className="text-muted-foreground mb-6">
          The most reputable esports players
        </p>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search players..."
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MobileFilterButton filters={filters} onChange={setFilters} />
            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredPlayers.length} players
          </span>
        </div>

        <Leaderboard
          entities={filteredPlayers}
          entityType={EntityTypes.PLAYER}
          searchQuery={query}
          sortDirection={sortDirection}
          emptyMessage={hasFilters ? "No players match your filters" : "No players yet"}
        />
      </div>
    </div>
  )
}
