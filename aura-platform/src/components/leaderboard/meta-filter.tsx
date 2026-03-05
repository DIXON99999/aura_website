import { useState, useMemo } from 'react'
import { Filter, X, Search, Gamepad2, Swords, Users, User } from 'lucide-react'
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

type FilterTab = 'game' | 'type'
type MetaType = 'role' | 'weapon' | 'character'

export interface MetaFilters {
  gameIds: string[]
  types: MetaType[]
}

interface MetaFilterProps {
  filters: MetaFilters
  onChange: (filters: MetaFilters) => void
}

const metaTypeOptions: { value: MetaType; label: string; icon: typeof Swords }[] = [
  { value: 'role', label: 'Roles', icon: Users },
  { value: 'weapon', label: 'Weapons', icon: Swords },
  { value: 'character', label: 'Characters', icon: User },
]

export function MetaFilter({ filters, onChange }: MetaFilterProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<FilterTab>('game')
  const [search, setSearch] = useState('')

  const games = useAuraStore((s) => s.games)
  const gameList = Object.values(games)

  const totalFilters = filters.gameIds.length + filters.types.length

  const filteredGames = useMemo(() => {
    if (!search) return gameList
    const query = search.toLowerCase()
    return gameList.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        g.slug.includes(query) ||
        g.aliases?.some((a) => a.toLowerCase().includes(query))
    )
  }, [gameList, search])

  const filteredTypes = useMemo(() => {
    if (!search) return metaTypeOptions
    const query = search.toLowerCase()
    return metaTypeOptions.filter((t) => t.label.toLowerCase().includes(query))
  }, [search])

  const toggleGame = (gameId: string) => {
    if (filters.gameIds.includes(gameId)) {
      onChange({ ...filters, gameIds: filters.gameIds.filter((id) => id !== gameId) })
    } else {
      onChange({ ...filters, gameIds: [...filters.gameIds, gameId] })
    }
  }

  const toggleType = (type: MetaType) => {
    if (filters.types.includes(type)) {
      onChange({ ...filters, types: filters.types.filter((t) => t !== type) })
    } else {
      onChange({ ...filters, types: [...filters.types, type] })
    }
  }

  const clearAll = () => {
    onChange({ gameIds: [], types: [] })
    setSearch('')
  }

  const tabs = [
    { id: 'game' as FilterTab, label: 'Game', icon: Gamepad2 },
    { id: 'type' as FilterTab, label: 'Type', icon: Swords },
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
          <span className="text-sm font-medium">Filter Meta</span>
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
            {tab === 'game' ? (
              filteredGames.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No games found</p>
              ) : (
                filteredGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      filters.gameIds.includes(game.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                    )}
                  >
                    {game.name}
                  </button>
                ))
              )
            ) : filteredTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No types found</p>
            ) : (
              filteredTypes.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleType(option.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1.5',
                    filters.types.includes(option.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  <option.icon className="w-3 h-3" />
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface MetaActiveFiltersProps {
  filters: MetaFilters
  onRemove: (type: 'gameIds' | 'types', id: string) => void
  onClearAll: () => void
}

export function MetaActiveFilters({ filters, onRemove, onClearAll }: MetaActiveFiltersProps) {
  const games = useAuraStore((s) => s.games)
  const totalFilters = filters.gameIds.length + filters.types.length

  if (totalFilters === 0) return null

  const getTypeLabel = (type: MetaType) => {
    return metaTypeOptions.find((t) => t.value === type)?.label || type
  }

  const getTypeIcon = (type: MetaType) => {
    const option = metaTypeOptions.find((t) => t.value === type)
    return option?.icon || Swords
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <span className="text-xs text-muted-foreground">Active:</span>

      {filters.gameIds.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 pr-1">
          <Gamepad2 className="w-3 h-3" />
          {games[id]?.name || id}
          <button onClick={() => onRemove('gameIds', id)} className="ml-1 hover:bg-muted rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {filters.types.map((type) => {
        const Icon = getTypeIcon(type)
        return (
          <Badge key={type} variant="secondary" className="gap-1 pr-1">
            <Icon className="w-3 h-3" />
            {getTypeLabel(type)}
            <button onClick={() => onRemove('types', type)} className="ml-1 hover:bg-muted rounded-full p-0.5">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )
      })}

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
