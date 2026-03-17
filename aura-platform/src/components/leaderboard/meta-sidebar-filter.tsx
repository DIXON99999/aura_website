import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, X, Gamepad2, Swords, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuraStore } from '@/stores'

type MetaType = 'role' | 'weapon' | 'character'

export interface MetaFilters {
  gameIds: string[]
  types: MetaType[]
}

const metaTypeOptions: { value: MetaType; label: string; description: string }[] = [
  { value: 'role', label: 'Roles', description: 'In-game roles and positions' },
  { value: 'weapon', label: 'Weapons', description: 'Weapons and equipment' },
  { value: 'character', label: 'Characters', description: 'Playable characters and agents' },
]

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
  description?: string
  selected: boolean
  onToggle: () => void
  imageUrl?: string
}

function FilterItem({ label, description, selected, onToggle, imageUrl }: FilterItemProps) {
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
      {imageUrl && (
        <img src={imageUrl} alt="" className="w-5 h-5 object-cover rounded" />
      )}
      <div className="text-left">
        <div className="font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </button>
  )
}

interface MetaSidebarFilterProps {
  filters: MetaFilters
  onChange: (filters: MetaFilters) => void
  className?: string
}

export function MetaSidebarFilter({ filters, onChange, className }: MetaSidebarFilterProps) {
  const [gameSearch, setGameSearch] = useState('')
  const games = useAuraStore((s) => s.games)

  const gameList = useMemo(() => {
    const list = Object.values(games)
    if (!gameSearch) return list.slice(0, 30)
    const q = gameSearch.toLowerCase()
    return list.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.aliases?.some(a => a.toLowerCase().includes(q))
    ).slice(0, 30)
  }, [games, gameSearch])

  const toggleGame = (id: string) => {
    const newIds = filters.gameIds.includes(id)
      ? filters.gameIds.filter(i => i !== id)
      : [...filters.gameIds, id]
    onChange({ ...filters, gameIds: newIds })
  }

  const toggleType = (type: MetaType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type]
    onChange({ ...filters, types: newTypes })
  }

  const totalFilters = filters.gameIds.length + filters.types.length

  const clearAll = () => {
    onChange({ gameIds: [], types: [] })
  }

  return (
    <div className={cn('bg-card rounded-lg border', className)}>
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-semibold">Filters</span>
        {totalFilters > 0 && (
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
          title="Type"
          icon={<Swords className="w-4 h-4 text-muted-foreground" />}
          count={filters.types.length}
          defaultOpen={true}
        >
          <div className="space-y-0.5">
            {metaTypeOptions.map(option => (
              <FilterItem
                key={option.value}
                label={option.label}
                description={option.description}
                selected={filters.types.includes(option.value)}
                onToggle={() => toggleType(option.value)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection
          title="Game"
          icon={<Gamepad2 className="w-4 h-4 text-muted-foreground" />}
          count={filters.gameIds.length}
        >
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                placeholder="Search games..."
                className="pl-7 h-8 text-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {gameList.map(game => (
                <FilterItem
                  key={game.id}
                  label={game.name}
                  selected={filters.gameIds.includes(game.id)}
                  onToggle={() => toggleGame(game.id)}
                  imageUrl={game.imageUrl}
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
interface MobileMetaFilterButtonProps {
  filters: MetaFilters
  onChange: (filters: MetaFilters) => void
}

export function MobileMetaFilterButton({ filters, onChange }: MobileMetaFilterButtonProps) {
  const [open, setOpen] = useState(false)
  const totalFilters = filters.gameIds.length + filters.types.length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="xl:hidden flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
      >
        <span>Filters</span>
        {totalFilters > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
            {totalFilters}
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
            <MetaSidebarFilter filters={filters} onChange={onChange} className="border-0 rounded-none" />
          </div>
        </div>
      )}
    </>
  )
}
