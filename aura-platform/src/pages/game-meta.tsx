import { useMemo, useState } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import {
  Leaderboard,
  SortButton,
  MetaSidebarFilter,
  MobileMetaFilterButton,
  type SortDirection,
} from '@/components/leaderboard'
import type { MetaFilters } from '@/components/leaderboard/meta-sidebar-filter'
import { useAuraStore } from '@/stores'
import type { Entity, Role, Weapon, Character } from '@/types'

const emptyFilters: MetaFilters = {
  gameIds: [],
  types: [],
}

export function GameMetaPage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filters, setFilters] = useState<MetaFilters>(emptyFilters)

  const roles = useAuraStore((s) => s.roles)
  const weapons = useAuraStore((s) => s.weapons)
  const characters = useAuraStore((s) => s.characters)

  const filteredMeta = useMemo<Entity[]>(() => {
    let rolesList = Object.values(roles)
    let weaponsList = Object.values(weapons)
    let charactersList = Object.values(characters)

    // Filter by game
    if (filters.gameIds.length > 0) {
      rolesList = rolesList.filter((r) => filters.gameIds.includes((r as Role).gameId))
      weaponsList = weaponsList.filter((w) => filters.gameIds.includes((w as Weapon).gameId))
      charactersList = charactersList.filter((c) => filters.gameIds.includes((c as Character).gameId))
    }

    // Filter by type
    if (filters.types.length > 0) {
      const result: Entity[] = []
      if (filters.types.includes('role')) result.push(...rolesList)
      if (filters.types.includes('weapon')) result.push(...weaponsList)
      if (filters.types.includes('character')) result.push(...charactersList)
      return result
    }

    return [...rolesList, ...weaponsList, ...charactersList]
  }, [roles, weapons, characters, filters])

  const hasFilters = filters.gameIds.length > 0 || filters.types.length > 0

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Left Sidebar Filter - Fixed in left margin space */}
      <aside className="hidden xl:block fixed left-4 top-24 w-64 z-40">
        <MetaSidebarFilter filters={filters} onChange={setFilters} />
      </aside>

      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Game Meta</h1>
        <p className="text-muted-foreground mb-6">
          Roles, weapons, and characters
        </p>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search roles, weapons, characters..."
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MobileMetaFilterButton filters={filters} onChange={setFilters} />
            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredMeta.length} items
          </span>
        </div>

        <Leaderboard
          entities={filteredMeta}
          entityType="mixed"
          searchQuery={query}
          sortDirection={sortDirection}
          emptyMessage={hasFilters ? "No items match your filters" : "No roles, weapons, or characters yet"}
        />
      </div>
    </div>
  )
}
