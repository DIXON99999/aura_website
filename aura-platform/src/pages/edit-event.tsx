import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { api, type EventWithParticipants, type Entity } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Search, UserPlus, Save, Check } from 'lucide-react'

export function EditEventPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [event, setEvent] = useState<EventWithParticipants | null>(null)
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [players, setPlayers] = useState<Entity[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [tempNameInput, setTempNameInput] = useState('')
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const playerSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) {
      navigate('/signin')
      return
    }
    if (!id) return

    api.getEvent(id)
      .then(eventData => {
        if (eventData.ownerId !== user.id) {
          navigate('/my-events')
          return
        }
        setEvent(eventData)
        setName(eventData.name)
        setIsPublic(eventData.isPublic)
      })
      .catch(() => navigate('/my-events'))
      .finally(() => setLoading(false))
  }, [id, user, navigate])

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

  const addPlayer = async (player: Entity) => {
    if (!event) return
    if (event.participants.some(p => p.playerId === player.id)) return

    try {
      const participant = await api.addEventParticipant(event.id, { playerId: player.id })
      setEvent({
        ...event,
        participants: [...event.participants, {
          ...participant,
          player: {
            id: player.id,
            name: player.name,
            slug: player.slug,
            globalAuraScore: player.auraScore,
          },
        }],
      })
      // Keep search open, clear and refocus
      setSearchQuery('')
      setPlayers([])
      playerSearchRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const addTempName = async () => {
    if (!event || !tempNameInput.trim()) return

    try {
      const participant = await api.addEventParticipant(event.id, { tempName: tempNameInput.trim() })
      setEvent({
        ...event,
        participants: [...event.participants, participant],
      })
      setTempNameInput('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const removeParticipant = async (participantId: string) => {
    if (!event) return

    try {
      await api.removeEventParticipant(event.id, participantId)
      setEvent({
        ...event,
        participants: event.participants.filter(p => p.id !== participantId),
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleSave = async () => {
    if (!event) return
    setSaving(true)
    setError('')

    try {
      await api.updateEvent(event.id, { name, isPublic })
      navigate(`/events/${event.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Event not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Edit Event</h1>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Event Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter event name"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Make this event public</span>
            </label>
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
                      const alreadyAdded = event?.participants.some(p => p.playerId === player.id)
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

            {event.participants.length > 0 && (
              <div className="space-y-2">
                {event.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/50"
                  >
                    <div>
                      <span className="text-sm">
                        {p.player?.name || p.tempName}
                        {!p.player && (
                          <span className="text-xs text-muted-foreground ml-2">(temp)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        Score: {p.auraScore.toFixed(1)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
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
              onClick={() => navigate(`/events/${event.id}`)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
