import { useState, useMemo } from 'react'
import { Filter, X, Search } from 'lucide-react'
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

interface TeamGameFilterProps {
  selectedGameIds: string[]
  onChange: (gameIds: string[]) => void
}

export function TeamGameFilter({ selectedGameIds, onChange }: TeamGameFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const games = useAuraStore((s) => s.games)
  const gameList = Object.values(games)

  const filteredGames = useMemo(() => {
    if (!search) return gameList
    const query = search.toLowerCase()
    return gameList.filter(
      (game) =>
        game.name.toLowerCase().includes(query) ||
        game.slug.toLowerCase().includes(query) ||
        game.aliases?.some((a) => a.toLowerCase().includes(query))
    )
  }, [gameList, search])

  const toggleGame = (gameId: string) => {
    if (selectedGameIds.includes(gameId)) {
      onChange(selectedGameIds.filter((id) => id !== gameId))
    } else {
      onChange([...selectedGameIds, gameId])
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
          {selectedGameIds.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {selectedGameIds.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Filter by Game</span>
          {selectedGameIds.length > 0 && (
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
            placeholder="Search games..."
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {filteredGames.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No games found</p>
          ) : (
            filteredGames.map((game) => (
              <button
                key={game.id}
                onClick={() => toggleGame(game.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  selectedGameIds.includes(game.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                )}
              >
                {game.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ActiveFiltersProps {
  selectedGameIds: string[]
  onRemove: (gameId: string) => void
  onClearAll: () => void
}

export function ActiveFilters({ selectedGameIds, onRemove, onClearAll }: ActiveFiltersProps) {
  const games = useAuraStore((s) => s.games)

  if (selectedGameIds.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <span className="text-xs text-muted-foreground">Active:</span>
      {selectedGameIds.map((gameId) => {
        const game = games[gameId]
        return (
          <Badge key={gameId} variant="secondary" className="gap-1 pr-1">
            {game?.name || gameId}
            <button
              onClick={() => onRemove(gameId)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )
      })}
      {selectedGameIds.length > 1 && (
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
