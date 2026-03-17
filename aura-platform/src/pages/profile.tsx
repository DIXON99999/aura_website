import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, ChevronDown, LogOut, Trash2, Plus, X, Star, Search, Check, XCircle, ExternalLink, Database, MessageSquare, Camera } from 'lucide-react'
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
import { api, type Suggestion, type AuraFarm } from '@/lib/api'
import { EntityCreator } from '@/components/EntityCreator'

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
        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
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
  const [activeTab, setActiveTab] = useState<'associations' | 'farms' | 'suggestions'>('associations')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [farms, setFarms] = useState<AuraFarm[]>([])
  const [farmsLoading, setFarmsLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [entityCreatorOpen, setEntityCreatorOpen] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get profile reactively from store
  const profileId = user ? userProfiles[user.id] : undefined
  const profile = profileId ? players[profileId] : undefined

  useEffect(() => {
    if (user && !profile && !profileError) {
      createUserProfile(user.id).catch((err) => {
        console.error('Failed to create profile:', err)
        setProfileError(err.message || 'Failed to create profile')
      })
    }
  }, [user, profile, createUserProfile, profileError])

  useEffect(() => {
    if (profile?.name) {
      setNameInput(profile.name)
    }
  }, [profile?.name])

  // Check if user is admin
  useEffect(() => {
    if (!user) return
    api.checkAdmin()
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false))
  }, [user])

  // Fetch suggestions when tab is active
  useEffect(() => {
    if (activeTab !== 'suggestions' || !user) return
    setSuggestionsLoading(true)
    api.getSuggestions()
      .then(setSuggestions)
      .catch(console.error)
      .finally(() => setSuggestionsLoading(false))
  }, [activeTab, user])

  // Fetch farms when tab is active
  useEffect(() => {
    if (activeTab !== 'farms' || !user) return
    setFarmsLoading(true)
    api.getMyAuraFarms()
      .then(setFarms)
      .catch(console.error)
      .finally(() => setFarmsLoading(false))
  }, [activeTab, user])

  const handleUpdateSuggestion = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await api.updateSuggestion(id, { status })
      setSuggestions(suggestions.map(s => s.id === id ? { ...s, status } : s))
    } catch (error) {
      console.error('Failed to update suggestion:', error)
    }
  }

  const handleDeleteSuggestion = async (id: string) => {
    try {
      await api.deleteSuggestion(id)
      setSuggestions(suggestions.filter(s => s.id !== id))
    } catch (error) {
      console.error('Failed to delete suggestion:', error)
    }
  }

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
        <h1 className="text-2xl font-bold mb-4">
          {profileError ? 'Profile Error' : 'Creating profile...'}
        </h1>
        {profileError && (
          <div className="space-y-4">
            <p className="text-destructive">{profileError}</p>
            <Button onClick={() => {
              setProfileError(null)
              createUserProfile(user.id).catch((err) => {
                setProfileError(err.message || 'Failed to create profile')
              })
            }}>
              Try Again
            </Button>
          </div>
        )}
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

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const { imageUrl } = await api.uploadImage(file)
      await updateUserProfile(user.id, { imageUrl })
    } catch (error) {
      console.error('Failed to upload profile picture:', error)
    }
    setUploadingImage(false)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleDeleteAccount = async () => {
    await deleteAccount()
    navigate('/')
  }

  const isProfileComplete = profile.name && profile.countryId

  const isEntityAdded = (entity: Entity) => {
    return profile.associatedEntityIds?.includes(entity.id) || false
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEntityCreatorOpen(true)}
              className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 hover:border-purple-500/50"
            >
              <Database className="w-4 h-4 mr-2 text-purple-500" />
              Create Entity
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto flex-1 w-full">
        <div className="flex flex-col items-center text-center">
          <div className="relative group mb-6">
            <div className="w-32 h-32 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
              {profile.imageUrl ? (
                <img
                  src={profile.imageUrl}
                  alt={profile.name || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : profile.name ? (
                <span className="text-4xl font-bold text-muted-foreground">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <span className="text-4xl font-bold text-muted-foreground">?</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-wait"
            >
              {uploadingImage ? (
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-8 h-8 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureChange}
              className="hidden"
            />
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
                      <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
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
                      <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
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

          {/* Bio Section */}
          <div className="w-full max-w-md mt-4">
            <div className="relative">
              <textarea
                value={profile.bio || ''}
                onChange={(e) => updateUserProfile(user.id, { bio: e.target.value })}
                placeholder="Add a bio..."
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm min-h-[60px] resize-none text-center placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={160}
              />
              <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {(profile.bio || '').length}/160
              </span>
            </div>
          </div>

          {!isProfileComplete && (
            <p className="text-sm text-amber-500 mb-4 mt-4">
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
              <button
                onClick={() => setActiveTab('suggestions')}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  activeTab === 'suggestions'
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Suggestions
                {suggestions.filter(s => s.status === 'pending').length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                    {suggestions.filter(s => s.status === 'pending').length}
                  </span>
                )}
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
                                <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                    <div className="space-y-4">
                      {/* Games & Teams */}
                      {associatedEntities.filter(e => e.type === EntityTypes.GAME || e.type === EntityTypes.ORGANISATION_GAME).length > 0 && (
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground mb-2 text-center">Games & Teams</h3>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {associatedEntities.filter(e => e.type === EntityTypes.GAME || e.type === EntityTypes.ORGANISATION_GAME).map(entity => (
                              <MiniCard
                                key={entity.id}
                                entity={entity}
                                onRemove={() => handleRemoveEntity(entity)}
                                isMainGame={entity.type === EntityTypes.GAME && profile.mainGameId === entity.id}
                                onSetMainGame={entity.type === EntityTypes.GAME ? () => handleSetMainGame(entity.id) : undefined}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Peripherals */}
                      {associatedEntities.filter(e => e.type === EntityTypes.PERIPHERAL).length > 0 && (
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground mb-2 text-center">Peripherals</h3>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {associatedEntities.filter(e => e.type === EntityTypes.PERIPHERAL).map(entity => (
                              <MiniCard
                                key={entity.id}
                                entity={entity}
                                onRemove={() => handleRemoveEntity(entity)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Roles, Weapons & Characters */}
                      {associatedEntities.filter(e => e.type === EntityTypes.ROLE || e.type === EntityTypes.WEAPON || e.type === EntityTypes.CHARACTER).length > 0 && (
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground mb-2 text-center">Roles, Weapons & Characters</h3>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {associatedEntities.filter(e => e.type === EntityTypes.ROLE || e.type === EntityTypes.WEAPON || e.type === EntityTypes.CHARACTER).map(entity => (
                              <MiniCard
                                key={entity.id}
                                entity={entity}
                                onRemove={() => handleRemoveEntity(entity)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No associations yet. Click Add to link entities to your profile.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'farms' && (
                <div>
                  {farmsLoading ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Loading posts...</p>
                    </div>
                  ) : farms.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-4">You haven't created any posts yet.</p>
                      <Link to="/create-post">
                        <Button size="sm">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Create Post
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-end mb-2">
                        <Link to="/create-post">
                          <Button size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Post
                          </Button>
                        </Link>
                      </div>
                      {farms.map(farm => (
                        <Link
                          key={farm.id}
                          to={`/posts/${farm.slug || farm.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <span className={cn(
                            'text-sm font-medium tabular-nums min-w-[3rem] text-right',
                            farm.auraScore > 0 ? 'text-green-500' : farm.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'
                          )}>
                            {farm.auraScore.toFixed(0)}
                          </span>
                          <h3 className="font-medium text-sm flex-1 line-clamp-1">{farm.title}</h3>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div>
                  {suggestionsLoading ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Loading suggestions...</p>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No suggestions yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {suggestions.map(suggestion => (
                        <div
                          key={suggestion.id}
                          className={cn(
                            'border rounded-lg p-4',
                            suggestion.status === 'pending' ? 'bg-card' :
                            suggestion.status === 'approved' ? 'bg-green-500/5 border-green-500/20' :
                            'bg-red-500/5 border-red-500/20'
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-accent capitalize">
                                  {suggestion.type}
                                </span>
                                <span className={cn(
                                  'text-xs font-medium px-2 py-0.5 rounded',
                                  suggestion.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                                  suggestion.status === 'approved' ? 'bg-green-500/10 text-green-600' :
                                  'bg-red-500/10 text-red-600'
                                )}>
                                  {suggestion.status}
                                </span>
                              </div>
                              <h3 className="font-semibold">{suggestion.name}</h3>
                              {suggestion.description && (
                                <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                              )}
                              {suggestion.links && (
                                <a
                                  href={suggestion.links.startsWith('http') ? suggestion.links : `https://${suggestion.links}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {suggestion.links}
                                </a>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Submitted {new Date(suggestion.createdAt).toLocaleDateString()}
                                {suggestion.submittedByName && ` by ${suggestion.submittedByName}`}
                              </p>
                            </div>

                            {suggestion.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleUpdateSuggestion(suggestion.id, 'approved')}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleUpdateSuggestion(suggestion.id, 'rejected')}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteSuggestion(suggestion.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}

                            {suggestion.status !== 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteSuggestion(suggestion.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Admin Entity Creator Modal */}
      {isAdmin && (
        <EntityCreator
          open={entityCreatorOpen}
          onOpenChange={setEntityCreatorOpen}
        />
      )}
    </div>
  )
}
