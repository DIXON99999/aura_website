import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { api, type AuraFarm } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Trash2, Sprout } from 'lucide-react'

export function MyAuraFarmsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [farms, setFarms] = useState<AuraFarm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/signin')
      return
    }
    api.getMyAuraFarms()
      .then(setFarms)
      .finally(() => setLoading(false))
  }, [user, navigate])

  const handleDelete = async (farmId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this aura farm?')) return

    await api.deleteAuraFarm(farmId)
    setFarms(farms.filter(f => f.id !== farmId))
  }

  if (!user) return null

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Aura Farms</h1>
          <Link to="/create-aura-farm">
            <Button className="flex items-center gap-2">
              <Sprout className="w-4 h-4" />
              Create Aura Farm
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : farms.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p>You haven't created any aura farms yet</p>
            <Link to="/create-aura-farm">
              <Button className="mt-4">Create Your First Aura Farm</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {farms.map(farm => (
              <Link
                key={farm.id}
                to={`/aura-farms/${farm.slug || farm.id}`}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <span className={`text-sm font-medium ${farm.auraScore > 0 ? 'text-green-500' : farm.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {farm.auraScore.toFixed(0)}
                </span>
                <h2 className="font-medium text-sm line-clamp-1 flex-1">{farm.title}</h2>
                <button
                  onClick={(e) => handleDelete(farm.id, e)}
                  className="p-1 rounded hover:bg-background text-destructive flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
