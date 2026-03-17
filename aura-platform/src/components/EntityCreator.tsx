import { useState, useMemo } from 'react'
import { X, Plus, Upload, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuraStore } from '@/stores'

type EntityType =
  | 'country'
  | 'game'
  | 'region'
  | 'organisation'
  | 'organisationGame'
  | 'brand'
  | 'peripheral'
  | 'role'
  | 'weapon'
  | 'character'
  | 'player'

interface EntityCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ENTITY_TYPES: { value: EntityType; label: string; description: string }[] = [
  { value: 'player', label: 'Player', description: 'Pro player or content creator' },
  { value: 'country', label: 'Country', description: 'Nation with flag code' },
  { value: 'game', label: 'Game', description: 'Video game title' },
  { value: 'region', label: 'Region', description: 'Game-specific region (e.g., NA, EU)' },
  { value: 'organisation', label: 'Organisation', description: 'Esports org or company' },
  { value: 'organisationGame', label: 'Team', description: 'Org team for specific game' },
  { value: 'brand', label: 'Brand', description: 'Peripheral/hardware brand' },
  { value: 'peripheral', label: 'Peripheral', description: 'Mouse, keyboard, etc.' },
  { value: 'role', label: 'Role', description: 'Game-specific role (e.g., Duelist)' },
  { value: 'weapon', label: 'Weapon', description: 'Game-specific weapon' },
  { value: 'character', label: 'Character', description: 'Game-specific character/agent' },
]

const GAME_TYPES = ['FPS', 'MOBA', 'FIGHTING', 'CARD', 'BATTLE_ROYALE', 'SPORTS', 'OTHER']
const PERIPHERAL_TYPES = ['MOUSE', 'KEYBOARD', 'HEADSET', 'MONITOR', 'MOUSEPAD', 'CONTROLLER']

