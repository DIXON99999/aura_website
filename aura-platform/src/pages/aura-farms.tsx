import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type AuraFarm } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import { useAuraStore } from '@/stores'

function getVisitorId(): string {
  let id = localStorage.getItem('aura_visitor_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('aura_visitor_id', id)
  }
  return id
}

export function AuraFarmsPage() {
  const [farms, setFarms] = useState<AuraFarm[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [votes, setVotes] = useState<Record<string, 'UP' | 'DOWN'>>({})
  const credits = useAuraStore((s) => s.credits)
  const setCredits = useAuraStore((s) => s.setCredits)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      api.getAuraFarms(search || undefined)
        .then(setFarms)
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    // Load votes for all farms
    const loadVotes = async () => {
      const visitorId = getVisitorId()
      const voteMap: Record<string, 'UP' | 'DOWN'> = {}
      for (const farm of farms) {
        try {
          const farmVotes = await api.getAuraFarmVotes(farm.id, visitorId)
          if (farmVotes.length > 0) {
            voteMap[farm.id] = farmVotes[0].direction
          }
        } catch {
          // Ignore
        }
      }
      setVotes(voteMap)
    }
    if (farms.length > 0) {
      loadVotes()
    }
  }, [farms])

  const handleVote = async (farmId: string, direction: 'UP' | 'DOWN', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const visitorId = getVisitorId()
    const currentVote = votes[farmId]

    // Check credits
    if (!currentVote) {
      if (direction === 'UP' && credits.upvotesRemaining <= 0) return
      if (direction === 'DOWN' && credits.downvotesRemaining <= 0) return
    }

    try {
      if (currentVote === direction) {
        // Remove vote
        const result = await api.removeAuraFarmVote(farmId, { visitorId })
        setFarms(farms.map(f => f.id === farmId ? { ...f, auraScore: result.auraScore } : f))
        setVotes(prev => {
          const next = { ...prev }
          delete next[farmId]
          return next
        })
        // Restore credit
        if (direction === 'UP') {
          setCredits({ ...credits, upvotesRemaining: credits.upvotesRemaining + 1 })
        } else {
          setCredits({ ...credits, downvotesRemaining: credits.downvotesRemaining + 1 })
        }
      } else {
        // New vote or change
        const result = await api.voteAuraFarm(farmId, { visitorId, direction })
        setFarms(farms.map(f => f.id === farmId ? { ...f, auraScore: result.auraScore } : f))
        setVotes(prev => ({ ...prev, [farmId]: direction }))
        // Deduct credit
        if (!currentVote) {
          if (direction === 'UP') {
            setCredits({ ...credits, upvotesRemaining: credits.upvotesRemaining - 1 })
          } else {
            setCredits({ ...credits, downvotesRemaining: credits.downvotesRemaining - 1 })
          }
        } else {
          // Changing vote: restore old, deduct new
          if (currentVote === 'UP') {
            setCredits({
              upvotesRemaining: credits.upvotesRemaining + 1,
              downvotesRemaining: credits.downvotesRemaining - 1,
            })
          } else {
            setCredits({
              upvotesRemaining: credits.upvotesRemaining - 1,
              downvotesRemaining: credits.downvotesRemaining + 1,
            })
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Aura Farms</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search aura farms..."
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : farms.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search ? 'No aura farms found' : 'No aura farms yet'}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {farms.map(farm => {
              const currentVote = votes[farm.id]
              return (
                <Link
                  key={farm.id}
                  to={`/aura-farms/${farm.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col items-center">
                    <button
                      onClick={(e) => handleVote(farm.id, 'UP', e)}
                      className={`p-0.5 rounded hover:bg-accent ${currentVote === 'UP' ? 'text-green-500' : 'text-muted-foreground'}`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className={`text-xs font-medium ${farm.auraScore > 0 ? 'text-green-500' : farm.auraScore < 0 ? 'text-red-500' : ''}`}>
                      {farm.auraScore.toFixed(0)}
                    </span>
                    <button
                      onClick={(e) => handleVote(farm.id, 'DOWN', e)}
                      className={`p-0.5 rounded hover:bg-accent ${currentVote === 'DOWN' ? 'text-red-500' : 'text-muted-foreground'}`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-sm line-clamp-2">{farm.title}</h2>
                    {farm.ownerName && (
                      <p className="text-xs text-muted-foreground truncate">by {farm.ownerName}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
