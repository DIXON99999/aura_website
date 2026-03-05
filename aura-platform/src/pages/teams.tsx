import { useState, useMemo } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import { Leaderboard, SortButton, TeamGameFilter, ActiveFilters, type SortDirection } from '@/components/leaderboard'
import { useAuraStore } from '@/stores'
import { EntityTypes } from '@/types'
import type { Entity, OrganisationGame } from '@/types'

export function TeamsPage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([])

  const organisations = useAuraStore((s) => s.organisations)
  const organisationGames = useAuraStore((s) => s.organisationGames)

  const displayedEntities = useMemo<Entity[]>(() => {
    if (selectedGameIds.length > 0) {
      // Show org-game entities for the selected games
      return Object.values(organisationGames).filter((og) =>
        selectedGameIds.includes((og as OrganisationGame).gameId)
      )
    }
    // Show main organisations
    return Object.values(organisations)
  }, [organisations, organisationGames, selectedGameIds])

  const removeGameFilter = (gameId: string) => {
    setSelectedGameIds(selectedGameIds.filter((id) => id !== gameId))
  }

  const clearAllFilters = () => {
    setSelectedGameIds([])
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Teams</h1>
        <p className="text-muted-foreground mb-6">
          Top esports organisations
        </p>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search teams..."
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TeamGameFilter
              selectedGameIds={selectedGameIds}
              onChange={setSelectedGameIds}
            />
            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {displayedEntities.length} teams
          </span>
        </div>

        <ActiveFilters
          selectedGameIds={selectedGameIds}
          onRemove={removeGameFilter}
          onClearAll={clearAllFilters}
        />

        <div className={selectedGameIds.length > 0 ? 'mt-4' : 'mt-2'}>
          <Leaderboard
            entities={displayedEntities}
            entityType={selectedGameIds.length > 0 ? EntityTypes.ORGANISATION_GAME : EntityTypes.ORGANISATION}
            searchQuery={query}
            sortDirection={sortDirection}
            emptyMessage={selectedGameIds.length > 0 ? "No teams for selected games" : "No teams yet"}
          />
        </div>
      </div>
    </div>
  )
}
