import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type AuraFarm } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VoteButtons } from '@/components/ui/vote-buttons'
import { Search, ChevronDown, Play } from 'lucide-react'
import { useAuraStore, useAuthStore, hasPerkEquipped } from '@/stores'

// Helper to check if URL is a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm']
  const lowerUrl = url.toLowerCase()
  return videoExtensions.some(ext => lowerUrl.includes(ext))
}

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
  const [sort, setSort] = useState<'new' | 'popular' | 'oldest'>('new')
  const [sortOpen, setSortOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)
  const credits = useAuraStore((s) => s.credits)
  const setCredits = useAuraStore((s) => s.setCredits)
  const sortLabels: Record<'new' | 'popular' | 'oldest', string> = {
    new: 'New',
    popular: 'Most Popular',
    oldest: 'Oldest',
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      api.getAuraFarms(search || undefined, sort)
        .then(setFarms)
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [search, sort])

  const handleVote = async (farmId: string, direction: 'UP' | 'DOWN') => {
    // Check credits
    if (direction === 'UP' && credits.upvotesRemaining <= 0) return
    if (direction === 'DOWN' && credits.downvotesRemaining <= 0) return

    // Check for double-click perk (only for upvotes)
    const hasDoubleClick = direction === 'UP' && hasPerkEquipped('double-click')
    const voteMultiplier = hasDoubleClick ? 2 : 1

    const visitorId = getVisitorId()

    try {
      // Call API multiple times for double-click perk
      let result
      for (let i = 0; i < voteMultiplier; i++) {
        result = await api.voteAuraFarm(farmId, { visitorId, direction })
      }

      if (result) {
        setFarms(farms.map(f => f.id === farmId ? { ...f, auraScore: result.auraScore } : f))
      }

      // Deduct credit (only 1 credit regardless of multiplier)
      if (direction === 'UP') {
        setCredits({ ...credits, upvotesRemaining: credits.upvotesRemaining - 1 })
      } else {
        setCredits({ ...credits, downvotesRemaining: credits.downvotesRemaining - 1 })
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

        <div className="mb-6">
          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                Sort: {sortLabels[sort]}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              {(['new', 'popular', 'oldest'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSort(option)
                    setSortOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${sort === option ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {!user && (
          <div className="mb-6 p-3 rounded-lg bg-accent/50 text-sm text-muted-foreground text-center">
            <Link to="/login" className="text-primary hover:underline">Sign in</Link> to create your own posts
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : farms.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search ? 'No aura farms found' : 'No aura farms yet'}
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3">
            {farms.map(farm => (
              <Link
                key={farm.id}
                to={`/aura-farms/${farm.slug || farm.id}`}
                className="block mb-3 break-inside-avoid rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 overflow-hidden hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
              >
                {farm.imageUrl && (
                  <div className="relative w-full">
                    {isVideoUrl(farm.imageUrl) ? (
                      <>
                        <video
                          src={farm.imageUrl}
                          className="w-full h-auto object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                            <Play className="w-6 h-6 text-white ml-1" fill="white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img
                        src={farm.imageUrl}
                        alt={farm.title}
                        className="w-full h-auto object-cover"
                      />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 p-2">
                  <VoteButtons
                    score={farm.auraScore}
                    onVote={(dir) => handleVote(farm.id, dir)}
                    upDisabled={credits.upvotesRemaining <= 0}
                    downDisabled={credits.downvotesRemaining <= 0}
                    size="sm"
                    layout="vertical"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-sm line-clamp-2">{farm.title}</h2>
                    <p className="text-xs text-muted-foreground truncate">
                      {farm.ownerName && <>by {farm.ownerName} · </>}
                      {new Date(farm.createdAt).toLocaleDateString()}
                    </p>
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
