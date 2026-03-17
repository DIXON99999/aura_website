import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Search, X, ChevronUp, ChevronDown, Pencil, LayoutGrid, Users, Building2, Gamepad2, Globe, Mouse, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlayerFilter, type PlayerFilters } from '@/components/leaderboard'
import { useAuraStore, useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import { EntityTypes } from '@/types'
import type { Entity, Country, Player, OrganisationGame } from '@/types'

const emptyPlayerFilters: PlayerFilters = {
  gameIds: [],
  organisationIds: [],
  countryIds: [],
  playerIds: [],
}

interface TierRow {
  id: string
  label: string
  color: string
  entities: Entity[]
}

const DEFAULT_TIERS: Omit<TierRow, 'entities'>[] = [
  { id: 's', label: 'S', color: 'bg-red-500' },
  { id: 'a', label: 'A', color: 'bg-orange-500' },
  { id: 'b', label: 'B', color: 'bg-yellow-500' },
  { id: 'c', label: 'C', color: 'bg-green-500' },
  { id: 'd', label: 'D', color: 'bg-cyan-500' },
  { id: 'e', label: 'E', color: 'bg-blue-500' },
  { id: 'f', label: 'F', color: 'bg-purple-500' },
]

const TIER_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-gray-500',
]

type TabType = 'all' | 'players' | 'teams' | 'games' | 'regions' | 'peripherals' | 'meta'

const TABS: { type: TabType; label: string; icon: typeof LayoutGrid }[] = [
  { type: 'all', label: 'All', icon: LayoutGrid },
  { type: 'players', label: 'Players', icon: Users },
  { type: 'teams', label: 'Teams', icon: Building2 },
  { type: 'games', label: 'Games', icon: Gamepad2 },
  { type: 'regions', label: 'Regions', icon: Globe },
  { type: 'peripherals', label: 'Peripherals', icon: Mouse },
  { type: 'meta', label: 'Meta', icon: Swords },
]

