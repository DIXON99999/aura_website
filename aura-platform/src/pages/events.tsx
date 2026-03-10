import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type Event } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores'
import { Search, Calendar } from 'lucide-react'

export function EventsPage() {
  const user = useAuthStore((s) => s.user)
  const [events, setEvents] = useState<Event[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      api.getPublicEvents(search || undefined)
        .then(setEvents)
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [search])

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Custom Leaderboards</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leaderboards..."
            className="pl-10"
          />
        </div>

        {!user && (
          <div className="mb-6 p-3 rounded-lg bg-accent/50 text-sm text-muted-foreground text-center">
            <Link to="/login" className="text-primary hover:underline">Sign in</Link> for infinite tokens
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search ? 'No leaderboards found' : 'No public leaderboards yet'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {events.map(event => (
              <Link
                key={event.id}
                to={`/events/${event.slug}`}
                className="block rounded-lg border bg-card hover:bg-accent/50 transition-colors overflow-hidden"
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
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(event.createdAt).toLocaleDateString()}</span>
                    {event.ownerName && (
                      <span className="ml-1">by {event.ownerName}</span>
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
