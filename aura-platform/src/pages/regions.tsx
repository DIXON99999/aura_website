import { useMemo, useState } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import { Leaderboard, SortButton, RegionSidebarFilter, MobileRegionFilterButton, type SortDirection } from '@/components/leaderboard'
import { useAuraStore } from '@/stores'
import type { Entity } from '@/types'

export function RegionsPage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([])
  const countries = useAuraStore((s) => s.countries)
  const regions = useAuraStore((s) => s.regions)

  const countryList = useMemo(() => Object.values(countries), [countries])

  const allRegions = useMemo<Entity[]>(() => {
    if (selectedCountryIds.length > 0) {
      return countryList.filter((country) => selectedCountryIds.includes(country.id))
    }
    return [...countryList, ...Object.values(regions)]
  }, [countryList, regions, selectedCountryIds])

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Left Sidebar Filter - Fixed in left margin space */}
      <aside className="hidden xl:block fixed left-4 top-24 w-64 z-40">
        <RegionSidebarFilter
          selectedCountryIds={selectedCountryIds}
          onChange={setSelectedCountryIds}
        />
      </aside>

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
          <div className="flex items-center gap-2">
            <MobileRegionFilterButton
              selectedCountryIds={selectedCountryIds}
              onChange={setSelectedCountryIds}
            />
            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {allRegions.length} {selectedCountryIds.length > 0 ? 'countries' : 'regions'}
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
