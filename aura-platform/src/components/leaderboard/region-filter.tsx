import { useState, useMemo } from 'react'
import { Filter, X, Search, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useAuraStore } from '@/stores'

interface RegionFilterProps {
  selectedCountryIds: string[]
  onChange: (countryIds: string[]) => void
}

export function RegionFilter({ selectedCountryIds, onChange }: RegionFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const countries = useAuraStore((s) => s.countries)
  const countryList = Object.values(countries)

  const filteredCountries = useMemo(() => {
    if (!search) return countryList
    const query = search.toLowerCase()
    return countryList.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.slug.toLowerCase().includes(query)
    )
  }, [countryList, search])

  const toggleCountry = (countryId: string) => {
    if (selectedCountryIds.includes(countryId)) {
      onChange(selectedCountryIds.filter((id) => id !== countryId))
    } else {
      onChange([...selectedCountryIds, countryId])
    }
  }

  const clearFilters = () => {
    onChange([])
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-4 h-4" />
          Filter
          {selectedCountryIds.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {selectedCountryIds.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Filter by Country</span>
          {selectedCountryIds.length > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search countries..."
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {filteredCountries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No countries found</p>
          ) : (
            filteredCountries.map((country) => (
              <button
                key={country.id}
                onClick={() => toggleCountry(country.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  selectedCountryIds.includes(country.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                )}
              >
                {country.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface RegionActiveFiltersProps {
  selectedCountryIds: string[]
  onRemove: (countryId: string) => void
  onClearAll: () => void
}

export function RegionActiveFilters({ selectedCountryIds, onRemove, onClearAll }: RegionActiveFiltersProps) {
  const countries = useAuraStore((s) => s.countries)

  if (selectedCountryIds.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <span className="text-xs text-muted-foreground">Active:</span>
      {selectedCountryIds.map((countryId) => {
        const country = countries[countryId]
        return (
          <Badge key={countryId} variant="secondary" className="gap-1 pr-1">
            <Globe className="w-3 h-3" />
            {country?.name || countryId}
            <button
              onClick={() => onRemove(countryId)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )
      })}
      {selectedCountryIds.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
