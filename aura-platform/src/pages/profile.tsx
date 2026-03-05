import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, ChevronDown, LogOut, Trash2, Plus, X, Star, Search } from 'lucide-react'
import { useAuraStore, useAuthStore } from '@/stores'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { EntityTypes } from '@/types'
import type { Entity, Country } from '@/types'

function getFlagUrl(countryCode: string): string {
  return `https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`
}

function getEntityUrl(entity: Entity): string {
  const typeMap: Record<string, string> = {
    [EntityTypes.COUNTRY]: 'country',
    [EntityTypes.GAME]: 'game',
    [EntityTypes.ORGANISATION]: 'organisation',
    [EntityTypes.ORGANISATION_GAME]: 'team',
    [EntityTypes.PLAYER]: 'player',
    [EntityTypes.PERIPHERAL]: 'peripheral',
    [EntityTypes.ROLE]: 'role',
    [EntityTypes.WEAPON]: 'weapon',
    [EntityTypes.CHARACTER]: 'character',
    [EntityTypes.BRAND]: 'brand',
  }
  return `/${typeMap[entity.type] || 'entity'}/${entity.slug}`
}

function MiniCard({ entity, onRemove, isMainGame, onSetMainGame }: {
  entity: Entity
  onRemove?: () => void
  isMainGame?: boolean
  onSetMainGame?: () => void
}) {
  const renderImage = () => {
    if (entity.type === EntityTypes.COUNTRY) {
      return (
        <img
          src={`https://flagcdn.com/w40/${(entity as Country).flagCode.toLowerCase()}.png`}
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
          className="w-full h-full object-cover"
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
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card/50 border border-border">
      {entity.type === EntityTypes.GAME && onSetMainGame && (
        <button
          onClick={onSetMainGame}
          className={cn(
            'p-0.5 rounded transition-colors',
            isMainGame ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'
          )}
          title="Set as main game"
        >
          <Star className={cn('w-3 h-3', isMainGame && 'fill-current')} />
        </button>
      )}
      <Link to={getEntityUrl(entity)} className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {renderImage()}
        </div>
        <span className="text-xs font-medium">{entity.name}</span>
      </Link>
      <span className={cn(
        'text-xs tabular-nums',
        entity.auraScore > 0 ? 'text-green-500' : entity.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'
      )}>
        {entity.auraScore}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-0.5 rounded hover:bg-muted transition-colors"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)

  const createUserProfile = useAuraStore((s) => s.createUserProfile)
  const updateUserProfile = useAuraStore((s) => s.updateUserProfile)
  const removeEntity = useAuraStore((s) => s.removeEntity)
  const countries = useAuraStore((s) => s.countries)
  const games = useAuraStore((s) => s.games)
  const regions = useAuraStore((s) => s.regions)
  const organisations = useAuraStore((s) => s.organisations)
  const organisationGames = useAuraStore((s) => s.organisationGames)
  const players = useAuraStore((s) => s.players)
  const peripherals = useAuraStore((s) => s.peripherals)
  const roles = useAuraStore((s) => s.roles)
  const weapons = useAuraStore((s) => s.weapons)
  const characters = useAuraStore((s) => s.characters)
  const userProfiles = useAuraStore((s) => s.userProfiles)

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [countryOpen, setCountryOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')
  const [regionOpen, setRegionOpen] = useState(false)
  const [regionSearch, setRegionSearch] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'associations' | 'farms'>('associations')

  // Get profile reactively from store
  const profileId = user ? userProfiles[user.id] : undefined
  const profile = profileId ? players[profileId] : undefined

  useEffect(() => {
    if (user && !profile) {
      createUserProfile(user.id)
    }
  }, [user, profile, createUserProfile])

  useEffect(() => {
    if (profile?.name) {
      setNameInput(profile.name)
    }
  }, [profile?.name])

  // Allowed entity types for associations: games, weapons, characters, roles, peripherals, esports teams (org games)
  const allowedEntities = useMemo<Entity[]>(() => {
    return [
      ...Object.values(games),
      ...Object.values(organisationGames),
      ...Object.values(peripherals),
      ...Object.values(roles),
      ...Object.values(weapons),
      ...Object.values(characters),
    ]
  }, [games, organisationGames, peripherals, roles, weapons, characters])

  const filteredEntities = useMemo(() => {
    if (!addSearch) return allowedEntities.slice(0, 20)
    const q = addSearch.toLowerCase()
    return allowedEntities.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.aliases?.some(a => a.toLowerCase().includes(q))
    ).slice(0, 20)
  }, [allowedEntities, addSearch])

  // Get all entity by ID helper
  const getEntityById = (id: string): Entity | undefined => {
    return games[id] || organisationGames[id] || peripherals[id] ||
           roles[id] || weapons[id] || characters[id]
  }

  // Get regions filtered by main game (must be before early returns due to hooks rules)
  const regionList = useMemo(() => {
    if (!profile?.mainGameId) return []
    return Object.values(regions).filter(r => r.gameId === profile.mainGameId)
  }, [regions, profile?.mainGameId])

  // Get associated entities from associatedEntityIds (must be before early returns)
  const associatedEntities = useMemo(() => {
    const entities: Entity[] = []
    if (profile?.associatedEntityIds) {
      for (const id of profile.associatedEntityIds) {
        const entity = getEntityById(id)
        if (entity) entities.push(entity)
      }
    }
    return entities
  }, [profile?.associatedEntityIds, games, organisationGames, peripherals, roles, weapons, characters])

  // Redirect to sign in if not authenticated
  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold mb-4">Sign in to view your profile</h1>
        <div className="flex gap-3">
          <Link to="/signin">
            <Button>Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button variant="outline">Create Account</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Creating profile...</h1>
      </div>
    )
  }

  const country = profile.countryId ? countries[profile.countryId] : null
  const countryList = Object.values(countries)
  const filteredCountries = countrySearch
    ? countryList.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : countryList

  const team = profile.organisationId ? organisations[profile.organisationId] : null
  const teamList = Object.values(organisations)
  const filteredTeams = teamSearch
    ? teamList.filter((t) =>
        t.name.toLowerCase().includes(teamSearch.toLowerCase())
      )
    : teamList

  // Region data
  const mainGame = profile.mainGameId ? games[profile.mainGameId] : null
  const region = profile.regionId ? regions[profile.regionId] : null
  const filteredRegions = regionSearch
    ? regionList.filter((r) =>
        r.name.toLowerCase().includes(regionSearch.toLowerCase())
      )
    : regionList

  const handleNameSave = () => {
    if (nameInput.trim()) {
      updateUserProfile(user.id, { name: nameInput.trim() })
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave()
    } else if (e.key === 'Escape') {
      setNameInput(profile.name)
      setIsEditingName(false)
    }
  }

  const handleCountrySelect = (countryId: string) => {
    updateUserProfile(user.id, { countryId })
    setCountryOpen(false)
    setCountrySearch('')
  }

  const handleTeamSelect = (orgId: string | null) => {
    updateUserProfile(user.id, { organisationId: orgId })
    setTeamOpen(false)
    setTeamSearch('')
  }

  const handleRegionSelect = (regionId: string) => {
    updateUserProfile(user.id, { regionId })
    setRegionOpen(false)
    setRegionSearch('')
  }

  const handleAddEntity = (entity: Entity) => {
    const currentIds = profile.associatedEntityIds || []
    if (!currentIds.includes(entity.id)) {
      const newIds = [...currentIds, entity.id]
      const updates: { associatedEntityIds: string[]; mainGameId?: string } = {
        associatedEntityIds: newIds
      }
      // Set as main game if it's a game and no main game is set
      if (entity.type === EntityTypes.GAME && !profile.mainGameId) {
        updates.mainGameId = entity.id
      }
      updateUserProfile(user.id, updates)
    }
    // Keep popover open to allow adding multiple entities
  }

  const handleRemoveEntity = (entity: Entity) => {
    const newIds = (profile.associatedEntityIds || []).filter(id => id !== entity.id)
    const updates: { associatedEntityIds: string[]; mainGameId?: string } = {
      associatedEntityIds: newIds
    }
    // If removing the main game, set a new one
    if (entity.type === EntityTypes.GAME && profile.mainGameId === entity.id) {
      const remainingGames = newIds.filter(id => games[id])
      updates.mainGameId = remainingGames[0] || ''
    }
    updateUserProfile(user.id, updates)
  }

  const handleSetMainGame = (gameId: string) => {
    updateUserProfile(user.id, { mainGameId: gameId })
  }

  const handleSignOut = () => {
    signOut()
    navigate('/')
  }

  const handleDeleteAccount = () => {
    removeEntity('player', profile.id)
    deleteAccount()
    navigate('/')
  }

  const isProfileComplete = profile.name && profile.countryId

  const isEntityAdded = (entity: Entity) => {
    return profile.associatedEntityIds?.includes(entity.id) || false
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="max-w-2xl mx-auto flex-1 w-full">
        <div className="flex flex-col items-center text-center">
          <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center overflow-hidden mb-6">
            {profile.name ? (
              <span className="text-4xl font-bold text-muted-foreground">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <span className="text-4xl font-bold text-muted-foreground">?</span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-4">
            {isEditingName ? (
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                placeholder="Enter username"
                className="text-2xl font-bold text-center h-12 w-64"
                autoFocus
              />
            ) : (
              <>
                <h1 className="text-3xl font-bold">
                  {profile.name || 'Set Username'}
                </h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Pencil className="w-5 h-5 text-muted-foreground" />
                </button>
              </>
            )}

            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  {country ? (
                    <>
                      <img
                        src={getFlagUrl(country.flagCode)}
                        alt={country.name}
                        className="w-6 h-4 object-cover rounded-sm"
                      />
                      <span className="text-sm">{country.name}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select Country</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <Input
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search countries..."
                  className="mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredCountries.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCountrySelect(c.id)}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                        profile.countryId === c.id && 'bg-primary/10'
                      )}
                    >
                      <img
                        src={getFlagUrl(c.flagCode)}
                        alt={c.name}
                        className="w-5 h-4 object-cover rounded-sm"
                      />
                      {c.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={teamOpen} onOpenChange={setTeamOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  {team ? (
                    <>
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {team.imageUrl ? (
                          <img src={team.imageUrl} alt={team.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold">{team.name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-sm">{team.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTeamSelect(null)
                        }}
                        className="p-0.5 rounded hover:bg-muted"
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select Team</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <Input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search teams..."
                  className="mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredTeams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTeamSelect(t.id)}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                        profile.organisationId === t.id && 'bg-primary/10'
                      )}
                    >
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {t.imageUrl ? (
                          <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold">{t.name.charAt(0)}</span>
                        )}
                      </div>
                      {t.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Region selector - only show if main game is set */}
          {mainGame && regionList.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Playing {mainGame.name} from:</span>
              <Popover open={regionOpen} onOpenChange={setRegionOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    {region ? (
                      <span className="text-sm">{region.name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Select Region</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <Input
                    value={regionSearch}
                    onChange={(e) => setRegionSearch(e.target.value)}
                    placeholder="Search regions..."
                    className="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredRegions.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleRegionSelect(r.id)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                          profile.regionId === r.id && 'bg-primary/10'
                        )}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {!isProfileComplete && (
            <p className="text-sm text-amber-500 mb-4">
              Set a username and country to appear on leaderboards
            </p>
          )}

          <div className={cn(
            'text-3xl font-bold tabular-nums mt-4',
            profile.auraScore > 0 ? 'text-green-500' : profile.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'
          )}>
            {profile.auraScore}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Aura Score</p>

          {/* Tabs Section */}
          <div className="w-full mt-8 border-t border-border">
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('associations')}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  activeTab === 'associations'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Associations
              </button>
              <button
                onClick={() => setActiveTab('farms')}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  activeTab === 'farms'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Farms
              </button>
            </div>

            <div className="pt-6">
              {activeTab === 'associations' && (
                <div>
                  <div className="flex justify-end mb-4">
                    <Popover open={addOpen} onOpenChange={setAddOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-3" align="end">
                        <div className="relative mb-3">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            value={addSearch}
                            onChange={(e) => setAddSearch(e.target.value)}
                            placeholder="Search entities..."
                            className="pl-8"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1">
                          {filteredEntities.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2 text-center">No entities found</p>
                          ) : (
                            filteredEntities.map(entity => (
                              <button
                                key={entity.id}
                                onClick={() => handleAddEntity(entity)}
                                disabled={isEntityAdded(entity)}
                                className={cn(
                                  'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                                  isEntityAdded(entity) && 'opacity-50 cursor-not-allowed'
                                )}
                              >
                                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {entity.type === EntityTypes.COUNTRY ? (
                                    <img
                                      src={`https://flagcdn.com/w40/${(entity as Country).flagCode.toLowerCase()}.png`}
                                      alt={entity.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : entity.imageUrl ? (
                                    <img src={entity.imageUrl} alt={entity.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs font-bold">{entity.name.charAt(0)}</span>
                                  )}
                                </div>
                                <span className="truncate">{entity.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground capitalize">
                                  {entity.type}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {associatedEntities.length > 0 ? (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {associatedEntities.map(entity => (
                        <MiniCard
                          key={entity.id}
                          entity={entity}
                          onRemove={() => handleRemoveEntity(entity)}
                          isMainGame={entity.type === EntityTypes.GAME && profile.mainGameId === entity.id}
                          onSetMainGame={entity.type === EntityTypes.GAME ? () => handleSetMainGame(entity.id) : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No associations yet. Click Add to link entities to your profile.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'farms' && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Coming soon...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-auto pt-8">
        {showDeleteConfirm ? (
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Confirm Delete
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        )}
      </div>
    </div>
  )
}
