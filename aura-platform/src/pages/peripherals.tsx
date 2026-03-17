import { useMemo, useState } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import {
  Leaderboard,
  SortButton,
  PeripheralSidebarFilter,
  MobilePeripheralFilterButton,
  type SortDirection,
} from '@/components/leaderboard'
import type { PeripheralFilters } from '@/components/leaderboard/peripheral-sidebar-filter'
import { useAuraStore } from '@/stores'
import { EntityTypes } from '@/types'
import type { Peripheral } from '@/types'

const emptyFilters: PeripheralFilters = {
  types: [],
  brandIds: [],
}

export function PeripheralsPage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filters, setFilters] = useState<PeripheralFilters>(emptyFilters)

  const peripherals = useAuraStore((s) => s.peripherals)

  const filteredPeripherals = useMemo(() => {
    let result = Object.values(peripherals)

    // Filter by type (case-insensitive comparison)
    if (filters.types.length > 0) {
      const typesLower = filters.types.map(t => t.toLowerCase())
      result = result.filter((p) =>
        typesLower.includes((p as Peripheral).peripheralType?.toLowerCase())
      )
    }

    // Filter by brand
    if (filters.brandIds.length > 0) {
      result = result.filter((p) =>
        filters.brandIds.includes((p as Peripheral).brandId)
      )
    }

    return result
  }, [peripherals, filters])

  const hasFilters = filters.types.length > 0 || filters.brandIds.length > 0

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Left Sidebar Filter - Fixed in left margin space */}
      <aside className="hidden xl:block fixed left-4 top-24 w-64 z-40">
        <PeripheralSidebarFilter filters={filters} onChange={setFilters} />
      </aside>

      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Peripherals</h1>
        <p className="text-muted-foreground mb-6">
          Gaming gear and equipment
        </p>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search peripherals..."
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MobilePeripheralFilterButton filters={filters} onChange={setFilters} />
            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredPeripherals.length} items
          </span>
        </div>

        <Leaderboard
          entities={filteredPeripherals}
          entityType={EntityTypes.PERIPHERAL}
          searchQuery={query}
          sortDirection={sortDirection}
          emptyMessage={hasFilters ? "No peripherals match your filters" : "No peripherals yet"}
        />
      </div>
    </div>
  )
}
