import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, X, Gamepad2, Users, Globe, User, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
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

function FilterSection({ title, icon, count, children, defaultOpen = true }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between py-2 px-2 rounded-md transition-colors",
          isOpen ? "bg-accent" : "hover:bg-accent/50"
        )}
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
      {isOpen && <div className="py-2 px-1">{children}</div>}
    </div>
  )
}

interface FilterItemProps {
  label: string
  selected: boolean
  onToggle: () => void
  imageUrl?: string
  flagCode?: string
}

function FilterItem({ label, selected, onToggle, imageUrl, flagCode }: FilterItemProps) {
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
      {imageUrl && (
        <img src={imageUrl} alt="" className="w-5 h-5 object-cover rounded" />
      )}
      <span className="truncate">{label}</span>
    </button>
  )
}

interface SidebarFilterProps {
  filters: PlayerFilters
  onChange: (filters: PlayerFilters) => void
  className?: string
}

export function SidebarFilter({ filters, onChange, className }: SidebarFilterProps) {
  const [gameSearch, setGameSearch] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')

  const games = useAuraStore((s) => s.games)
  const organisations = useAuraStore((s) => s.organisations)
  const countries = useAuraStore((s) => s.countries)
  const players = useAuraStore((s) => s.players)

  const gameList = useMemo(() => {
    const list = Object.values(games)
    if (!gameSearch) return list.slice(0, 15)
    const q = gameSearch.toLowerCase()
    return list.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.aliases?.some(a => a.toLowerCase().includes(q))
    ).slice(0, 15)
  }, [games, gameSearch])

  const teamList = useMemo(() => {
    const list = Object.values(organisations)
    if (!teamSearch) return list.slice(0, 15)
    const q = teamSearch.toLowerCase()
    return list.filter(o => o.name.toLowerCase().includes(q)).slice(0, 15)
  }, [organisations, teamSearch])

  const countryList = useMemo(() => {
    const list = Object.values(countries)
    if (!countrySearch) return list.slice(0, 15)
    const q = countrySearch.toLowerCase()
    return list.filter(c => c.name.toLowerCase().includes(q)).slice(0, 15)
  }, [countries, countrySearch])

  const playerList = useMemo(() => {
    const list = Object.values(players)
    if (!playerSearch) return list.slice(0, 15)
    const q = playerSearch.toLowerCase()
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.aliases?.some(a => a.toLowerCase().includes(q))
    ).slice(0, 15)
  }, [players, playerSearch])

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

  const totalFilters = filters.gameIds.length + filters.organisationIds.length + filters.countryIds.length + filters.playerIds.length

  const clearAll = () => {
    onChange({ gameIds: [], organisationIds: [], countryIds: [], playerIds: [] })
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

      <div className="p-2 space-y-1">
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
                className="pl-7 h-7 text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
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
                className="pl-7 h-7 text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {teamList.map(team => (
                <FilterItem
                  key={team.id}
                  label={team.name}
                  selected={filters.organisationIds.includes(team.id)}
                  onToggle={() => toggleTeam(team.id)}
                  imageUrl={team.imageUrl}
                />
              ))}
            </div>
          </div>
        </FilterSection>

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
                className="pl-7 h-7 text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {countryList.map(country => (
                <FilterItem
                  key={country.id}
                  label={country.name}
                  selected={filters.countryIds.includes(country.id)}
                  onToggle={() => toggleCountry(country.id)}
                  flagCode={country.flagCode}
                />
              ))}
            </div>
          </div>
        </FilterSection>

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
                className="pl-7 h-7 text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {playerList.map(player => (
                <FilterItem
                  key={player.id}
                  label={player.name}
                  selected={filters.playerIds.includes(player.id)}
                  onToggle={() => togglePlayer(player.id)}
                  imageUrl={player.imageUrl}
                />
              ))}
            </div>
          </div>
        </FilterSection>
      </div>
    </div>
  )
}

// Mobile filter button that opens a sheet/drawer
interface MobileFilterButtonProps {
  filters: PlayerFilters
  onChange: (filters: PlayerFilters) => void
}

export function MobileFilterButton({ filters, onChange }: MobileFilterButtonProps) {
  const [open, setOpen] = useState(false)
  const totalFilters = filters.gameIds.length + filters.organisationIds.length + filters.countryIds.length + filters.playerIds.length

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
            <SidebarFilter filters={filters} onChange={onChange} className="border-0 rounded-none" />
          </div>
        </div>
      )}
    </>
  )
}
