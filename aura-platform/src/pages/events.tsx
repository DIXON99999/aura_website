import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type Event } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Search, Calendar } from 'lucide-react'

export function EventsPage() {
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
        <h1 className="text-2xl font-bold mb-6">Public Events</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search ? 'No events found' : 'No public events yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="block p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-medium">{event.name}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(event.createdAt).toLocaleDateString()}</span>
                    </div>
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
