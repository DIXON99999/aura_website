import { useMemo, useState } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import { Leaderboard, SortButton, type SortDirection } from '@/components/leaderboard'
import { useAuraStore } from '@/stores'
import type { Entity } from '@/types'

export function RegionsPage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const countries = useAuraStore((s) => s.countries)
  const regions = useAuraStore((s) => s.regions)

  const allRegions = useMemo<Entity[]>(() => {
    return [
      ...Object.values(countries),
      ...Object.values(regions),
    ]
  }, [countries, regions])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Regions</h1>
        <p className="text-muted-foreground mb-6">
          Countries and competitive regions
        </p>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search regions..."
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <SortButton
            direction={sortDirection}
            onChange={setSortDirection}
          />
          <span className="text-sm text-muted-foreground">
            {allRegions.length} regions
          </span>
        </div>

        <Leaderboard
          entities={allRegions}
          entityType="mixed"
          searchQuery={query}
          sortDirection={sortDirection}
          emptyMessage="No regions yet"
        />
      </div>
    </div>
  )
}