export function EntityCreator({ open, onOpenChange }: EntityCreatorProps) {
  const [entityType, setEntityType] = useState<EntityType>('player')
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [aliases, setAliases] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Type-specific fields
  const [flagCode, setFlagCode] = useState('')
  const [gameType, setGameType] = useState('FPS')
  const [gameId, setGameId] = useState('')
  const [organisationId, setOrganisationId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [peripheralType, setPeripheralType] = useState('MOUSE')
  const [countryId, setCountryId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [associatedEntityIds, setAssociatedEntityIds] = useState<string[]>([])

  // Dropdown search states
  const [gameSearch, setGameSearch] = useState('')
  const [orgSearch, setOrgSearch] = useState('')
  const [brandSearch, setBrandSearch] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [regionSearch, setRegionSearch] = useState('')

  // Store data
  const games = useAuraStore((s) => s.games)
  const organisations = useAuraStore((s) => s.organisations)
  const brands = useAuraStore((s) => s.brands)
  const countries = useAuraStore((s) => s.countries)
  const regions = useAuraStore((s) => s.regions)
  const fetchAllData = useAuraStore((s) => s.fetchAllData)

  const gameList = useMemo(() => Object.values(games), [games])
  const orgList = useMemo(() => Object.values(organisations), [organisations])
  const brandList = useMemo(() => Object.values(brands), [brands])
  const countryList = useMemo(() => Object.values(countries), [countries])
  const regionList = useMemo(() => {
    if (!gameId) return []
    return Object.values(regions).filter(r => r.gameId === gameId)
  }, [regions, gameId])

  const filteredGames = useMemo(() => {
    if (!gameSearch) return gameList.slice(0, 10)
    return gameList.filter(g => g.name.toLowerCase().includes(gameSearch.toLowerCase())).slice(0, 10)
  }, [gameList, gameSearch])

  const filteredOrgs = useMemo(() => {
    if (!orgSearch) return orgList.slice(0, 10)
    return orgList.filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase())).slice(0, 10)
  }, [orgList, orgSearch])

  const filteredBrands = useMemo(() => {
    if (!brandSearch) return brandList.slice(0, 10)
    return brandList.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).slice(0, 10)
  }, [brandList, brandSearch])

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return countryList.slice(0, 10)
    return countryList.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).slice(0, 10)
  }, [countryList, countrySearch])

  const filteredRegions = useMemo(() => {
    if (!regionSearch) return regionList.slice(0, 10)
    return regionList.filter(r => r.name.toLowerCase().includes(regionSearch.toLowerCase())).slice(0, 10)
  }, [regionList, regionSearch])

  const resetForm = (clearMessages = true) => {
    setName('')
    setImageUrl('')
    setAliases('')
    setFlagCode('')
    setGameType('FPS')
    setGameId('')
    setOrganisationId('')
    setBrandId('')
    setPeripheralType('MOUSE')
    setCountryId('')
    setRegionId('')
    setAssociatedEntityIds([])
    if (clearMessages) {
      setError(null)
      setSuccess(null)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await api.uploadImage(file)
      setImageUrl(result.imageUrl)
    } catch (err) {
      setError('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const aliasArray = aliases.split(',').map(a => a.trim()).filter(Boolean)

      switch (entityType) {
        case 'country':
          if (!flagCode.trim()) {
            setError('Flag code is required')
            setSaving(false)
            return
          }
          await api.adminCreateCountry({ name, flagCode, imageUrl, aliases: aliasArray })
          break
        case 'game':
          await api.adminCreateGame({ name, gameType, imageUrl, aliases: aliasArray })
          break
        case 'region':
          if (!gameId) {
            setError('Game is required')
            setSaving(false)
            return
          }
          await api.adminCreateRegion({ name, gameId, imageUrl, aliases: aliasArray })
          break
        case 'organisation':
          await api.adminCreateOrganisation({ name, imageUrl, aliases: aliasArray })
          break
        case 'organisationGame':
          if (!organisationId || !gameId) {
            setError('Organisation and Game are required')
            setSaving(false)
            return
          }
          await api.adminCreateOrganisationGame({ name, organisationId, gameId, imageUrl, aliases: aliasArray })
          break
        case 'brand':
          await api.adminCreateBrand({ name, imageUrl, aliases: aliasArray })
          break
        case 'peripheral':
          if (!brandId) {
            setError('Brand is required')
            setSaving(false)
            return
          }
          await api.adminCreatePeripheral({ name, peripheralType, brandId, imageUrl, aliases: aliasArray })
          break
        case 'role':
          if (!gameId) {
            setError('Game is required')
            setSaving(false)
            return
          }
          await api.adminCreateRole({ name, gameId, imageUrl, aliases: aliasArray })
          break
        case 'weapon':
          if (!gameId) {
            setError('Game is required')
            setSaving(false)
            return
          }
          await api.adminCreateWeapon({ name, gameId, imageUrl, aliases: aliasArray })
          break
        case 'character':
          if (!gameId) {
            setError('Game is required')
            setSaving(false)
            return
          }
          await api.adminCreateCharacter({ name, gameId, imageUrl, aliases: aliasArray })
          break
        case 'player':
          await api.adminCreatePlayer({
            name,
            countryId: countryId || undefined,
            organisationId: organisationId || undefined,
            mainGameId: gameId || undefined,
            regionId: regionId || undefined,
            imageUrl,
            aliases: aliasArray,
            associatedEntityIds,
          })
          break
      }

      const createdName = name // Save before reset
      resetForm(false) // Don't clear messages
      setSuccess(`${ENTITY_TYPES.find(t => t.value === entityType)?.label} "${createdName}" created successfully!`)
      // Set initialized to false to force refetch
      useAuraStore.setState({ initialized: false })
      fetchAllData()
    } catch (err) {
      setError((err as Error).message || 'Failed to create entity')
    } finally {
      setSaving(false)
    }
  }

  const selectedGame = gameId ? games[gameId] : null
  const selectedOrg = organisationId ? organisations[organisationId] : null
  const selectedBrand = brandId ? brands[brandId] : null
  const selectedCountry = countryId ? countries[countryId] : null
  const selectedRegion = regionId ? regions[regionId] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Entity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Entity Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Entity Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ENTITY_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => {
                    resetForm()
                    setEntityType(type.value)
                  }}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm border transition-colors text-left',
                    entityType === type.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-medium">{type.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {ENTITY_TYPES.find(t => t.value === entityType)?.description}
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..."
            />
          </div>

          {/* Country-specific: Flag Code */}
          {entityType === 'country' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Flag Code * (ISO 3166-1 alpha-2)</label>
              <Input
                value={flagCode}
                onChange={(e) => setFlagCode(e.target.value.toUpperCase())}
                placeholder="e.g., US, GB, JP"
                maxLength={2}
              />
              {flagCode && (
                <img
                  src={`https://flagcdn.com/w40/${flagCode.toLowerCase()}.png`}
                  alt="Flag preview"
                  className="w-10 h-7 object-cover rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
            </div>
          )}

          {/* Game-specific: Game Type */}
          {entityType === 'game' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Game Type</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              >
                {GAME_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          )}

          {/* Peripheral-specific: Type */}
          {entityType === 'peripheral' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Peripheral Type</label>
              <select
                value={peripheralType}
                onChange={(e) => setPeripheralType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              >
                {PERIPHERAL_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          )}

          {/* Game selector for region, role, weapon, character, organisationGame, player */}
          {['region', 'role', 'weapon', 'character', 'organisationGame', 'player'].includes(entityType) && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Game {entityType !== 'player' && '*'}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    {selectedGame ? (
                      <span>{selectedGame.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select game...</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <Input
                    value={gameSearch}
                    onChange={(e) => setGameSearch(e.target.value)}
                    placeholder="Search games..."
                    className="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredGames.map(game => (
                      <button
                        key={game.id}
                        onClick={() => {
                          setGameId(game.id)
                          setRegionId('') // Reset region when game changes
                        }}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                          gameId === game.id && 'bg-primary/10'
                        )}
                      >
                        {game.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Organisation selector for organisationGame and player */}
          {['organisationGame', 'player'].includes(entityType) && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Organisation {entityType === 'organisationGame' && '*'}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    {selectedOrg ? (
                      <span>{selectedOrg.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select organisation...</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <Input
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    placeholder="Search organisations..."
                    className="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredOrgs.map(org => (
                      <button
                        key={org.id}
                        onClick={() => setOrganisationId(org.id)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                          organisationId === org.id && 'bg-primary/10'
                        )}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Brand selector for peripheral */}
          {entityType === 'peripheral' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    {selectedBrand ? (
                      <span>{selectedBrand.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select brand...</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <Input
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    placeholder="Search brands..."
                    className="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredBrands.map(brand => (
                      <button
                        key={brand.id}
                        onClick={() => setBrandId(brand.id)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                          brandId === brand.id && 'bg-primary/10'
                        )}
                      >
                        {brand.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Country selector for player */}
          {entityType === 'player' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Country</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    {selectedCountry ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://flagcdn.com/w20/${selectedCountry.flagCode.toLowerCase()}.png`}
                          alt={selectedCountry.name}
                          className="w-5 h-4 object-cover rounded-sm"
                        />
                        <span>{selectedCountry.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select country...</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <Input
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search countries..."
                    className="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredCountries.map(country => (
                      <button
                        key={country.id}
                        onClick={() => setCountryId(country.id)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                          countryId === country.id && 'bg-primary/10'
                        )}
                      >
                        <img
                          src={`https://flagcdn.com/w20/${country.flagCode.toLowerCase()}.png`}
                          alt={country.name}
                          className="w-5 h-4 object-cover rounded-sm"
                        />
                        {country.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Region selector for player (only if game selected) */}
          {entityType === 'player' && gameId && regionList.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Region</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    {selectedRegion ? (
                      <span>{selectedRegion.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select region...</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <Input
                    value={regionSearch}
                    onChange={(e) => setRegionSearch(e.target.value)}
                    placeholder="Search regions..."
                    className="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredRegions.map(region => (
                      <button
                        key={region.id}
                        onClick={() => setRegionId(region.id)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                          regionId === region.id && 'bg-primary/10'
                        )}
                      >
                        {region.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Image</label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setImageUrl('')}
                    className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Upload image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Aliases */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Aliases (comma-separated)</label>
            <Input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g., alias1, alias2, alias3"
            />
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-green-500/10 text-green-600 text-sm">
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1"
            >
              {saving ? 'Creating...' : 'Create Entity'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
