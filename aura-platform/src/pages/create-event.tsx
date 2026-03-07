import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { api, type Entity } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, Search, UserPlus, Check, Upload, Link as LinkIcon } from 'lucide-react'

interface Participant {
  type: 'player' | 'temp'
  playerId?: string
  playerName?: string
  tempName?: string
}

export function CreateEventPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [gameId, setGameId] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [games, setGames] = useState<Entity[]>([])
  const [players, setPlayers] = useState<Entity[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [gameSearchQuery, setGameSearchQuery] = useState('')
  const [tempNameInput, setTempNameInput] = useState('')
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)
  const [showGameSearch, setShowGameSearch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const gameSearchRef = useRef<HTMLDivElement>(null)
  const playerSearchRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const result = await api.uploadImage(file)
      // Convert relative URL to full URL for preview
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

  useEffect(() => {
    if (!user) {
      navigate('/signin')
      return
    }
    api.getGames().then(setGames)
  }, [user, navigate])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (gameSearchRef.current && !gameSearchRef.current.contains(event.target as Node)) {
        setShowGameSearch(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (searchQuery.length >= 2) {
      api.getPlayers().then(allPlayers => {
        const filtered = allPlayers.filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        setPlayers(filtered.slice(0, 10))
      })
    } else {
      setPlayers([])
    }
  }, [searchQuery])

  const filteredGames = gameSearchQuery
    ? games.filter(g => g.name.toLowerCase().includes(gameSearchQuery.toLowerCase()))
    : games

  const selectedGame = games.find(g => g.id === gameId)

  const addPlayer = (player: Entity) => {
    if (participants.some(p => p.playerId === player.id)) return
    setParticipants([...participants, {
      type: 'player',
      playerId: player.id,
      playerName: player.name,
    }])
    // Keep search open, just clear and refocus
    setSearchQuery('')
    setPlayers([])
    playerSearchRef.current?.focus()
  }

  const addTempName = () => {
    if (!tempNameInput.trim()) return
    setParticipants([...participants, {
      type: 'temp',
      tempName: tempNameInput.trim(),
    }])
    setTempNameInput('')
  }

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Leaderboard name is required')
      return
    }

    if (!gameId) {
      setError('Please select a game')
      return
    }

    if (participants.length === 0) {
      setError('Add at least one participant')
      return
    }

    setLoading(true)

    try {
      const event = await api.createEvent({
        name: name.trim(),
        gameId,
        isPublic,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        participants: participants.map(p =>
          p.type === 'player'
            ? { playerId: p.playerId }
            : { tempName: p.tempName }
        ),
      })
      navigate(`/events/${event.id}`)
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
        <h1 className="text-2xl font-bold mb-6">Create Custom Leaderboard</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Leaderboard Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter leaderboard name"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your leaderboard (optional)"
              disabled={loading}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Cover Image</label>
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
            <p className="text-xs text-muted-foreground mt-1">
              Upload an image or paste a URL. Max 5MB (JPEG, PNG, GIF, WebP)
            </p>
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
            <label className="block text-sm font-medium mb-2">Game</label>
            <div className="relative" ref={gameSearchRef}>
              <Input
                value={showGameSearch ? gameSearchQuery : (selectedGame?.name || '')}
                onChange={(e) => {
                  setGameSearchQuery(e.target.value)
                  if (!showGameSearch) setShowGameSearch(true)
                }}
                onFocus={() => setShowGameSearch(true)}
                placeholder="Search for a game..."
                disabled={loading}
              />
              {showGameSearch && (
                <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-md border bg-card shadow-lg">
                  {filteredGames.map(game => (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => {
                        setGameId(game.id)
                        setGameSearchQuery('')
                        setShowGameSearch(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                    >
                      {game.name}
                      {game.id === gameId && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                  {filteredGames.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No games found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4"
                disabled={loading}
              />
              <span className="text-sm">Make this leaderboard public</span>
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Public leaderboards can be found and viewed by anyone
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Participants</label>

            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPlayerSearch(!showPlayerSearch)}
                className="flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Add Player
              </Button>
            </div>

            {showPlayerSearch && (
              <div className="mb-4 p-4 border rounded-lg bg-card">
                <Input
                  ref={playerSearchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a player..."
                  className="mb-2"
                  autoFocus
                />
                {players.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {players.map(player => {
                      const alreadyAdded = participants.some(p => p.playerId === player.id)
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => addPlayer(player)}
                          disabled={alreadyAdded}
                          className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                            alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'
                          }`}
                        >
                          {player.name}
                          {alreadyAdded && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                )}
                {searchQuery.length >= 2 && players.length === 0 && (
                  <div className="text-sm text-muted-foreground">No players found</div>
                )}
              </div>
            )}

            <div className="flex gap-2 mb-4 max-w-xs">
              <Input
                value={tempNameInput}
                onChange={(e) => setTempNameInput(e.target.value)}
                placeholder="Temp name"
                className="h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTempName()
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTempName}>
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>

            {participants.length > 0 && (
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/50"
                  >
                    <span className="text-sm">
                      {p.type === 'player' ? p.playerName : p.tempName}
                      {p.type === 'temp' && (
                        <span className="text-xs text-muted-foreground ml-2">(temp)</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeParticipant(i)}
                      className="p-1 hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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
              {loading ? 'Creating...' : 'Create Leaderboard'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
