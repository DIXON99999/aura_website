import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Event } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores'
import { Search, Calendar, UserPlus } from 'lucide-react'

export function EventsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [events, setEvents] = useState<Event[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [joiningEvent, setJoiningEvent] = useState<string | null>(null)
  const [joinedEvents, setJoinedEvents] = useState<Set<string>>(new Set())
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      api.getPublicEvents(search || undefined)
        .then(setEvents)
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [search])

  const handleJoin = async (e: React.MouseEvent, eventSlug: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user?.playerId) {
      navigate('/profile')
      return
    }

    setJoiningEvent(eventSlug)
    setJoinError(null)
    try {
      await api.joinEvent(eventSlug)
      setJoinedEvents(prev => new Set(prev).add(eventSlug))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join'
      if (message.includes('already')) {
        setJoinedEvents(prev => new Set(prev).add(eventSlug))
      } else {
        setJoinError(message)
        setTimeout(() => setJoinError(null), 3000)
      }
    } finally {
      setJoiningEvent(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Centered Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Community</h1>
          <p className="text-muted-foreground">Join leaderboards and compete with others</p>
        </div>

        {/* Centered Search Bar */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leaderboards..."
              className="pl-10"
            />
          </div>
        </div>

        {!user && (
          <div className="mb-6 p-3 rounded-lg bg-accent/50 text-sm text-muted-foreground text-center max-w-md mx-auto">
            <Link to="/signup" className="text-primary hover:underline">Sign in</Link> to create your own leaderboards and join them
          </div>
        )}

        {joinError && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center max-w-md mx-auto">
            {joinError}
          </div>
        )}

        {/* Leaderboards - Centered */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-semibold">Leaderboards</h2>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search ? 'No leaderboards found' : 'No public leaderboards yet'}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {events.map(event => (
              <Link
                key={event.id}
                to={`/community/${event.slug}`}
                className="w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)] max-w-[280px] rounded-lg border bg-card hover:bg-accent/50 transition-colors overflow-hidden"
              >
                {event.imageUrl && (
                  <div className="aspect-[3/2] w-full overflow-hidden bg-muted">
                    <img
                      src={event.imageUrl}
                      alt={event.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-3">
                  <h2 className="font-medium text-sm">{event.name}</h2>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(event.createdAt).toLocaleDateString()}</span>
                      {event.ownerName && (
                        <span className="ml-1">by {event.ownerName}</span>
                      )}
                    </div>
                    {user && event.ownerId !== user.id && !joinedEvents.has(event.slug) && (
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => handleJoin(e, event.slug)}
                        disabled={joiningEvent === event.slug}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        {joiningEvent === event.slug ? '...' : 'Join'}
                      </Button>
                    )}
                    {joinedEvents.has(event.slug) && (
                      <span className="text-xs text-green-600">Joined</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
