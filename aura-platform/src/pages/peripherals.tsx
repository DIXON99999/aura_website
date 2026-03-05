import { useMemo, useState } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import {
  Leaderboard,
  SortButton,
  PeripheralFilter,
  PeripheralActiveFilters,
  type SortDirection,
  type PeripheralFilters,
} from '@/components/leaderboard'
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

    // Filter by type
    if (filters.types.length > 0) {
      result = result.filter((p) =>
        filters.types.includes((p as Peripheral).peripheralType)
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

  const removeFilter = (type: 'types' | 'brandIds', id: string) => {
    setFilters({
      ...filters,
      [type]: filters[type].filter((i) => i !== id),
    })
  }

  const clearAllFilters = () => {
    setFilters(emptyFilters)
  }

  const hasFilters = filters.types.length > 0 || filters.brandIds.length > 0

  return (
    <div className="container mx-auto px-4 py-8">
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PeripheralFilter filters={filters} onChange={setFilters} />
            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredPeripherals.length} items
          </span>
        </div>

        <PeripheralActiveFilters
          filters={filters}
          onRemove={removeFilter}
          onClearAll={clearAllFilters}
        />

        <div className={hasFilters ? 'mt-4' : 'mt-2'}>
          <Leaderboard
            entities={filteredPeripherals}
            entityType={EntityTypes.PERIPHERAL}
            searchQuery={query}
            sortDirection={sortDirection}
            emptyMessage={hasFilters ? "No peripherals match your filters" : "No peripherals yet"}
          />
        </div>
      </div>
    </div>
  )
}
