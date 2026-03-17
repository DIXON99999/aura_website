import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { api, type AuraFarm, type AuraFarmComment } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { VoteButtons } from '@/components/ui/vote-buttons'
import { CommentVotes } from '@/components/ui/comment-votes'
import { MentionText } from '@/components/ui/mention-text'
import { MentionInput } from '@/components/ui/mention-input'
import { MediaUpload } from '@/components/ui/media-upload'
import { Trash2, ArrowLeft, ExternalLink, Edit2, Save, X, MessageSquare, Image, Link as LinkIcon } from 'lucide-react'
import { useAuthStore, useAuraStore, hasPerkEquipped } from '@/stores'

// Helper to convert name to slug
function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Helper to check if URL is a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm']
  const lowerUrl = url.toLowerCase()
  return videoExtensions.some(ext => lowerUrl.includes(ext))
}

// Helper to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

// Comment Component with replies - Modern Reddit style
function CommentItem({
  comment,
  allComments,
  visitorId,
  currentUserId,
  commentVotes,
  replyingTo,
  replyContent,
  replyImageUrl,
  onVote,
  onReply,
  onReplyContentChange,
  onReplyImageChange,
  onSubmitReply,
  onCancelReply,
  onDelete,
  depth = 0,
}: {
  comment: AuraFarmComment
  allComments: AuraFarmComment[]
  visitorId: string
  currentUserId?: string
  commentVotes: Map<string, 'UP' | 'DOWN'>
  replyingTo: string | null
  replyContent: string
  replyImageUrl: string
  onVote: (commentId: string, direction: 'UP' | 'DOWN') => void
  onReply: (parentId: string) => void
  onReplyContentChange: (content: string) => void
  onReplyImageChange: (url: string) => void
  onSubmitReply: (parentId: string) => void
  onCancelReply: () => void
  onDelete: (commentId: string) => void
  depth?: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const replies = allComments.filter(c => c.parentId === comment.id)
  const vote = commentVotes.get(comment.id)
  const canDelete = comment.userId
    ? comment.userId === currentUserId
    : comment.visitorId === visitorId
  const isReplying = replyingTo === comment.id
  const replyFileInputRef = useRef<HTMLInputElement>(null)

  const handleReplyImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      onReplyImageChange(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const avatarColor = comment.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360

  return (
    <div id={`comment-${comment.id}`} className={depth > 0 ? 'pl-4 border-l-2 border-border/60 hover:border-border ml-3' : ''}>
      <div className="py-2">
        {/* Header with avatar */}
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: `hsl(${avatarColor}, 50%, 50%)` }}
          >
            {comment.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Link
              to={`/player/${nameToSlug(comment.username)}`}
              className="font-medium text-foreground hover:underline hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {comment.username}
            </Link>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                className="text-primary text-xs ml-1 hover:underline"
              >
                expand
              </button>
            )}
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Content */}
            {comment.content && (
              <p className="text-sm leading-relaxed mb-2 pl-8">
                <MentionText content={comment.content} />
              </p>
            )}

            {/* Image/GIF */}
            {comment.imageUrl && (
              <div className="mb-2 pl-8">
                <img
                  src={comment.imageUrl}
                  alt="Comment media"
                  className="rounded-lg max-h-96 max-w-full object-contain cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => window.open(comment.imageUrl!, '_blank')}
                />
              </div>
            )}

            {/* Actions bar - Modern Reddit style */}
            <div className="flex items-center gap-0.5 pl-8 text-muted-foreground">
              {/* Votes */}
              <CommentVotes
                score={comment.voteCount}
                currentVote={vote}
                onVote={(dir) => onVote(comment.id, dir)}
              />

              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-accent rounded-full transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Reply
              </button>

              <button
                onClick={() => setCollapsed(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-accent rounded-full transition-colors"
              >
                Collapse
              </button>

              {canDelete && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>

            {/* Reply input - Modern style */}
            {isReplying && (
              <div className="mt-3 pl-8">
                <div className="border rounded-xl bg-card">
                  {replyImageUrl && (
                    <div className="p-3 border-b bg-accent/30">
                      <div className="relative inline-block">
                        <img src={replyImageUrl} alt="Reply preview" className="max-h-32 rounded-lg" />
                        <button
                          onClick={() => onReplyImageChange('')}
                          className="absolute -top-2 -right-2 p-1 bg-foreground text-background rounded-full hover:bg-foreground/80"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  {showImageInput && (
                    <div className="p-3 border-b bg-accent/30 flex gap-2">
                      <Input
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="Paste image or GIF URL..."
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (imageUrlInput.trim()) {
                            onReplyImageChange(imageUrlInput.trim())
                            setImageUrlInput('')
                            setShowImageInput(false)
                          }
                        }}
                      >
                        Add
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowImageInput(false); setImageUrlInput('') }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <MentionInput
                    value={replyContent}
                    onChange={onReplyContentChange}
                    onSubmit={() => onSubmitReply(comment.id)}
                    placeholder="What are your thoughts? (type @ to mention)"
                    autoFocus
                    rows={1}
                  />
                  <div className="flex items-center justify-between px-2 py-2 border-t bg-accent/20">
                    <div className="flex items-center gap-1">
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        accept="image/*,image/gif"
                        onChange={handleReplyImageUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => replyFileInputRef.current?.click()}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
                        title="Upload image"
                      >
                        <Image className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowImageInput(!showImageInput)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
                        title="Add image URL"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={onCancelReply}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => onSubmitReply(comment.id)}
                        disabled={!replyContent.trim() && !replyImageUrl}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Replies */}
            {replies.length > 0 && (
              <div className="mt-2">
                {replies.map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    allComments={allComments}
                    visitorId={visitorId}
                    currentUserId={currentUserId}
                    commentVotes={commentVotes}
                    replyingTo={replyingTo}
                    replyContent={replyContent}
                    replyImageUrl={replyImageUrl}
                    onVote={onVote}
                    onReply={onReply}
                    onReplyContentChange={onReplyContentChange}
                    onReplyImageChange={onReplyImageChange}
                    onSubmitReply={onSubmitReply}
                    onCancelReply={onCancelReply}
                    onDelete={onDelete}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function getVisitorId(): string {
  let id = localStorage.getItem('aura_visitor_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('aura_visitor_id', id)
  }
  return id
}

export function AuraFarmPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const userProfiles = useAuraStore((s) => s.userProfiles)
  const players = useAuraStore((s) => s.players)
  const credits = useAuraStore((s) => s.credits)
  const setCredits = useAuraStore((s) => s.setCredits)
  const [farm, setFarm] = useState<AuraFarm | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // Comments state
  const [comments, setComments] = useState<AuraFarmComment[]>([])
  const [commentVotes, setCommentVotes] = useState<Map<string, 'UP' | 'DOWN'>>(new Map())
  const [commentSort, setCommentSort] = useState<'best' | 'new' | 'old'>('best')
  const [newComment, setNewComment] = useState('')
  const [newCommentImage, setNewCommentImage] = useState('')
  const [showCommentImageUrl, setShowCommentImageUrl] = useState(false)
  const [commentImageUrlInput, setCommentImageUrlInput] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyImageUrl, setReplyImageUrl] = useState('')
  const commentFileInputRef = useRef<HTMLInputElement>(null)

  function getUsername(): string {
    if (user) {
      const profileId = userProfiles[user.id]
      const profile = profileId ? players[profileId] : null
      if (profile?.name) {
        return profile.name
      }
    }
    return localStorage.getItem('aura_username') || 'Anonymous'
  }

  useEffect(() => {
    if (!slug) return

    const loadFarm = async () => {
      try {
        const farmData = await api.getAuraFarm(slug)
        setFarm(farmData)
      } catch {
        navigate('/posts')
      } finally {
        setLoading(false)
      }
    }

    loadFarm()
  }, [slug, navigate])

  // Load comments when farm is loaded
  useEffect(() => {
    if (!slug || !farm) return

    const loadComments = async () => {
      try {
        const commentsData = await api.getAuraFarmComments(farm.id)
        setComments(commentsData)

        const visitorId = getVisitorId()
        const votes = await api.getAuraFarmCommentVotes(farm.id, visitorId)
        const votesMap = new Map<string, 'UP' | 'DOWN'>()
        for (const vote of votes) {
          votesMap.set(vote.commentId, vote.direction)
        }
        setCommentVotes(votesMap)
      } catch {
        // Ignore
      }
    }

    loadComments()
  }, [slug, farm])

  // Scroll to comment if hash is present
  useEffect(() => {
    if (location.hash && comments.length > 0) {
      const element = document.getElementById(location.hash.slice(1))
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('bg-primary/10')
          setTimeout(() => element.classList.remove('bg-primary/10'), 2000)
        }, 100)
      }
    }
  }, [location.hash, comments])

  const handleVote = async (direction: 'UP' | 'DOWN') => {
    if (!farm) return

    // Check credits
    if (direction === 'UP' && credits.upvotesRemaining <= 0) return
    if (direction === 'DOWN' && credits.downvotesRemaining <= 0) return

    // Check for double-click perk (only for upvotes)
    const hasDoubleClick = direction === 'UP' && hasPerkEquipped('double-click')
    const voteMultiplier = hasDoubleClick ? 2 : 1
    console.log('Aura farm vote - hasDoubleClick:', hasDoubleClick, 'multiplier:', voteMultiplier)

    const visitorId = getVisitorId()

    try {
      // Call API multiple times for double-click perk
      let result
      for (let i = 0; i < voteMultiplier; i++) {
        console.log('Calling vote API, iteration:', i + 1)
        result = await api.voteAuraFarm(farm.id, { visitorId, direction, userId: user?.id })
      }

      if (result) {
        setFarm({ ...farm, auraScore: result.auraScore })
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

  const handleDelete = async () => {
    if (!farm || !confirm('Are you sure you want to delete this aura farm?')) return

    try {
      await api.deleteAuraFarm(farm.id)
      navigate('/posts')
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

  const handleAddComment = async (parentId?: string) => {
    if (!farm) return

    const content = parentId ? replyContent : newComment
    const imageUrl = parentId ? replyImageUrl : newCommentImage
    if (!content.trim() && !imageUrl) return

    try {
      const visitorId = getVisitorId()
      const comment = await api.addAuraFarmComment(farm.id, {
        visitorId,
        content: content.trim(),
        username: getUsername(),
        parentId,
        imageUrl: imageUrl || undefined,
        userId: user?.id,
      })
      setComments([...comments, comment])
      if (parentId) {
        setReplyingTo(null)
        setReplyContent('')
        setReplyImageUrl('')
      } else {
        setNewComment('')
        setNewCommentImage('')
      }
    } catch {
      // Ignore
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!farm) return

    try {
      const visitorId = getVisitorId()
      await api.deleteAuraFarmComment(farm.id, commentId, { visitorId, userId: user?.id })
      // Remove comment and all its replies
      const idsToRemove = new Set<string>([commentId])
      const findReplies = (parentId: string) => {
        comments
          .filter(c => c.parentId === parentId)
          .forEach(c => {
            idsToRemove.add(c.id)
            findReplies(c.id)
          })
      }
      findReplies(commentId)
      setComments(comments.filter((c) => !idsToRemove.has(c.id)))
    } catch {
      // Ignore
    }
  }

  const handleCommentVote = async (commentId: string, direction: 'UP' | 'DOWN') => {
    if (!farm) return

    const visitorId = getVisitorId()
    const currentVote = commentVotes.get(commentId)

    try {
      console.log('Voting on comment:', commentId, direction)
      const result = await api.voteAuraFarmComment(farm.id, commentId, { visitorId, direction })
      console.log('Vote result:', result)

      // Use functional update to avoid stale state
      setComments(prev => prev.map((c) => c.id === commentId ? { ...c, voteCount: result.voteCount } : c))

      const newVotes = new Map(commentVotes)
      if (currentVote === direction) {
        newVotes.delete(commentId)
      } else {
        newVotes.set(commentId, direction)
      }
      setCommentVotes(newVotes)
    } catch (err) {
      console.error('Vote failed:', err)
    }
  }

  const handleCommentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setNewCommentImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const topLevelComments = comments.filter(c => !c.parentId).sort((a, b) => {
    if (commentSort === 'best') return b.voteCount - a.voteCount
    if (commentSort === 'new') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() // old
  })

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
          onClick={() => navigate('/posts')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Aura Farms
        </button>

        <div className="rounded-lg border bg-card overflow-hidden">
          {editing ? (
            <div className="p-4 bg-muted/30 border-b">
              <label className="block text-sm font-medium mb-2">Image or Clip</label>
              <MediaUpload
                value={editImageUrl}
                onChange={setEditImageUrl}
                disabled={saving}
              />
            </div>
          ) : farm.imageUrl && (
            <div className="aspect-video w-full overflow-hidden bg-muted flex items-center justify-center">
              {isVideoUrl(farm.imageUrl) ? (
                <video
                  src={farm.imageUrl}
                  controls
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <img
                  src={farm.imageUrl}
                  alt={farm.title}
                  className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(farm.imageUrl!, '_blank')}
                  title="Click to view full size"
                />
              )}
            </div>
          )}

          <div className="p-6">
            {/* Entity card with voting */}
            <div className="flex items-center gap-4">
              <VoteButtons
                score={farm.auraScore}
                onVote={handleVote}
                upDisabled={credits.upvotesRemaining <= 0}
                downDisabled={credits.downvotesRemaining <= 0}
                size="md"
                layout="vertical"
              />

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

        {/* Comments Section - Reddit Style */}
        <div className="mt-8 rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {comments.length} Comments
            </h2>
          </div>

          {/* Modern Reddit-style Comment Input */}
          <div className="mb-6 border rounded-xl bg-card">
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              onSubmit={() => handleAddComment()}
              placeholder="Add a comment (type @ to mention users)"
              rows={1}
              className="px-4 py-3"
            />

            {/* Image URL Input */}
            {showCommentImageUrl && (
              <div className="px-3 py-2 border-t bg-accent/20 flex gap-2">
                <Input
                  value={commentImageUrlInput}
                  onChange={(e) => setCommentImageUrlInput(e.target.value)}
                  placeholder="Paste image or GIF URL..."
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (commentImageUrlInput.trim()) {
                      setNewCommentImage(commentImageUrlInput.trim())
                      setCommentImageUrlInput('')
                      setShowCommentImageUrl(false)
                    }
                  }}
                >
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowCommentImageUrl(false); setCommentImageUrlInput('') }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Image Preview */}
            {newCommentImage && (
              <div className="px-4 py-2 border-t bg-accent/20">
                <div className="relative inline-block">
                  <img src={newCommentImage} alt="Comment preview" className="max-h-32 rounded-lg" />
                  <button
                    onClick={() => setNewCommentImage('')}
                    className="absolute -top-2 -right-2 p-1 bg-foreground text-background rounded-full hover:bg-foreground/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-2 py-1.5 border-t bg-accent/10">
              <div className="flex items-center gap-0.5">
                <input
                  ref={commentFileInputRef}
                  type="file"
                  accept="image/*,image/gif"
                  onChange={handleCommentImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => commentFileInputRef.current?.click()}
                  className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  title="Upload image"
                >
                  <Image className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowCommentImageUrl(!showCommentImageUrl)}
                  className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  title="Add image URL"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
              </div>
              <Button
                onClick={() => handleAddComment()}
                disabled={!newComment.trim() && !newCommentImage}
                size="sm"
                className="rounded-full px-4"
              >
                Comment
              </Button>
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <div className="flex rounded-lg border bg-accent/30 overflow-hidden">
              {(['best', 'new', 'old'] as const).map((sort) => (
                <button
                  key={sort}
                  onClick={() => setCommentSort(sort)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    commentSort === sort
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Comments List - Reddit Style */}
          {topLevelComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            <div className="space-y-2">
              {topLevelComments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                  visitorId={getVisitorId()}
                  currentUserId={user?.id}
                  commentVotes={commentVotes}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  replyImageUrl={replyImageUrl}
                  onVote={handleCommentVote}
                  onReply={setReplyingTo}
                  onReplyContentChange={setReplyContent}
                  onReplyImageChange={setReplyImageUrl}
                  onSubmitReply={handleAddComment}
                  onCancelReply={() => { setReplyingTo(null); setReplyContent(''); setReplyImageUrl('') }}
                  onDelete={handleDeleteComment}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
