import { useState, useMemo } from 'react'
import { Filter, X, Search, Users, Globe, Gamepad2, User, ChevronDown, ChevronRight } from 'lucide-react'
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

export interface PlayerFilters {
  gameIds: string[]
  organisationIds: string[]
  countryIds: string[]
  playerIds: string[]
}

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
        className="w-full flex items-center justify-between py-2.5 px-1 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          {count > 0 && (
            <Badge variant="default" className="px-1.5 py-0 text-xs h-5">
              {count}
            </Badge>
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

interface PlayerFilterProps {
  filters: PlayerFilters
  onChange: (filters: PlayerFilters) => void
}

export function PlayerFilter({ filters, onChange }: PlayerFilterProps) {
  const [open, setOpen] = useState(false)
  const [gameSearch, setGameSearch] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')

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

  const filteredGames = useMemo(() => {
    if (!gameSearch) return gameList.slice(0, 20)
    const q = gameSearch.toLowerCase()
    return gameList.filter(g =>
      g.name.toLowerCase().includes(q) || g.aliases?.some(a => a.toLowerCase().includes(q))
    ).slice(0, 20)
  }, [gameList, gameSearch])

  const filteredTeams = useMemo(() => {
    if (!teamSearch) return orgList.slice(0, 20)
    const q = teamSearch.toLowerCase()
    return orgList.filter(o => o.name.toLowerCase().includes(q)).slice(0, 20)
  }, [orgList, teamSearch])

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return countryList.slice(0, 30)
    const q = countrySearch.toLowerCase()
    return countryList.filter(c => c.name.toLowerCase().includes(q)).slice(0, 30)
  }, [countryList, countrySearch])

  const filteredPlayers = useMemo(() => {
    if (!playerSearch) return playerList.slice(0, 20)
    const q = playerSearch.toLowerCase()
    return playerList.filter(p =>
      p.name.toLowerCase().includes(q) || p.aliases?.some(a => a.toLowerCase().includes(q))
    ).slice(0, 20)
  }, [playerList, playerSearch])

  const toggleGame = (id: string) => {
    const newIds = filters.gameIds.includes(id)
      ? filters.gameIds.filter(i => i !== id)
      : [...filters.gameIds, id]
    onChange({ ...filters, gameIds: newIds })
  }

  const toggleTeam = (id: string) => {
    const newIds = filters.organisationIds.includes(id)
      ? filters.organisationIds.filter(i => i !== id)
      : [...filters.organisationIds, id]
    onChange({ ...filters, organisationIds: newIds })
  }

  const toggleCountry = (id: string) => {
    const newIds = filters.countryIds.includes(id)
      ? filters.countryIds.filter(i => i !== id)
      : [...filters.countryIds, id]
    onChange({ ...filters, countryIds: newIds })
  }

  const togglePlayer = (id: string) => {
    const newIds = filters.playerIds.includes(id)
      ? filters.playerIds.filter(i => i !== id)
      : [...filters.playerIds, id]
    onChange({ ...filters, playerIds: newIds })
  }

  const clearAll = () => {
    onChange({ gameIds: [], organisationIds: [], countryIds: [], playerIds: [] })
  }

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

        <div className="max-h-[400px] overflow-y-auto p-2">
          {/* Game Section */}
          <FilterSection
            title="Game"
            icon={<Gamepad2 className="w-4 h-4 text-muted-foreground" />}
            count={filters.gameIds.length}
            defaultOpen={true}
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
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredGames.map(game => (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                      filters.gameIds.includes(game.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                    )}
                  >
                    {game.name}
                  </button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* Team Section */}
          <FilterSection
            title="Team"
            icon={<Users className="w-4 h-4 text-muted-foreground" />}
            count={filters.organisationIds.length}
          >
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search teams..."
                  className="pl-7 h-8 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredTeams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => toggleTeam(team.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                      filters.organisationIds.includes(team.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                    )}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* Country Section */}
          <FilterSection
            title="Country"
            icon={<Globe className="w-4 h-4 text-muted-foreground" />}
            count={filters.countryIds.length}
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
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredCountries.map(country => (
                  <button
                    key={country.id}
                    onClick={() => toggleCountry(country.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                      filters.countryIds.includes(country.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                    )}
                  >
                    {country.name}
                  </button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* Player Section */}
          <FilterSection
            title="Player"
            icon={<User className="w-4 h-4 text-muted-foreground" />}
            count={filters.playerIds.length}
          >
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Search players..."
                  className="pl-7 h-8 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredPlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                      filters.playerIds.includes(player.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                    )}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          </FilterSection>
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
