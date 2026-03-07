import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { api, type Entity } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Search, Upload, X, Check } from 'lucide-react'

const ENTITY_TYPES = [
  { value: 'player', label: 'Player' },
  { value: 'team', label: 'Team' },
  { value: 'game', label: 'Game' },
  { value: 'peripheral', label: 'Peripheral' },
  { value: 'brand', label: 'Brand' },
  { value: 'country', label: 'Country' },
  { value: 'region', label: 'Region' },
  { value: 'role', label: 'Role' },
  { value: 'weapon', label: 'Weapon' },
  { value: 'character', label: 'Character' },
]

export function CreateAuraFarmPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [entityType, setEntityType] = useState('player')
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [entities, setEntities] = useState<Entity[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showEntitySearch, setShowEntitySearch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const entityTypeRef = useRef<HTMLDivElement>(null)
  const [showEntityTypeDropdown, setShowEntityTypeDropdown] = useState(false)
  const [entityTypeSearch, setEntityTypeSearch] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/signin')
    }
  }, [user, navigate])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowEntitySearch(false)
      }
      if (entityTypeRef.current && !entityTypeRef.current.contains(event.target as Node)) {
        setShowEntityTypeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    // Load entities based on type
    const loadEntities = async () => {
      try {
        let data: Entity[] = []
        switch (entityType) {
          case 'player':
            data = await api.getPlayers()
            break
          case 'team':
            data = await api.getOrganisationGames()
            break
          case 'organisation':
            data = await api.getOrganisations()
            break
          case 'game':
            data = await api.getGames()
            break
          case 'peripheral':
            data = await api.getPeripherals()
            break
          case 'brand':
            data = await api.getBrands()
            break
          case 'country':
            data = await api.getCountries()
            break
          case 'region':
            data = await api.getRegions()
            break
          case 'role':
            data = await api.getRoles()
            break
          case 'weapon':
            data = await api.getWeapons()
            break
          case 'character':
            data = await api.getCharacters()
            break
        }
        setEntities(data)
      } catch {
        setEntities([])
      }
    }
    loadEntities()
    setSelectedEntity(null)
    setSearchQuery('')
  }, [entityType])

  const filteredEntities = searchQuery
    ? entities.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : entities

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const result = await api.uploadImage(file)
      const fullUrl = result.imageUrl.startsWith('/')
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${result.imageUrl.replace('/api', '')}`
        : result.imageUrl
      setImageUrl(fullUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    if (!selectedEntity) {
      setError('Please select an entity')
      return
    }

    setLoading(true)

    try {
      const farm = await api.createAuraFarm({
        title: title.trim(),
        description: description.trim() || undefined,
        entityId: selectedEntity.id,
        entityType,
        imageUrl: imageUrl.trim() || undefined,
      })
      navigate(`/aura-farms/${farm.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create Aura Farm</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your aura farm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your aura farm (optional)"
              disabled={loading}
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Image</label>
            <div className="flex gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Enter image URL (optional)"
                disabled={loading || uploading}
                className="flex-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
            {imageUrl && (
              <div className="mt-2 relative aspect-video w-full max-w-xs rounded-lg overflow-hidden bg-muted">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entity Type</label>
            <div className="relative" ref={entityTypeRef}>
              <Input
                value={showEntityTypeDropdown ? entityTypeSearch : (ENTITY_TYPES.find(t => t.value === entityType)?.label || '')}
                onChange={(e) => {
                  setEntityTypeSearch(e.target.value)
                  if (!showEntityTypeDropdown) setShowEntityTypeDropdown(true)
                }}
                onFocus={() => setShowEntityTypeDropdown(true)}
                placeholder="Select entity type..."
                disabled={loading}
              />
              {showEntityTypeDropdown && (
                <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-md border bg-card shadow-lg">
                  {ENTITY_TYPES
                    .filter(type => !entityTypeSearch || type.label.toLowerCase().includes(entityTypeSearch.toLowerCase()))
                    .map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          setEntityType(type.value)
                          setEntityTypeSearch('')
                          setShowEntityTypeDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                      >
                        {type.label}
                        {type.value === entityType && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    ))}
                  {ENTITY_TYPES.filter(type => !entityTypeSearch || type.label.toLowerCase().includes(entityTypeSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No entity types found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Select {ENTITY_TYPES.find(t => t.value === entityType)?.label}
            </label>
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={showEntitySearch ? searchQuery : (selectedEntity?.name || '')}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (!showEntitySearch) setShowEntitySearch(true)
                  }}
                  onFocus={() => setShowEntitySearch(true)}
                  placeholder={`Search for a ${entityType}...`}
                  disabled={loading}
                  className="pl-10"
                />
              </div>
              {showEntitySearch && (
                <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-md border bg-card shadow-lg">
                  {filteredEntities.slice(0, 20).map(entity => (
                    <button
                      key={entity.id}
                      type="button"
                      onClick={() => {
                        setSelectedEntity(entity)
                        setSearchQuery('')
                        setShowEntitySearch(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                    >
                      {entity.name}
                      {entity.id === selectedEntity?.id && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                  {filteredEntities.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No {entityType}s found</div>
                  )}
                </div>
              )}
            </div>
            {selectedEntity && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50">
                <span className="text-sm font-medium">{selectedEntity.name}</span>
                <span className="text-xs text-muted-foreground">
                  (Aura: {selectedEntity.auraScore.toFixed(1)})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEntity(null)}
                  className="ml-auto p-1 hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Aura Farm'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
