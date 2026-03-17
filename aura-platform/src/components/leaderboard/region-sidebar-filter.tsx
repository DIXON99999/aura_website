import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, X, Globe, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuraStore } from '@/stores'

interface FilterSectionProps {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function FilterSection({ title, icon, count, children, defaultOpen = false }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          {count > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
              {count}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="pb-3 px-1">{children}</div>}
    </div>
  )
}

interface FilterItemProps {
  label: string
  selected: boolean
  onToggle: () => void
  flagCode?: string
}

function FilterItem({ label, selected, onToggle, flagCode }: FilterItemProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors',
        selected ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground'
      )}
    >
      <div className={cn(
        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
        selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
      )}>
        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
      {flagCode && (
        <img
          src={`https://flagcdn.com/w20/${flagCode.toLowerCase()}.png`}
          alt=""
          className="w-5 h-3 object-cover rounded-sm"
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  )
}

interface RegionSidebarFilterProps {
  selectedCountryIds: string[]
  onChange: (countryIds: string[]) => void
  className?: string
}

export function RegionSidebarFilter({ selectedCountryIds, onChange, className }: RegionSidebarFilterProps) {
  const [countrySearch, setCountrySearch] = useState('')
  const countries = useAuraStore((s) => s.countries)

  const countryList = useMemo(() => {
    const list = Object.values(countries)
    if (!countrySearch) return list.slice(0, 50)
    const q = countrySearch.toLowerCase()
    return list.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50)
  }, [countries, countrySearch])

  const toggleCountry = (id: string) => {
    const newIds = selectedCountryIds.includes(id)
      ? selectedCountryIds.filter(i => i !== id)
      : [...selectedCountryIds, id]
    onChange(newIds)
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className={cn('bg-card rounded-lg border', className)}>
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-semibold">Filters</span>
        {selectedCountryIds.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="p-2">
        <FilterSection
          title="Country"
          icon={<Globe className="w-4 h-4 text-muted-foreground" />}
          count={selectedCountryIds.length}
          defaultOpen={true}
        >
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search countries..."
                className="pl-7 h-8 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {countryList.map(country => (
                <FilterItem
                  key={country.id}
                  label={country.name}
                  selected={selectedCountryIds.includes(country.id)}
                  onToggle={() => toggleCountry(country.id)}
                  flagCode={country.flagCode}
                />
              ))}
            </div>
          </div>
        </FilterSection>
      </div>
    </div>
  )
}

// Mobile filter button
interface MobileRegionFilterButtonProps {
  selectedCountryIds: string[]
  onChange: (countryIds: string[]) => void
}

export function MobileRegionFilterButton({ selectedCountryIds, onChange }: MobileRegionFilterButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="xl:hidden flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
      >
        <span>Filters</span>
        {selectedCountryIds.length > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
            {selectedCountryIds.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold">Filters</span>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <RegionSidebarFilter selectedCountryIds={selectedCountryIds} onChange={onChange} className="border-0 rounded-none" />
          </div>
        </div>
      )}
    </>
  )
}
