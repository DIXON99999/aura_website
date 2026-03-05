import { useState, useMemo } from 'react'
import { Filter, X, Search, Tag, Mouse } from 'lucide-react'
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
import { PeripheralType } from '@/types'

type FilterTab = 'type' | 'brand'

const peripheralTypeOptions = [
  { value: PeripheralType.MOUSE, label: 'Mouse' },
  { value: PeripheralType.MOUSEPAD, label: 'Mousepad' },
  { value: PeripheralType.KEYBOARD, label: 'Keyboard' },
  { value: PeripheralType.HEADSET, label: 'Headset' },
  { value: PeripheralType.MONITOR, label: 'Monitor' },
  { value: PeripheralType.CONTROLLER, label: 'Controller' },
]

export interface PeripheralFilters {
  types: string[]
  brandIds: string[]
}

interface PeripheralFilterProps {
  filters: PeripheralFilters
  onChange: (filters: PeripheralFilters) => void
}

export function PeripheralFilter({ filters, onChange }: PeripheralFilterProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<FilterTab>('type')
  const [search, setSearch] = useState('')

  const brands = useAuraStore((s) => s.brands)
  const brandList = Object.values(brands)

  const totalFilters = filters.types.length + filters.brandIds.length

  const filteredBrands = useMemo(() => {
    if (!search) return brandList
    const query = search.toLowerCase()
    return brandList.filter(
      (b) => b.name.toLowerCase().includes(query) || b.slug.includes(query)
    )
  }, [brandList, search])

  const filteredTypes = useMemo(() => {
    if (!search) return peripheralTypeOptions
    const query = search.toLowerCase()
    return peripheralTypeOptions.filter((t) =>
      t.label.toLowerCase().includes(query)
    )
  }, [search])

  const toggleType = (type: string) => {
    if (filters.types.includes(type)) {
      onChange({ ...filters, types: filters.types.filter((t) => t !== type) })
    } else {
      onChange({ ...filters, types: [...filters.types, type] })
    }
  }

  const toggleBrand = (brandId: string) => {
    if (filters.brandIds.includes(brandId)) {
      onChange({ ...filters, brandIds: filters.brandIds.filter((b) => b !== brandId) })
    } else {
      onChange({ ...filters, brandIds: [...filters.brandIds, brandId] })
    }
  }

  const clearAll = () => {
    onChange({ types: [], brandIds: [] })
    setSearch('')
  }

  const tabs = [
    { id: 'type' as FilterTab, label: 'Type', icon: Mouse },
    { id: 'brand' as FilterTab, label: 'Brand', icon: Tag },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-4 h-4" />
          Filter
          {totalFilters > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {totalFilters}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium">Filter Peripherals</span>
          {totalFilters > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="flex border-b">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSearch('') }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                tab === t.id
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}s...`}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {tab === 'type' ? (
              filteredTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No types found</p>
              ) : (
                filteredTypes.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => toggleType(option.value)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      filters.types.includes(option.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                    )}
                  >
                    {option.label}
                  </button>
                ))
              )
            ) : filteredBrands.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No brands found</p>
            ) : (
              filteredBrands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => toggleBrand(brand.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    filters.brandIds.includes(brand.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {brand.name}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface PeripheralActiveFiltersProps {
  filters: PeripheralFilters
  onRemove: (type: 'types' | 'brandIds', id: string) => void
  onClearAll: () => void
}

export function PeripheralActiveFilters({ filters, onRemove, onClearAll }: PeripheralActiveFiltersProps) {
  const brands = useAuraStore((s) => s.brands)
  const totalFilters = filters.types.length + filters.brandIds.length

  if (totalFilters === 0) return null

  const getTypeLabel = (type: string) => {
    return peripheralTypeOptions.find((t) => t.value === type)?.label || type
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <span className="text-xs text-muted-foreground">Active:</span>

      {filters.types.map((type) => (
        <Badge key={type} variant="secondary" className="gap-1 pr-1">
          <Mouse className="w-3 h-3" />
          {getTypeLabel(type)}
          <button onClick={() => onRemove('types', type)} className="ml-1 hover:bg-muted rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {filters.brandIds.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 pr-1">
          <Tag className="w-3 h-3" />
          {brands[id]?.name || id}
          <button onClick={() => onRemove('brandIds', id)} className="ml-1 hover:bg-muted rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {totalFilters > 1 && (
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
