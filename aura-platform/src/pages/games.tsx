import { useState, useMemo } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import { Leaderboard, GameFilter, SortButton, type SortDirection } from '@/components/leaderboard'
import { useAuraStore } from '@/stores'
import { EntityTypes } from '@/types'
import type { Game } from '@/types'

export function GamesPage() {
  const { query, setQuery } = useSearch()
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const games = useAuraStore((s) => s.games)

  const filteredGames = useMemo(() => {
    let result = Object.values(games)

    if (selectedTypes.length > 0) {
      result = result.filter((game) =>
        selectedTypes.includes((game as Game).gameType)
      )
    }

    return result
  }, [games, selectedTypes])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Games</h1>
        <p className="text-muted-foreground mb-6">
          Most popular esports titles
        </p>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search games..."
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GameFilter
              selectedTypes={selectedTypes}
              onChange={setSelectedTypes}
            />
            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredGames.length} games
          </span>
        </div>

        <Leaderboard
          entities={filteredGames}
          entityType={EntityTypes.GAME}
          searchQuery={query}
          sortDirection={sortDirection}
          emptyMessage="No games match your filters"
        />
      </div>
    </div>
  )
}