function EntityCard({ entity, onRemove, onClick }: {
  entity: Entity
  onRemove?: () => void
  onClick?: () => void
}) {
  // Size slightly smaller than tier row height to fit with padding
  const sizeClasses = 'w-[72px] h-[72px]'

  const renderImage = () => {
    if (entity.type === EntityTypes.COUNTRY) {
      return (
        <img
          src={`https://flagcdn.com/w80/${(entity as Country).flagCode.toLowerCase()}.png`}
          alt={entity.name}
          className="w-full h-full object-cover"
        />
      )
    }
    if (entity.imageUrl) {
      return (
        <img
          src={entity.imageUrl}
          alt={entity.name}
          className="w-full h-full object-contain"
        />
      )
    }
    return (
      <span className="text-xs font-bold text-muted-foreground">
        {entity.name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <div
      className={cn(
        "relative group rounded bg-card border border-border flex items-center justify-center overflow-hidden transition-all",
        sizeClasses,
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary",
        !onClick && "cursor-grab active:cursor-grabbing"
      )}
      draggable={!onClick}
      onClick={onClick}
      onDragStart={(e) => {
        if (!onClick) {
          e.dataTransfer.setData('entityId', entity.id)
          e.dataTransfer.setData('entityType', entity.type)
        }
      }}
    >
      {renderImage()}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5">
        <p className="text-[9px] text-white truncate text-center font-medium">{entity.name}</p>
      </div>
    </div>
  )
}

export function CreateTierListPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const countries = useAuraStore((s) => s.countries)
  const games = useAuraStore((s) => s.games)
  const players = useAuraStore((s) => s.players)
  const organisations = useAuraStore((s) => s.organisations)
  const organisationGames = useAuraStore((s) => s.organisationGames)
  const peripherals = useAuraStore((s) => s.peripherals)
  const roles = useAuraStore((s) => s.roles)
  const weapons = useAuraStore((s) => s.weapons)
  const characters = useAuraStore((s) => s.characters)
  const brands = useAuraStore((s) => s.brands)
  const regions = useAuraStore((s) => s.regions)

  const [title, setTitle] = useState('Tier List')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tiers, setTiers] = useState<TierRow[]>(
    DEFAULT_TIERS.map(t => ({ ...t, entities: [] }))
  )
  const [pool, setPool] = useState<Entity[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [playerFilters, setPlayerFilters] = useState<PlayerFilters>(emptyPlayerFilters)
  const [editingTier, setEditingTier] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [dragOverTier, setDragOverTier] = useState<string | null>(null)

  // All entities memoized
  const allEntities = useMemo<Entity[]>(() => [
    ...Object.values(countries),
    ...Object.values(games),
    ...Object.values(players),
    ...Object.values(organisations),
    ...Object.values(organisationGames),
    ...Object.values(peripherals),
    ...Object.values(roles),
    ...Object.values(weapons),
    ...Object.values(characters),
    ...Object.values(brands),
    ...Object.values(regions),
  ], [countries, games, players, organisations, organisationGames, peripherals, roles, weapons, characters, brands, regions])

  // Valid players (filter incomplete profiles)
  const validPlayers = useMemo(() => {
    return Object.values(players).filter((p: Player) => {
      if (p.isUserProfile) {
        return p.name && p.countryId
      }
      return true
    })
  }, [players])

  // Get IDs of entities already in pool or tiers
  const usedEntityIds = useMemo(() => new Set([
    ...pool.map(e => e.id),
    ...tiers.flatMap(t => t.entities.map(e => e.id)),
  ]), [pool, tiers])

  // Filtered entities for the mini database based on active tab
  const filteredDatabaseEntities = useMemo(() => {
    let entities: Entity[] = []

    switch (activeTab) {
      case 'players': {
        let result = validPlayers
        // Apply player filters
        if (playerFilters.playerIds.length > 0) {
          result = result.filter((p) => playerFilters.playerIds.includes(p.id))
        }
        if (playerFilters.gameIds.length > 0) {
          result = result.filter((p) => playerFilters.gameIds.includes((p as Player).mainGameId))
        }
        if (playerFilters.organisationIds.length > 0) {
          result = result.filter((p) => {
            const orgId = (p as Player).organisationId
            return orgId && playerFilters.organisationIds.includes(orgId)
          })
        }
        if (playerFilters.countryIds.length > 0) {
          result = result.filter((p) => playerFilters.countryIds.includes((p as Player).countryId))
        }
        entities = result
        break
      }
      case 'teams':
        entities = [...Object.values(organisations), ...Object.values(organisationGames)]
        break
      case 'games':
        entities = Object.values(games)
        break
      case 'regions':
        entities = [...Object.values(regions), ...Object.values(countries)]
        break
      case 'peripherals':
        entities = [...Object.values(peripherals), ...Object.values(brands)]
        break
      case 'meta':
        entities = [...Object.values(roles), ...Object.values(weapons), ...Object.values(characters)]
        break
      case 'all':
      default:
        entities = [
          ...Object.values(countries),
          ...Object.values(games),
          ...Object.values(regions),
          ...Object.values(organisations),
          ...Object.values(organisationGames),
          ...Object.values(roles),
          ...Object.values(weapons),
          ...Object.values(characters),
          ...Object.values(brands),
          ...Object.values(peripherals),
          ...validPlayers,
        ]
    }

    // Filter out already used entities and apply search
    const query = searchQuery.toLowerCase().trim()
    return entities
      .filter(e => !usedEntityIds.has(e.id))
      .filter(e => !query || e.name.toLowerCase().includes(query))
      .sort((a, b) => (b.auraScore ?? 0) - (a.auraScore ?? 0))
  }, [activeTab, searchQuery, usedEntityIds, validPlayers, countries, games, regions, organisations, organisationGames, roles, weapons, characters, brands, peripherals, playerFilters])

  // Focus edit input when editing tier
  useEffect(() => {
    if (editingTier && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTier])

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const addToPool = (entity: Entity) => {
    setPool([...pool, entity])
  }

  const removeFromPool = (entityId: string) => {
    setPool(pool.filter(e => e.id !== entityId))
  }

  const removeEntityFromTier = (tierId: string, entityId: string) => {
    setTiers(tiers.map(t =>
      t.id === tierId
        ? { ...t, entities: t.entities.filter(e => e.id !== entityId) }
        : t
    ))
  }

  const handleDrop = (tierId: string, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverTier(null)
    const entityId = e.dataTransfer.getData('entityId')
    if (!entityId) return

    const entity = allEntities.find(ent => ent.id === entityId) || pool.find(ent => ent.id === entityId)
    if (!entity) return

    // Remove from pool
    setPool(prev => prev.filter(ent => ent.id !== entityId))
    // Remove from all tiers
    setTiers(prev => prev.map(t => ({
      ...t,
      entities: t.entities.filter(ent => ent.id !== entityId)
    })))

    // If dropping on pool, just remove from tier (entity goes back to pool)
    if (tierId === 'pool') {
      setPool(prev => [...prev, entity])
    } else {
      // Add to the target tier
      setTiers(prev => prev.map(t =>
        t.id === tierId
          ? { ...t, entities: [...t.entities, entity] }
          : t
      ))
    }
  }

  const addTier = () => {
    const newId = `tier-${Date.now()}`
    const colorIndex = tiers.length % TIER_COLORS.length
    setTiers([...tiers, {
      id: newId,
      label: 'New',
      color: TIER_COLORS[colorIndex],
      entities: [],
    }])
  }

  const removeTier = (tierId: string) => {
    const tier = tiers.find(t => t.id === tierId)
    if (tier) {
      // Move entities back to pool
      setPool(prev => [...prev, ...tier.entities])
    }
    setTiers(tiers.filter(t => t.id !== tierId))
  }

  const moveTierUp = (index: number) => {
    if (index === 0) return
    const newTiers = [...tiers]
    ;[newTiers[index - 1], newTiers[index]] = [newTiers[index], newTiers[index - 1]]
    setTiers(newTiers)
  }

  const moveTierDown = (index: number) => {
    if (index === tiers.length - 1) return
    const newTiers = [...tiers]
    ;[newTiers[index], newTiers[index + 1]] = [newTiers[index + 1], newTiers[index]]
    setTiers(newTiers)
  }

  const startEditingTier = (tierId: string, currentLabel: string) => {
    setEditingTier(tierId)
    setEditLabel(currentLabel)
  }

  const saveEditingTier = () => {
    if (editingTier && editLabel.trim()) {
      setTiers(tiers.map(t =>
        t.id === editingTier
          ? { ...t, label: editLabel.trim() }
          : t
      ))
    }
    setEditingTier(null)
    setEditLabel('')
  }

  const changeTierColor = (tierId: string) => {
    setTiers(tiers.map(t => {
      if (t.id !== tierId) return t
      const currentIndex = TIER_COLORS.indexOf(t.color)
      const nextIndex = (currentIndex + 1) % TIER_COLORS.length
      return { ...t, color: TIER_COLORS[nextIndex] }
    }))
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Please sign in to create a tier list.</p>
      </div>
    )
  }

  // Calculate heights
  const tierRowHeight = 84 // Fits 72px cards with padding
  const tierGap = 6
  const addButtonHeight = 44
  const titleHeight = 48
  const totalTierHeight = titleHeight + (tiers.length * tierRowHeight) + ((tiers.length - 1) * tierGap) + addButtonHeight

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Left sidebar - Mini Database & Pool stacked */}
      <aside className="hidden xl:flex flex-col fixed left-4 top-20 z-40 gap-2" style={{ width: 'calc((100vw - 768px) / 2 - 2rem)', height: 'calc(100vh - 6rem)' }}>
        {/* Mini Database */}
        <div className="border rounded-lg overflow-hidden flex flex-col bg-background flex-1">
          {/* Tabs */}
          <div className="bg-muted/50 border-b flex-shrink-0 overflow-x-auto">
            <div className="flex flex-wrap">
              {TABS.map(tab => (
                <button
                  key={tab.type}
                  onClick={() => setActiveTab(tab.type)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    activeTab === tab.type
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <tab.icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filter + Search */}
          <div className="px-2 py-2 border-b flex-shrink-0">
            <div className="flex gap-2">
              {activeTab === 'players' && (
                <PlayerFilter filters={playerFilters} onChange={setPlayerFilters} />
              )}
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-7 h-7 text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Entity list - click to add */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex flex-wrap gap-1.5 content-start">
              {filteredDatabaseEntities.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 w-full text-center py-4">
                  No entities found
                </p>
              ) : (
                filteredDatabaseEntities.slice(0, 50).map(entity => (
                  <EntityCard
                    key={entity.id}
                    entity={entity}
                    onClick={() => addToPool(entity)}
                  />
                ))
              )}
            </div>
            {filteredDatabaseEntities.length > 50 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                +{filteredDatabaseEntities.length - 50} more
              </p>
            )}
          </div>
        </div>

        {/* Pool */}
        <div
          className={cn(
            "border rounded-lg overflow-hidden flex flex-col bg-background flex-1",
            dragOverTier === 'pool' && "ring-2 ring-primary"
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverTier('pool')
          }}
          onDragLeave={() => setDragOverTier(null)}
          onDrop={(e) => handleDrop('pool', e)}
        >
          <div className="bg-muted/50 px-3 py-1.5 border-b flex-shrink-0">
            <h3 className="text-sm font-medium">Pool</h3>
            <p className="text-[10px] text-muted-foreground">Drag to tiers</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="flex flex-wrap gap-1.5 content-start">
              {pool.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 w-full text-center py-4">
                  Click entities to add
                </p>
              ) : (
                pool.map(entity => (
                  <EntityCard
                    key={entity.id}
                    entity={entity}
                    onRemove={() => removeFromPool(entity.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content - centered */}
      <div className="flex flex-col items-center pt-6 pb-8 px-4">
        {/* Back button */}
        <div className="w-full max-w-3xl mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Tiers - centered */}
        <div className="w-full max-w-3xl space-y-1.5">
          {/* Title */}
          <div className="flex items-center h-12 mb-1">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setIsEditingTitle(false)
                  }
                }}
                className="text-xl font-bold bg-transparent border-b-2 border-primary outline-none"
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-2"
              >
                <h1 className="text-xl font-bold">{title}</h1>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Tier rows */}
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className={cn(
                "flex border rounded overflow-hidden transition-all",
                dragOverTier === tier.id && "ring-2 ring-primary"
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverTier(tier.id)
              }}
              onDragLeave={() => setDragOverTier(null)}
              onDrop={(e) => handleDrop(tier.id, e)}
            >
              {/* Tier label */}
              <div
                className={cn(
                  "w-14 flex-shrink-0 flex flex-col items-center justify-center cursor-pointer",
                  tier.color
                )}
                onClick={() => changeTierColor(tier.id)}
              >
                {editingTier === tier.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={saveEditingTier}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEditingTier()
                      if (e.key === 'Escape') {
                        setEditingTier(null)
                        setEditLabel('')
                      }
                    }}
                    className="w-10 bg-white/20 text-white text-center text-sm font-bold rounded px-1"
                    maxLength={4}
                  />
                ) : (
                  <span
                    className="text-white text-lg font-bold cursor-text"
                    onDoubleClick={() => startEditingTier(tier.id, tier.label)}
                  >
                    {tier.label}
                  </span>
                )}
              </div>

              {/* Entities area */}
              <div className="flex-1 min-h-[84px] bg-muted/30 p-1.5 flex flex-wrap gap-1.5 items-start content-start">
                {tier.entities.map(entity => (
                  <EntityCard
                    key={entity.id}
                    entity={entity}
                    onRemove={() => removeEntityFromTier(tier.id, entity.id)}
                  />
                ))}
              </div>

              {/* Tier controls */}
              <div className="flex flex-col justify-center gap-0.5 px-1 bg-muted/20">
                <button
                  onClick={() => moveTierUp(index)}
                  disabled={index === 0}
                  className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => startEditingTier(tier.id, tier.label)}
                  className="p-0.5 rounded hover:bg-accent"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveTierDown(index)}
                  disabled={index === tiers.length - 1}
                  className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeTier(tier.id)}
                  className="p-0.5 rounded hover:bg-red-500/20 text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Add tier button */}
          <button
            onClick={addTier}
            className="w-full py-2.5 border-2 border-dashed border-border rounded text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>

          {/* Save button */}
          <div className="flex justify-end pt-4">
            <Button className="px-8">
              Save Tier List
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
