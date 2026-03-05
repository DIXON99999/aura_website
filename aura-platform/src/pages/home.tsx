import { useMemo, useState } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import { Leaderboard, SortButton, type SortDirection } from '@/components/leaderboard'
import { useAuraStore } from '@/stores'
import type { Entity, Player } from '@/types'

export function HomePage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const countries = useAuraStore((s) => s.countries)
  const games = useAuraStore((s) => s.games)
  const regions = useAuraStore((s) => s.regions)
  const organisations = useAuraStore((s) => s.organisations)
  const roles = useAuraStore((s) => s.roles)
  const weapons = useAuraStore((s) => s.weapons)
  const characters = useAuraStore((s) => s.characters)
  const brands = useAuraStore((s) => s.brands)
  const peripherals = useAuraStore((s) => s.peripherals)
  const players = useAuraStore((s) => s.players)

  // Note: organisationGames excluded from global rankings - only shown when filtered by game
  const allEntities = useMemo<Entity[]>(() => {
    // Filter out incomplete user profiles
    const validPlayers = Object.values(players).filter((p: Player) => {
      if (p.isUserProfile) {
        return p.name && p.countryId
      }
      return true
    })

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
  }, [
    countries,
    games,
    regions,
    organisations,
    roles,
    weapons,
    characters,
    brands,
    peripherals,
    players,
  ])

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

        <div className="w-full max-w-3xl mt-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Global Rankings</h2>
              <SortButton
                direction={sortDirection}
                onChange={setSortDirection}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {allEntities.length} entities
            </span>
          </div>

          <Leaderboard
            entities={allEntities}
            entityType="mixed"
            searchQuery={query}
            sortDirection={sortDirection}
            emptyMessage="No entities yet. Add some to get started!"
          />
        </div>
      </div>
    </div>
  )
}
