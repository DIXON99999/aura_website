import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, type EventWithParticipants, type SubEvent, type SubEventWithParticipants, type SubEventComment } from '@/lib/api'
import { useAuthStore, useAuraStore, hasPerkEquipped } from '@/stores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VoteButtons } from '@/components/ui/vote-buttons'
import { CommentVotes } from '@/components/ui/comment-votes'
import { MentionText } from '@/components/ui/mention-text'
import { MentionInput } from '@/components/ui/mention-input'
import { MediaUpload } from '@/components/ui/media-upload'
import { Lock, Globe, Edit2, Plus, ArrowLeft, Check, Search, Trash2, X, MessageSquare, Link as LinkIcon, Image, Play } from 'lucide-react'

function getVisitorId(): string {
  let id = localStorage.getItem('aura_visitor_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('aura_visitor_id', id)
  }
  return id
}

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

// Confirmation Dialog Component
function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-card border rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
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
  isOwner,
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
  comment: SubEventComment
  allComments: SubEventComment[]
  visitorId: string
  currentUserId?: string
  isOwner: boolean
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
    <div className={depth > 0 ? 'pl-4 border-l-2 border-border/60 hover:border-border ml-3' : ''}>
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
                      isOwner={isOwner}
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

export function EventPage() {
  const { id, subEventId } = useParams<{ id: string; subEventId?: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const userProfiles = useAuraStore((s) => s.userProfiles)
  const players = useAuraStore((s) => s.players)
  const credits = useAuraStore((s) => s.credits)
  const setCredits = useAuraStore((s) => s.setCredits)
  const [event, setEvent] = useState<EventWithParticipants | null>(null)
  const [votes, setVotes] = useState<Map<string, 'UP' | 'DOWN'>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Sub-events state
  const [subEvents, setSubEvents] = useState<SubEvent[]>([])
  const [selectedSubEvent, setSelectedSubEvent] = useState<SubEventWithParticipants | null>(null)
  const [, setSubEventVotes] = useState<Map<string, 'UP' | 'DOWN'>>(new Map())
  const [showCreateSubEvent, setShowCreateSubEvent] = useState(false)
  const [newSubEventName, setNewSubEventName] = useState('')
  const [newSubEventImage, setNewSubEventImage] = useState('')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
  const [creatingSubEvent, setCreatingSubEvent] = useState(false)
  const [participantSearch, setParticipantSearch] = useState('')
  const [subEventError, setSubEventError] = useState('')
  const [subEventSearch, setSubEventSearch] = useState('')
  const [subEventSort, setSubEventSort] = useState<'newest' | 'oldest'>('newest')

  // Edit sub-event state
  const [editingSubEvent, setEditingSubEvent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editParticipantIds, setEditParticipantIds] = useState<string[]>([])
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editParticipantSearch, setEditParticipantSearch] = useState('')

  // Leaderboard search state
  const [leaderboardSearch, setLeaderboardSearch] = useState('')

  // Comments state
  const [newComment, setNewComment] = useState('')
  const [newCommentImage, setNewCommentImage] = useState('')
  const [showCommentImageUrl, setShowCommentImageUrl] = useState(false)
  const [commentImageUrlInput, setCommentImageUrlInput] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyImageUrl, setReplyImageUrl] = useState('')
  const [commentVotes, setCommentVotes] = useState<Map<string, 'UP' | 'DOWN'>>(new Map())
  const [commentSort, setCommentSort] = useState<'best' | 'new' | 'old'>('best')
  const commentFileInputRef = useRef<HTMLInputElement>(null)

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; subEventId: string | null }>({ open: false, subEventId: null })

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const visitorId = getVisitorId()
  const isOwner = user?.id === event?.ownerId

  // Get username from user's profile
  const getUsername = () => {
    if (user) {
      const profileId = userProfiles[user.id]
      const profile = profileId ? players[profileId] : null
      if (profile?.name) {
        return profile.name
      }
    }
    const storedUsername = localStorage.getItem('aura_username')
    if (storedUsername) return storedUsername
    return 'Anonymous'
  }

  useEffect(() => {
    if (!id) return

    Promise.all([
      api.getEvent(id),
      api.getEventVotes(id, visitorId),
      api.getSubEvents(id),
    ])
      .then(([eventData, votesData, subEventsData]) => {
        setEvent(eventData)
        const votesMap = new Map<string, 'UP' | 'DOWN'>()
        votesData.forEach(v => votesMap.set(v.participantId, v.direction))
        setVotes(votesMap)
        setSubEvents(subEventsData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, visitorId])

  // Load sub-event from URL parameter
  useEffect(() => {
    if (subEventId && id && !loading) {
      loadSubEvent(subEventId)
    } else if (!subEventId) {
      setSelectedSubEvent(null)
    }
  }, [subEventId, id, loading])

  const loadSubEvent = async (subEventIdToLoad: string) => {
    if (!id) return
    try {
      const [subEventData, votesData, commentVotesData] = await Promise.all([
        api.getSubEvent(id, subEventIdToLoad),
        api.getSubEventVotes(id, subEventIdToLoad, visitorId),
        api.getCommentVotes(id, subEventIdToLoad, visitorId),
      ])
      setSelectedSubEvent(subEventData)
      setEditName(subEventData.name)
      setEditImageUrl(subEventData.imageUrl || '')
      setEditParticipantIds(subEventData.participants.map(p => p.leaderboardParticipantId))
      const votesMap = new Map<string, 'UP' | 'DOWN'>()
      votesData.forEach(v => votesMap.set(v.participantId, v.direction))
      setSubEventVotes(votesMap)
      const commentVotesMap = new Map<string, 'UP' | 'DOWN'>()
      commentVotesData.forEach(v => commentVotesMap.set(v.commentId, v.direction))
      setCommentVotes(commentVotesMap)
      setEditingSubEvent(false)
      setLeaderboardSearch('')
    } catch (err) {
      console.error('Failed to load sub-event:', err)
    }
  }

  const handleVote = async (participantId: string, direction: 'UP' | 'DOWN') => {
    if (!event) return

    const currentVote = votes.get(participantId)

    try {
      if (currentVote === direction) {
        const result = await api.removeEventVote(event.id, { visitorId, participantId })
        const newVotes = new Map(votes)
        newVotes.delete(participantId)
        setVotes(newVotes)
        setEvent({
          ...event,
          participants: event.participants.map(p =>
            p.id === participantId ? { ...p, auraScore: result.auraScore } : p
          ).sort((a, b) => b.auraScore - a.auraScore),
        })
      } else {
        const result = await api.voteEventParticipant(event.id, { visitorId, participantId, direction, userId: user?.id })
        setVotes(new Map(votes).set(participantId, direction))
        setEvent({
          ...event,
          participants: event.participants.map(p =>
            p.id === participantId ? { ...p, auraScore: result.auraScore } : p
          ).sort((a, b) => b.auraScore - a.auraScore),
        })
        // Update credits from response
        if ((result as any).credits) {
          setCredits((result as any).credits)
        }
      }
    } catch (err) {
      console.error('Vote failed:', err)
    }
  }

  const handleSubEventVote = async (participantId: string, direction: 'UP' | 'DOWN') => {
    if (!id || !selectedSubEvent) return

    // Check credits
    if (direction === 'UP' && credits.upvotesRemaining <= 0) return
    if (direction === 'DOWN' && credits.downvotesRemaining <= 0) return

    // Check for double-click perk (only for upvotes)
    const hasDoubleClick = direction === 'UP' && hasPerkEquipped('double-click')
    const voteMultiplier = hasDoubleClick ? 2 : 1

    try {
      // Call API multiple times for double-click perk
      let result
      for (let i = 0; i < voteMultiplier; i++) {
        result = await api.voteSubEventParticipant(id, selectedSubEvent.id, { visitorId, participantId, direction, userId: user?.id })
      }

      if (result) {
        setSelectedSubEvent({
          ...selectedSubEvent,
          participants: selectedSubEvent.participants.map(p =>
            p.id === participantId ? { ...p, auraScore: result.auraScore } : p
          ).sort((a, b) => b.auraScore - a.auraScore),
        })

        // Update credits from response
        if ((result as any).credits) {
          setCredits((result as any).credits)
        }
      }

      const updatedEvent = await api.getEvent(id)
      setEvent(updatedEvent)
    } catch (err) {
      console.error('Sub-event vote failed:', err)
    }
  }

  const handleCreateSubEvent = async () => {
    if (!id || !newSubEventName.trim() || selectedParticipantIds.length === 0) return

    setCreatingSubEvent(true)
    setSubEventError('')
    try {
      const newSubEvent = await api.createSubEvent(id, {
        name: newSubEventName.trim(),
        participantIds: selectedParticipantIds,
        imageUrl: newSubEventImage || undefined,
      })
      setSubEvents([newSubEvent, ...subEvents])
      setNewSubEventName('')
      setNewSubEventImage('')
      setSelectedParticipantIds([])
      setShowCreateSubEvent(false)
      setParticipantSearch('')
      navigate(`/events/${id}/sub/${newSubEvent.id}`)
    } catch (err) {
      console.error('Failed to create sub-event:', err)
      setSubEventError((err as Error).message || 'Failed to create sub-event')
    } finally {
      setCreatingSubEvent(false)
    }
  }

  const handleDeleteSubEvent = async () => {
    if (!id || !confirmDialog.subEventId) return

    try {
      await api.deleteSubEvent(id, confirmDialog.subEventId)
      setSubEvents(subEvents.filter(se => se.id !== confirmDialog.subEventId))
      if (selectedSubEvent?.id === confirmDialog.subEventId) {
        navigate(`/events/${id}`)
      }
      const updatedEvent = await api.getEvent(id)
      setEvent(updatedEvent)
    } catch (err) {
      console.error('Failed to delete sub-event:', err)
    } finally {
      setConfirmDialog({ open: false, subEventId: null })
    }
  }

  const handleSaveSubEventEdit = async () => {
    if (!id || !selectedSubEvent) return

    try {
      // Update name and image (send null explicitly to clear image)
      await api.updateSubEvent(id, selectedSubEvent.id, {
        imageUrl: editImageUrl || undefined,
        name: editName.trim() || undefined,
      })

      // Update sub-events list with new name
      setSubEvents(subEvents.map(se =>
        se.id === selectedSubEvent.id ? { ...se, name: editName.trim(), imageUrl: editImageUrl || null } : se
      ))

      // Reload sub-event
      await loadSubEvent(selectedSubEvent.id)
      setEditingSubEvent(false)
    } catch (err) {
      console.error('Failed to save sub-event:', err)
    }
  }

  const handleAddParticipantToSubEvent = async (leaderboardParticipantId: string) => {
    if (!id || !selectedSubEvent) return

    try {
      const newParticipant = await api.addSubEventParticipant(id, selectedSubEvent.id, { leaderboardParticipantId })
      setEditParticipantIds([...editParticipantIds, leaderboardParticipantId])
      // Update selected sub-event with new participant
      setSelectedSubEvent({
        ...selectedSubEvent,
        participants: [...selectedSubEvent.participants, newParticipant].sort((a, b) => b.auraScore - a.auraScore),
      })
    } catch (err) {
      console.error('Failed to add participant:', err)
    }
  }

  const handleRemoveParticipantFromSubEvent = async (leaderboardParticipantId: string) => {
    if (!id || !selectedSubEvent) return

    // Find the sub-event participant id from the leaderboard participant id
    const subEventParticipant = selectedSubEvent.participants.find(
      p => p.leaderboardParticipantId === leaderboardParticipantId
    )
    if (!subEventParticipant) return

    try {
      await api.removeSubEventParticipant(id, selectedSubEvent.id, subEventParticipant.id)
      setEditParticipantIds(editParticipantIds.filter(pid => pid !== leaderboardParticipantId))
      // Update selected sub-event by removing participant
      setSelectedSubEvent({
        ...selectedSubEvent,
        participants: selectedSubEvent.participants.filter(p => p.id !== subEventParticipant.id),
      })
    } catch (err) {
      console.error('Failed to remove participant:', err)
    }
  }

  const handleCommentVote = async (commentId: string, direction: 'UP' | 'DOWN') => {
    if (!id || !selectedSubEvent) return

    const currentVote = commentVotes.get(commentId)

    try {
      console.log('Voting on comment:', commentId, direction)
      const result = await api.voteComment(id, selectedSubEvent.id, commentId, { visitorId, direction })
      console.log('Vote result:', result)

      // Update the comment's vote count using functional update to avoid stale state
      setSelectedSubEvent(prev => {
        if (!prev) return prev
        return {
          ...prev,
          comments: prev.comments.map(c =>
            c.id === commentId ? { ...c, voteCount: result.voteCount } : c
          ),
        }
      })

      // Update vote tracking
      const newVotes = new Map(commentVotes)
      if (currentVote === direction) {
        newVotes.delete(commentId)
      } else {
        newVotes.set(commentId, direction)
      }
      setCommentVotes(newVotes)
    } catch (err) {
      console.error('Failed to vote on comment:', err)
    }
  }

  const handleAddComment = async (parentId?: string) => {
    if (!id || !selectedSubEvent) return

    const content = parentId ? replyContent : newComment
    const imageUrl = parentId ? replyImageUrl : newCommentImage
    if (!content.trim() && !imageUrl) return

    try {
      const comment = await api.addSubEventComment(id, selectedSubEvent.id, {
        visitorId,
        content: content.trim(),
        username: getUsername(),
        parentId,
        imageUrl: imageUrl || undefined,
        userId: user?.id, // Include userId if signed in
      })
      setSelectedSubEvent({
        ...selectedSubEvent,
        comments: [...selectedSubEvent.comments, comment],
      })
      if (parentId) {
        setReplyContent('')
        setReplyImageUrl('')
        setReplyingTo(null)
      } else {
        setNewComment('')
        setNewCommentImage('')
      }
    } catch (err) {
      console.error('Failed to add comment:', err)
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

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !selectedSubEvent) return

    try {
      await api.deleteSubEventComment(id, selectedSubEvent.id, commentId, { visitorId, userId: user?.id })
      const idsToRemove = new Set<string>([commentId])
      const findReplies = (parentId: string) => {
        selectedSubEvent.comments
          .filter(c => c.parentId === parentId)
          .forEach(c => {
            idsToRemove.add(c.id)
            findReplies(c.id)
          })
      }
      findReplies(commentId)

      setSelectedSubEvent({
        ...selectedSubEvent,
        comments: selectedSubEvent.comments.filter(c => !idsToRemove.has(c.id)),
      })
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  const toggleParticipantSelection = (participantId: string, isEdit = false) => {
    const ids = isEdit ? editParticipantIds : selectedParticipantIds
    const setIds = isEdit ? setEditParticipantIds : setSelectedParticipantIds

    if (ids.includes(participantId)) {
      setIds(ids.filter(id => id !== participantId))
    } else {
      setIds([...ids, participantId])
    }
  }

  const addAllParticipants = () => {
    if (!event) return
    setSelectedParticipantIds(event.participants.map(p => p.id))
  }

  const filteredParticipants = event?.participants.filter(p => {
    const name = p.player?.name || p.tempName || ''
    return name.toLowerCase().includes(participantSearch.toLowerCase())
  }) || []

  const editFilteredParticipants = event?.participants.filter(p => {
    const name = p.player?.name || p.tempName || ''
    return name.toLowerCase().includes(editParticipantSearch.toLowerCase())
  }) || []

  const topLevelComments = (selectedSubEvent?.comments.filter(c => !c.parentId) || []).sort((a, b) => {
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

  if (error || !event) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{error || 'Event not found'}</p>
          <Link to="/events" className="text-primary hover:underline mt-2 block">
            Back to events
          </Link>
        </div>
      </div>
    )
  }

  // Sub-event detail view
  if (selectedSubEvent) {
    return (
      <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
        {/* Header section - centered, narrower width */}
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(`/events/${id}`)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {event.name}
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">{selectedSubEvent.name}</h1>
              <p className="text-sm text-muted-foreground">
                Votes contribute to the overall {event.name} standings
              </p>
            </div>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingSubEvent(!editingSubEvent)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {editingSubEvent ? 'Cancel' : 'Edit'}
              </Button>
            )}
          </div>

          {/* Edit Mode */}
          {editingSubEvent && isOwner && (
            <div className="mb-6 p-4 border rounded-lg bg-card space-y-4">
              <h3 className="font-semibold">Edit Sub-Event</h3>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Sub-event name"
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium mb-2">Image</label>
                <MediaUpload
                  value={editImageUrl}
                  onChange={setEditImageUrl}
                  compact
                />
              </div>

              {/* Players Management */}
              <div>
                <label className="block text-sm font-medium mb-2">Manage Players</label>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={editParticipantSearch}
                    onChange={(e) => setEditParticipantSearch(e.target.value)}
                    placeholder="Search players to add/remove..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {editFilteredParticipants.map(p => {
                    const isInSubEvent = editParticipantIds.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3 py-1.5"
                      >
                        <span className="text-sm truncate">{p.player?.name || p.tempName}</span>
                        {isInSubEvent ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveParticipantFromSubEvent(p.id)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleAddParticipantToSubEvent(p.id)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editParticipantIds.length} player{editParticipantIds.length !== 1 ? 's' : ''} in this sub-event
                </p>
              </div>

              <Button onClick={handleSaveSubEventEdit}>
                Save Changes
              </Button>
            </div>
          )}

          {/* Image */}
          {selectedSubEvent.imageUrl && !editingSubEvent && (
            <div className="mb-6 flex justify-center bg-black/20 rounded-lg p-2">
              <img
                src={selectedSubEvent.imageUrl}
                alt={selectedSubEvent.name}
                className="max-w-full max-h-80 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxImage(selectedSubEvent.imageUrl)}
                title="Click to view full size"
              />
            </div>
          )}
        </div>

        {/* Main Content: Leaderboard on left side, Comments centered */}
        {!editingSubEvent && (
          <div className="relative">
            {/* Left: Leaderboard - fixed position aligned with title */}
            <div className="hidden xl:block fixed w-[240px]" style={{ left: 'max(16px, calc((50% - 336px - 240px) / 2))', top: '120px' }}>
                <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Leaderboard</h2>
                <div className="space-y-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={leaderboardSearch}
                      onChange={(e) => setLeaderboardSearch(e.target.value)}
                      placeholder="Search..."
                      className="pl-7 h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1 max-h-[80vh] overflow-y-auto">
                    {selectedSubEvent.participants
                      .filter(p => {
                        if (!leaderboardSearch.trim()) return true
                        const name = (p.player?.name || p.tempName || '').toLowerCase()
                        return name.includes(leaderboardSearch.toLowerCase())
                      })
                      .map((participant, _index, _filteredArr) => {
                        const displayName = participant.player?.name || participant.tempName || 'Unknown'
                        // Get original rank from full list
                        const originalRank = selectedSubEvent.participants.findIndex(p => p.id === participant.id) + 1
                        const currentUserPlayerId = user ? userProfiles[user.id] : null
                        const isSelf = !!(participant.player?.id && currentUserPlayerId && participant.player.id === currentUserPlayerId)

                        return (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                          >
                            <span className="text-xs font-bold text-muted-foreground w-5">
                              #{originalRank}
                            </span>
                            <span className="flex-1 text-sm truncate">{displayName}</span>
                            <span className={`text-xs font-bold min-w-[2.5rem] text-right ${
                              participant.auraScore > 0 ? 'text-green-500' :
                              participant.auraScore < 0 ? 'text-red-500' :
                              'text-muted-foreground'
                            }`}>
                              {participant.auraScore > 0 ? '+' : ''}{participant.auraScore.toFixed(1)}
                            </span>
                            <VoteButtons
                              score={0}
                              onVote={(dir) => handleSubEventVote(participant.id, dir)}
                              upDisabled={credits.upvotesRemaining <= 0}
                              downDisabled={credits.downvotesRemaining <= 0}
                              upTitle={credits.upvotesRemaining <= 0 ? 'No upvotes remaining' : `${credits.upvotesRemaining} upvotes left`}
                              downTitle={credits.downvotesRemaining <= 0 ? 'No downvotes remaining' : `${credits.downvotesRemaining} downvotes left`}
                              size="sm"
                              layout="vertical"
                              hideButtons={isSelf}
                              hideScore
                              className="w-[18px]"
                            />
                          </div>
                        )
                      })}
                  </div>
                </div>
            </div>

            {/* Mobile Leaderboard - shown only on small screens */}
            <div className="lg:hidden mb-6">
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Leaderboard</h2>
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {selectedSubEvent.participants.map((participant, index) => {
                  const displayName = participant.player?.name || participant.tempName || 'Unknown'
                  const currentUserPlayerId = user ? userProfiles[user.id] : null
                  const isSelf = !!(participant.player?.id && currentUserPlayerId && participant.player.id === currentUserPlayerId)
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-card/50"
                    >
                      <span className="text-xs font-bold text-muted-foreground w-5">#{index + 1}</span>
                      <span className="flex-1 text-sm truncate">{displayName}</span>
                      <span className={`text-xs font-bold ${
                        participant.auraScore > 0 ? 'text-green-500' :
                        participant.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {participant.auraScore > 0 ? '+' : ''}{participant.auraScore.toFixed(1)}
                      </span>
                      <VoteButtons
                        score={0}
                        onVote={(dir) => handleSubEventVote(participant.id, dir)}
                        upDisabled={credits.upvotesRemaining <= 0}
                        downDisabled={credits.downvotesRemaining <= 0}
                        size="sm"
                        layout="vertical"
                        hideButtons={isSelf}
                        hideScore
                        className="w-[18px]"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Center: Comments Section (Main Focus) - Reddit Style */}
            <div className="max-w-2xl mx-auto">
                <h2 className="text-sm font-semibold text-muted-foreground mb-4">
                  {selectedSubEvent.comments.length} Comments
                </h2>

                {/* Modern Reddit-style Comment Input */}
                <div className="mb-4 border rounded-xl bg-card">
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
                  <div className="flex rounded-lg border bg-card overflow-hidden">
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
                <div className="space-y-2">
                  {topLevelComments.map(comment => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      allComments={selectedSubEvent.comments}
                      visitorId={visitorId}
                      currentUserId={user?.id}
                      isOwner={isOwner}
                      commentVotes={commentVotes}
                      replyingTo={replyingTo}
                      replyContent={replyContent}
                      replyImageUrl={replyImageUrl}
                      onVote={handleCommentVote}
                      onReply={(parentId) => { setReplyingTo(parentId); setReplyContent(''); setReplyImageUrl('') }}
                      onReplyContentChange={(content) => setReplyContent(content)}
                      onReplyImageChange={(url) => setReplyImageUrl(url)}
                      onSubmitReply={(parentId) => handleAddComment(parentId)}
                      onCancelReply={() => { setReplyingTo(null); setReplyContent(''); setReplyImageUrl('') }}
                      onDelete={handleDeleteComment}
                    />
                  ))}

                  {topLevelComments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No comments yet. Be the first to share your thoughts!
                    </div>
                  )}
                </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <ConfirmDialog
        open={confirmDialog.open}
        title="Delete Sub-Event"
        message="Are you sure you want to delete this sub-event? This action cannot be undone."
        onConfirm={handleDeleteSubEvent}
        onCancel={() => setConfirmDialog({ open: false, subEventId: null })}
      />

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{event.name}</h1>
              {event.isPublic ? (
                <Globe className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Created {new Date(event.createdAt).toLocaleDateString()}
              {event.ownerName && ` by ${event.ownerName}`}
            </p>
          </div>
          {isOwner && (
            <Link to={`/events/${event.id}/edit`}>
              <Button variant="outline" className="flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Leaderboard */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Overall Standings</h2>
            <div className="space-y-0.5">
              {event.participants.map((participant, index) => {
                const vote = votes.get(participant.id)
                const displayName = participant.player?.name || participant.tempName || 'Unknown'
                const isRealPlayer = !!participant.player
                const currentUserPlayerId = user ? userProfiles[user.id] : null
                const isSelf = !!(participant.playerId && currentUserPlayerId && participant.playerId === currentUserPlayerId)

                return (
                  <div
                    key={participant.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/50 hover:bg-card"
                  >
                    <span className="text-xs font-bold text-muted-foreground w-5">
                      {index + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      {isRealPlayer ? (
                        <Link
                          to={`/player/${participant.player!.slug}`}
                          className="text-sm hover:text-primary hover:underline truncate block"
                        >
                          {displayName}
                        </Link>
                      ) : (
                        <span className="text-sm truncate block">{displayName}</span>
                      )}
                    </div>

                    <span className={`text-xs font-bold min-w-[2.5rem] text-right ${
                      participant.auraScore > 0 ? 'text-green-500' :
                      participant.auraScore < 0 ? 'text-red-500' :
                      'text-muted-foreground'
                    }`}>
                      {participant.auraScore > 0 ? '+' : ''}{participant.auraScore.toFixed(1)}
                    </span>

                    <VoteButtons
                      score={0}
                      currentVote={vote}
                      onVote={(dir) => handleVote(participant.id, dir)}
                      size="sm"
                      layout="horizontal"
                      hideButtons={isSelf}
                      hideScore
                      className="w-[36px]"
                    />
                  </div>
                )
              })}

              {event.participants.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No participants yet
                </div>
              )}
            </div>
          </div>

          {/* Sub-Events */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Sub-Events</h2>
              {isOwner && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateSubEvent(!showCreateSubEvent)}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              )}
            </div>

            {/* Create Sub-Event Form */}
            {showCreateSubEvent && isOwner && (
              <div className="mb-4 p-4 border rounded-lg bg-card space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">Sub Event Name</label>
                  <Input
                    value={newSubEventName}
                    onChange={(e) => setNewSubEventName(e.target.value)}
                    placeholder="Enter sub event name"
                  />
                </div>

                {/* Players */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">Select Players</label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={addAllParticipants}
                      className="h-6 text-xs"
                    >
                      Add All
                    </Button>
                  </div>
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder="Search players..."
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <div className="border rounded-lg divide-y max-h-32 overflow-y-auto">
                    {filteredParticipants.map(p => {
                      const isSelected = selectedParticipantIds.includes(p.id)
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleParticipantSelection(p.id)}
                          className={`flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-accent ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <span className="text-sm truncate">{p.player?.name || p.tempName}</span>
                          {isSelected && <Check className="w-3 h-3 text-primary flex-shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                  {selectedParticipantIds.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedParticipantIds.length} selected
                    </p>
                  )}
                </div>

                {/* Image */}
                <div>
                  <label className="block text-sm font-medium mb-1">Image (optional)</label>
                  <MediaUpload
                    value={newSubEventImage}
                    onChange={setNewSubEventImage}
                    compact
                  />
                </div>

                {subEventError && (
                  <p className="text-sm text-red-500">{subEventError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowCreateSubEvent(false)
                      setNewSubEventName('')
                      setNewSubEventImage('')
                      setSelectedParticipantIds([])
                      setParticipantSearch('')
                      setSubEventError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateSubEvent}
                    disabled={!newSubEventName.trim() || selectedParticipantIds.length === 0 || creatingSubEvent}
                  >
                    {creatingSubEvent ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-Events Search and Sort */}
            {subEvents.length > 0 && (
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={subEventSearch}
                    onChange={(e) => setSubEventSearch(e.target.value)}
                    placeholder="Search sub-events..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubEventSort(subEventSort === 'newest' ? 'oldest' : 'newest')}
                  className="h-8 text-xs"
                >
                  {subEventSort === 'newest' ? 'Newest' : 'Oldest'}
                </Button>
              </div>
            )}

            {/* Sub-Events List */}
            <div className="columns-1 sm:columns-2 gap-3">
              {subEvents
                .filter(se => !subEventSearch || se.name.toLowerCase().includes(subEventSearch.toLowerCase()))
                .sort((a, b) => {
                  const dateA = new Date(a.createdAt).getTime()
                  const dateB = new Date(b.createdAt).getTime()
                  return subEventSort === 'newest' ? dateB - dateA : dateA - dateB
                })
                .map(subEvent => (
                <div
                  key={subEvent.id}
                  className="mb-3 break-inside-avoid rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 overflow-hidden hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] cursor-pointer"
                  onClick={() => navigate(`/events/${id}/sub/${subEvent.id}`)}
                >
                  {subEvent.imageUrl && (
                    <div className="relative w-full">
                      {isVideoUrl(subEvent.imageUrl) ? (
                        <>
                          <video
                            src={subEvent.imageUrl}
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
                          src={subEvent.imageUrl}
                          alt={subEvent.name}
                          className="w-full h-auto object-cover"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between p-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-2">{subEvent.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(subEvent.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDialog({ open: true, subEventId: subEvent.id })
                        }}
                        className="h-7 px-2 text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {subEvents.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                No sub-events yet
                {isOwner && <span className="block mt-1">Click "Add" to create one</span>}
              </div>
            )}

            {subEvents.length > 0 && subEvents.filter(se => !subEventSearch || se.name.toLowerCase().includes(subEventSearch.toLowerCase())).length === 0 && (
              <div className="text-center text-muted-foreground py-4 text-sm">
                No sub-events match your search
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
