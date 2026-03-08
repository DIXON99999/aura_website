import { useMemo, useState } from 'react'
import { SearchBar, useSearch } from '@/components/layout'
import { Leaderboard, SortButton, type SortDirection } from '@/components/leaderboard'
import { useAuraStore } from '@/stores'
import type { Entity } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Filter, Globe, Search, X } from 'lucide-react'

export function RegionsPage() {
  const { query, setQuery } = useSearch()
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterOpen, setFilterOpen] = useState(false)
  const [countryQuery, setCountryQuery] = useState('')
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([])
  const countries = useAuraStore((s) => s.countries)
  const regions = useAuraStore((s) => s.regions)

  const countryList = useMemo(() => Object.values(countries), [countries])

  const filteredCountryOptions = useMemo(() => {
    const q = countryQuery.trim().toLowerCase()
    if (!q) return countryList
    return countryList.filter((country) =>
      country.name.toLowerCase().includes(q) || country.slug.toLowerCase().includes(q)
    )
  }, [countryList, countryQuery])

  const allRegions = useMemo<Entity[]>(() => {
    if (selectedCountryIds.length > 0) {
      return countryList.filter((country) => selectedCountryIds.includes(country.id))
    }
    return [...countryList, ...Object.values(regions)]
  }, [countryList, regions, selectedCountryIds])

  const toggleCountryFilter = (countryId: string) => {
    setSelectedCountryIds((prev) =>
      prev.includes(countryId)
        ? prev.filter((id) => id !== countryId)
        : [...prev, countryId]
    )
  }

  const clearCountryFilters = () => {
    setSelectedCountryIds([])
    setCountryQuery('')
  }

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
          <div className="flex items-center gap-2">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Country Filter
                  {selectedCountryIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                      {selectedCountryIds.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="start">
                <div className="flex items-center justify-between p-3 border-b">
                  <span className="text-sm font-medium">Filter Countries</span>
                  {selectedCountryIds.length > 0 && (
                    <button
                      onClick={clearCountryFilters}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="p-3">
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                      placeholder="Search countries..."
                      className="pl-8 h-9 text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {filteredCountryOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No countries found</p>
                    ) : (
                      filteredCountryOptions.map((country) => {
                        const selected = selectedCountryIds.includes(country.id)
                        return (
                          <button
                            key={country.id}
                            onClick={() => toggleCountryFilter(country.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'}`}
                          >
                            {country.name}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <SortButton
              direction={sortDirection}
              onChange={setSortDirection}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {allRegions.length} {selectedCountryIds.length > 0 ? 'countries' : 'regions'}
          </span>
        </div>

        {selectedCountryIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Active:</span>
            {selectedCountryIds.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                <Globe className="w-3 h-3" />
                {countries[id]?.name || id}
                <button
                  onClick={() => toggleCountryFilter(id)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

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
