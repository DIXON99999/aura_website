import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, type AuraFarm } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChevronUp, ChevronDown, Trash2, ArrowLeft, ExternalLink, Edit2, Save, X, Upload } from 'lucide-react'
import { useAuthStore, useAuraStore } from '@/stores'

function getVisitorId(): string {
  let id = localStorage.getItem('aura_visitor_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('aura_visitor_id', id)
  }
  return id
}

export function AuraFarmPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const credits = useAuraStore((s) => s.credits)
  const setCredits = useAuraStore((s) => s.setCredits)
  const [farm, setFarm] = useState<AuraFarm | null>(null)
  const [loading, setLoading] = useState(true)
  const [vote, setVote] = useState<'UP' | 'DOWN' | null>(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return

    const loadFarm = async () => {
      try {
        const farmData = await api.getAuraFarm(id)
        setFarm(farmData)

        const visitorId = getVisitorId()
        const votes = await api.getAuraFarmVotes(id, visitorId)
        if (votes.length > 0) {
          setVote(votes[0].direction)
        }
      } catch {
        navigate('/aura-farms')
      } finally {
        setLoading(false)
      }
    }

    loadFarm()
  }, [id, navigate])

  const handleVote = async (direction: 'UP' | 'DOWN') => {
    if (!farm) return

    const visitorId = getVisitorId()

    // Check credits
    if (!vote) {
      if (direction === 'UP' && credits.upvotesRemaining <= 0) return
      if (direction === 'DOWN' && credits.downvotesRemaining <= 0) return
    }

    try {
      if (vote === direction) {
        // Remove vote
        const result = await api.removeAuraFarmVote(farm.id, { visitorId })
        setFarm({ ...farm, auraScore: result.auraScore })
        setVote(null)
        // Restore credit
        if (direction === 'UP') {
          setCredits({ ...credits, upvotesRemaining: credits.upvotesRemaining + 1 })
        } else {
          setCredits({ ...credits, downvotesRemaining: credits.downvotesRemaining + 1 })
        }
      } else {
        // New vote or change
        const result = await api.voteAuraFarm(farm.id, { visitorId, direction })
        setFarm({ ...farm, auraScore: result.auraScore })
        // Deduct credit
        if (!vote) {
          if (direction === 'UP') {
            setCredits({ ...credits, upvotesRemaining: credits.upvotesRemaining - 1 })
          } else {
            setCredits({ ...credits, downvotesRemaining: credits.downvotesRemaining - 1 })
          }
        } else {
          // Changing vote
          if (vote === 'UP') {
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
        setVote(direction)
      }
    } catch {
      // Ignore
    }
  }

  const handleDelete = async () => {
    if (!farm || !confirm('Are you sure you want to delete this aura farm?')) return

    try {
      await api.deleteAuraFarm(farm.id)
      navigate('/aura-farms')
    } catch {
      // Ignore
    }
  }

  const startEditing = () => {
    if (!farm) return
    setEditTitle(farm.title)
    setEditDescription(farm.description || '')
    setEditImageUrl(farm.imageUrl || '')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditImageUrl('')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await api.uploadImage(file)
      const fullUrl = result.imageUrl.startsWith('/')
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${result.imageUrl.replace('/api', '')}`
        : result.imageUrl
      setEditImageUrl(fullUrl)
    } catch {
      // Ignore
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    if (!farm || !editTitle.trim()) return

    setSaving(true)
    try {
      const updated = await api.updateAuraFarm(farm.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        imageUrl: editImageUrl.trim() || undefined,
      })
      setFarm(updated)
      setEditing(false)
    } catch {
      // Ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!farm) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Aura farm not found</div>
      </div>
    )
  }

  const isOwner = user && user.id === farm.ownerId

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/aura-farms')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Aura Farms
        </button>

        <div className="rounded-lg border bg-card overflow-hidden">
          {editing ? (
            <div className="p-4 bg-muted/30 border-b">
              <label className="block text-sm font-medium mb-2">Image</label>
              <div className="flex gap-2">
                <Input
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="Enter image URL (optional)"
                  disabled={saving || uploading}
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
                  disabled={saving || uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
              {editImageUrl && (
                <div className="mt-3 relative aspect-video w-full max-w-sm rounded-lg overflow-hidden bg-muted">
                  <img
                    src={editImageUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl('')}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : farm.imageUrl && (
            <div className="aspect-video w-full overflow-hidden bg-muted flex items-center justify-center">
              <img
                src={farm.imageUrl}
                alt={farm.title}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          <div className="p-6">
            {/* Entity card with voting */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => handleVote('UP')}
                  disabled={!vote && credits.upvotesRemaining <= 0}
                  className={`p-2 rounded-lg hover:bg-accent transition-colors ${vote === 'UP' ? 'text-green-500 bg-green-500/10' : 'text-muted-foreground'} disabled:opacity-50`}
                >
                  <ChevronUp className="w-6 h-6" />
                </button>
                <span className={`text-xl font-bold ${farm.auraScore > 0 ? 'text-green-500' : farm.auraScore < 0 ? 'text-red-500' : ''}`}>
                  {farm.auraScore.toFixed(0)}
                </span>
                <button
                  onClick={() => handleVote('DOWN')}
                  disabled={!vote && credits.downvotesRemaining <= 0}
                  className={`p-2 rounded-lg hover:bg-accent transition-colors ${vote === 'DOWN' ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground'} disabled:opacity-50`}
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>

              {farm.entity && (
                <Link
                  to={`/${farm.entityType}/${farm.entity.slug}`}
                  className="flex-1 flex items-center gap-3 p-3 rounded-lg border bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  {farm.entity.imageUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={farm.entity.imageUrl}
                        alt={farm.entity.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{farm.entity.name}</div>
                    <div className={`text-sm ${farm.entity.auraScore > 0 ? 'text-green-500' : farm.entity.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {farm.entity.auraScore > 0 ? '+' : ''}{farm.entity.auraScore.toFixed(0)} aura
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </Link>
              )}
            </div>

            {/* Title */}
            <div className="mt-6">
              {editing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  className="text-xl font-bold"
                  disabled={saving}
                />
              ) : (
                <h1 className="text-2xl font-bold">{farm.title}</h1>
              )}
            </div>

            {/* Description */}
            <div className="mt-4">
              {editing ? (
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={4}
                  disabled={saving}
                />
              ) : (
                farm.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {farm.description}
                  </p>
                )
              )}
            </div>

            {/* Edit actions */}
            {editing && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !editTitle.trim()}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Meta info, edit, and delete */}
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <div>Created {new Date(farm.createdAt).toLocaleDateString()}</div>
                {farm.ownerName && (
                  <div className="mt-0.5">By {farm.ownerName}</div>
                )}
              </div>
              {isOwner && !editing && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditing}
                    className="flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
