import { useState, useMemo } from 'react'
import { Filter, X, Search, Users, Globe, Gamepad2, User } from 'lucide-react'
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

type FilterTab = 'game' | 'team' | 'country' | 'player'

export interface PlayerFilters {
  gameIds: string[]
  organisationIds: string[]
  countryIds: string[]
  playerIds: string[]
}

interface PlayerFilterProps {
  filters: PlayerFilters
  onChange: (filters: PlayerFilters) => void
}

export function PlayerFilter({ filters, onChange }: PlayerFilterProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<FilterTab>('game')
  const [search, setSearch] = useState('')

  const games = useAuraStore((s) => s.games)
  const organisations = useAuraStore((s) => s.organisations)
  const countries = useAuraStore((s) => s.countries)
  const players = useAuraStore((s) => s.players)

  const gameList = Object.values(games)
  const orgList = Object.values(organisations)
  const countryList = Object.values(countries)
  const playerList = Object.values(players)

  const totalFilters =
    filters.gameIds.length +
    filters.organisationIds.length +
    filters.countryIds.length +
    filters.playerIds.length

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase()
    switch (tab) {
      case 'game':
        return gameList.filter(
          (g) =>
            g.name.toLowerCase().includes(query) ||
            g.slug.includes(query) ||
            g.aliases?.some((a) => a.toLowerCase().includes(query))
        )
      case 'team':
        return orgList.filter(
          (o) => o.name.toLowerCase().includes(query) || o.slug.includes(query)
        )
      case 'country':
        return countryList.filter(
          (c) => c.name.toLowerCase().includes(query) || c.slug.includes(query)
        )
      case 'player':
        return playerList.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.slug.includes(query) ||
            p.aliases?.some((a) => a.toLowerCase().includes(query))
        )
      default:
        return []
    }
  }, [tab, search, gameList, orgList, countryList, playerList])

  const toggleFilter = (id: string) => {
    const key = tab === 'game' ? 'gameIds'
      : tab === 'team' ? 'organisationIds'
      : tab === 'country' ? 'countryIds'
      : 'playerIds'

    const current = filters[key]
    if (current.includes(id)) {
      onChange({ ...filters, [key]: current.filter((i) => i !== id) })
    } else {
      onChange({ ...filters, [key]: [...current, id] })
    }
  }

  const isSelected = (id: string) => {
    switch (tab) {
      case 'game': return filters.gameIds.includes(id)
      case 'team': return filters.organisationIds.includes(id)
      case 'country': return filters.countryIds.includes(id)
      case 'player': return filters.playerIds.includes(id)
      default: return false
    }
  }

  const clearAll = () => {
    onChange({ gameIds: [], organisationIds: [], countryIds: [], playerIds: [] })
    setSearch('')
  }

  const tabs = [
    { id: 'game' as FilterTab, label: 'Game', icon: Gamepad2 },
    { id: 'team' as FilterTab, label: 'Team', icon: Users },
    { id: 'country' as FilterTab, label: 'Country', icon: Globe },
    { id: 'player' as FilterTab, label: 'Player', icon: User },
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
      <PopoverContent className="w-96 p-0" align="start">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium">Filter Players</span>
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
            {filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No {tab}s found</p>
            ) : (
              filteredItems.slice(0, 50).map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleFilter(item.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    isSelected(item.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface PlayerActiveFiltersProps {
  filters: PlayerFilters
  onRemove: (type: keyof PlayerFilters, id: string) => void
  onClearAll: () => void
}

export function PlayerActiveFilters({ filters, onRemove, onClearAll }: PlayerActiveFiltersProps) {
  const games = useAuraStore((s) => s.games)
  const organisations = useAuraStore((s) => s.organisations)
  const countries = useAuraStore((s) => s.countries)
  const players = useAuraStore((s) => s.players)

  const totalFilters =
    filters.gameIds.length +
    filters.organisationIds.length +
    filters.countryIds.length +
    filters.playerIds.length

  if (totalFilters === 0) return null

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

      {filters.organisationIds.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 pr-1">
          <Users className="w-3 h-3" />
          {organisations[id]?.name || id}
          <button onClick={() => onRemove('organisationIds', id)} className="ml-1 hover:bg-muted rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {filters.countryIds.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 pr-1">
          <Globe className="w-3 h-3" />
          {countries[id]?.name || id}
          <button onClick={() => onRemove('countryIds', id)} className="ml-1 hover:bg-muted rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {filters.playerIds.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 pr-1">
          <User className="w-3 h-3" />
          {players[id]?.name || id}
          <button onClick={() => onRemove('playerIds', id)} className="ml-1 hover:bg-muted rounded-full p-0.5">
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
