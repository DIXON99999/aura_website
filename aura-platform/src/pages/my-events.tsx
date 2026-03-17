import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { api, type Event } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Calendar, Lock, Globe, Trash2, Edit2 } from 'lucide-react'

export function MyEventsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/signin')
      return
    }
    api.getMyEvents()
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [user, navigate])

  const handleDelete = async (eventId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this leaderboard?')) return

    await api.deleteEvent(eventId)
    setEvents(events.filter(ev => ev.id !== eventId))
  }

  if (!user) return null

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Custom Leaderboards</h1>
          <Link to="/create-event">
            <Button>Create Leaderboard</Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p>You haven't created any custom leaderboards yet</p>
            <Link to="/create-event">
              <Button className="mt-4">Create Your First Leaderboard</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {events.map(event => (
              <Link
                key={event.id}
                to={`/community/${event.slug}`}
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-medium text-sm">{event.name}</h2>
                      {event.isPublic ? (
                        <Globe className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center">
                      <Link
                        to={`/community/${event.slug}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded hover:bg-background"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={(e) => handleDelete(event.id, e)}
                        className="p-1.5 rounded hover:bg-background text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(event.createdAt).toLocaleDateString()}</span>
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
