import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type EventWithParticipants, type SubEvent, type SubEventWithParticipants, type SubEventComment } from '@/lib/api'
import { useAuthStore, useAuraStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronUp, ChevronDown, Lock, Globe, Edit2, Plus, ArrowLeft, Check, Search, Upload, Send, Trash2, X, MessageSquare, Reply, Link as LinkIcon } from 'lucide-react'

function getVisitorId(): string {
  let id = localStorage.getItem('aura_visitor_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('aura_visitor_id', id)
  }
  return id
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

// Image Upload Component
function ImageUpload({
  value,
  onChange,
  onRemove,
}: {
  value: string
  onChange: (url: string) => void
  onRemove?: () => void
}) {
  const [mode, setMode] = useState<'url' | 'upload'>('url')
  const [urlInput, setUrlInput] = useState(value)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      onChange(dataUrl)
      setUrlInput(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim())
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'url' ? 'default' : 'outline'}
          onClick={() => setMode('url')}
          className="flex items-center gap-1"
        >
          <LinkIcon className="w-3 h-3" />
          URL
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'upload' ? 'default' : 'outline'}
          onClick={() => setMode('upload')}
          className="flex items-center gap-1"
        >
          <Upload className="w-3 h-3" />
          Upload
        </Button>
      </div>

      {mode === 'url' ? (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter image URL..."
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={handleUrlSubmit}>
            Set
          </Button>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Image
          </Button>
        </div>
      )}

      {value && (
        <div className="relative">
          <img src={value} alt="Preview" className="w-full max-h-32 object-cover rounded-lg" />
          {onRemove && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onRemove}
              className="absolute top-2 right-2"
            >
              <X className="w-3 h-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Comment Component with replies
function CommentItem({
  comment,
  allComments,
  visitorId,
  isOwner,
  commentVotes,
  replyingTo,
  replyContent,
  onVote,
  onReply,
  onReplyContentChange,
  onSubmitReply,
  onCancelReply,
  onDelete,
  depth = 0,
}: {
  comment: SubEventComment
  allComments: SubEventComment[]
  visitorId: string
  isOwner: boolean
  commentVotes: Map<string, 'UP' | 'DOWN'>
  replyingTo: string | null
  replyContent: string
  onVote: (commentId: string, direction: 'UP' | 'DOWN') => void
  onReply: (parentId: string) => void
  onReplyContentChange: (content: string) => void
  onSubmitReply: (parentId: string) => void
  onCancelReply: () => void
  onDelete: (commentId: string) => void
  depth?: number
}) {
  const replies = allComments.filter(c => c.parentId === comment.id)
  const vote = commentVotes.get(comment.id)
  // Only the comment author can delete their own comment
  const canDelete = comment.visitorId === visitorId
  const isReplying = replyingTo === comment.id

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-border pl-4' : ''}`}>
      <div className="py-2">
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => onVote(comment.id, 'UP')}
              className={`p-0.5 rounded hover:bg-accent ${vote === 'UP' ? 'text-green-500' : 'text-muted-foreground'}`}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <span className={`text-xs font-medium ${
              comment.voteCount > 0 ? 'text-green-500' :
              comment.voteCount < 0 ? 'text-red-500' :
              'text-muted-foreground'
            }`}>
              {comment.voteCount}
            </span>
            <button
              onClick={() => onVote(comment.id, 'DOWN')}
              className={`p-0.5 rounded hover:bg-accent ${vote === 'DOWN' ? 'text-red-500' : 'text-muted-foreground'}`}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{comment.username}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm mb-2">{comment.content}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
              {canDelete && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              )}
            </div>
            {isReplying && (
              <div className="mt-2 flex gap-2">
                <Input
                  value={replyContent}
                  onChange={(e) => onReplyContentChange(e.target.value)}
                  placeholder="Write a reply..."
                  autoFocus
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onSubmitReply(comment.id)
                    }
                    if (e.key === 'Escape') {
                      onCancelReply()
                    }
                  }}
                />
                <Button size="sm" className="h-8" onClick={() => onSubmitReply(comment.id)} disabled={!replyContent.trim()}>
                  Reply
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={onCancelReply}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {replies.map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          allComments={allComments}
          visitorId={visitorId}
          isOwner={isOwner}
          commentVotes={commentVotes}
          replyingTo={replyingTo}
          replyContent={replyContent}
          onVote={onVote}
          onReply={onReply}
          onReplyContentChange={onReplyContentChange}
          onSubmitReply={onSubmitReply}
          onCancelReply={onCancelReply}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export function EventPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const userProfiles = useAuraStore((s) => s.userProfiles)
  const players = useAuraStore((s) => s.players)
  const [event, setEvent] = useState<EventWithParticipants | null>(null)
  const [votes, setVotes] = useState<Map<string, 'UP' | 'DOWN'>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Sub-events state
  const [subEvents, setSubEvents] = useState<SubEvent[]>([])
  const [selectedSubEvent, setSelectedSubEvent] = useState<SubEventWithParticipants | null>(null)
  const [subEventVotes, setSubEventVotes] = useState<Map<string, 'UP' | 'DOWN'>>(new Map())
  const [showCreateSubEvent, setShowCreateSubEvent] = useState(false)
  const [newSubEventName, setNewSubEventName] = useState('')
  const [newSubEventImage, setNewSubEventImage] = useState('')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
  const [creatingSubEvent, setCreatingSubEvent] = useState(false)
  const [participantSearch, setParticipantSearch] = useState('')
  const [subEventError, setSubEventError] = useState('')

  // Edit sub-event state
  const [editingSubEvent, setEditingSubEvent] = useState(false)
  const [editName, setEditName] = useState('')
  const [editParticipantIds, setEditParticipantIds] = useState<string[]>([])
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editParticipantSearch, setEditParticipantSearch] = useState('')

  // Comments state
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [commentVotes, setCommentVotes] = useState<Map<string, 'UP' | 'DOWN'>>(new Map())

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; subEventId: string | null }>({ open: false, subEventId: null })

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

  const loadSubEvent = async (subEventId: string) => {
    if (!id) return
    try {
      const [subEventData, votesData, commentVotesData] = await Promise.all([
        api.getSubEvent(id, subEventId),
        api.getSubEventVotes(id, subEventId, visitorId),
        api.getCommentVotes(id, subEventId, visitorId),
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
        const result = await api.voteEventParticipant(event.id, { visitorId, participantId, direction })
        setVotes(new Map(votes).set(participantId, direction))
        setEvent({
          ...event,
          participants: event.participants.map(p =>
            p.id === participantId ? { ...p, auraScore: result.auraScore } : p
          ).sort((a, b) => b.auraScore - a.auraScore),
        })
      }
    } catch (err) {
      console.error('Vote failed:', err)
    }
  }

  const handleSubEventVote = async (participantId: string, direction: 'UP' | 'DOWN') => {
    if (!id || !selectedSubEvent) return

    const currentVote = subEventVotes.get(participantId)

    try {
      if (currentVote === direction) {
        const result = await api.removeSubEventVote(id, selectedSubEvent.id, { visitorId, participantId })
        const newVotes = new Map(subEventVotes)
        newVotes.delete(participantId)
        setSubEventVotes(newVotes)
        setSelectedSubEvent({
          ...selectedSubEvent,
          participants: selectedSubEvent.participants.map(p =>
            p.id === participantId ? { ...p, auraScore: result.auraScore } : p
          ).sort((a, b) => b.auraScore - a.auraScore),
        })
      } else {
        const result = await api.voteSubEventParticipant(id, selectedSubEvent.id, { visitorId, participantId, direction })
        setSubEventVotes(new Map(subEventVotes).set(participantId, direction))
        setSelectedSubEvent({
          ...selectedSubEvent,
          participants: selectedSubEvent.participants.map(p =>
            p.id === participantId ? { ...p, auraScore: result.auraScore } : p
          ).sort((a, b) => b.auraScore - a.auraScore),
        })
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
      loadSubEvent(newSubEvent.id)
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
        setSelectedSubEvent(null)
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
      // Update name and image
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

  const handleCommentVote = async (commentId: string, direction: 'UP' | 'DOWN') => {
    if (!id || !selectedSubEvent) return

    try {
      const result = await api.voteComment(id, selectedSubEvent.id, commentId, { visitorId, direction })

      const currentVote = commentVotes.get(commentId)
      const newVotes = new Map(commentVotes)

      if (currentVote === direction) {
        newVotes.delete(commentId)
      } else {
        newVotes.set(commentId, direction)
      }
      setCommentVotes(newVotes)

      setSelectedSubEvent({
        ...selectedSubEvent,
        comments: selectedSubEvent.comments.map(c =>
          c.id === commentId ? { ...c, voteCount: result.voteCount } : c
        ),
      })
    } catch (err) {
      console.error('Failed to vote on comment:', err)
    }
  }

  const handleAddComment = async (parentId?: string) => {
    if (!id || !selectedSubEvent) return

    const content = parentId ? replyContent : newComment
    if (!content.trim()) return

    try {
      const comment = await api.addSubEventComment(id, selectedSubEvent.id, {
        visitorId,
        content: content.trim(),
        username: getUsername(),
        parentId,
      })
      setSelectedSubEvent({
        ...selectedSubEvent,
        comments: [...selectedSubEvent.comments, comment],
      })
      if (parentId) {
        setReplyContent('')
        setReplyingTo(null)
      } else {
        setNewComment('')
      }
    } catch (err) {
      console.error('Failed to add comment:', err)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !selectedSubEvent) return

    try {
      await api.deleteSubEventComment(id, selectedSubEvent.id, commentId, { visitorId })
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

  const topLevelComments = selectedSubEvent?.comments.filter(c => !c.parentId) || []

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
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedSubEvent(null)}
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
                <ImageUpload
                  value={editImageUrl}
                  onChange={setEditImageUrl}
                  onRemove={() => setEditImageUrl('')}
                />
              </div>

              <Button onClick={handleSaveSubEventEdit}>
                Save Changes
              </Button>
            </div>
          )}

          {/* Image */}
          {selectedSubEvent.imageUrl && !editingSubEvent && (
            <div className="mb-6">
              <img
                src={selectedSubEvent.imageUrl}
                alt={selectedSubEvent.name}
                className="w-full max-h-64 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Participants */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Participants</h2>
            <div className="space-y-1">
              {selectedSubEvent.participants.map((participant, index) => {
                const vote = subEventVotes.get(participant.id)
                const displayName = participant.player?.name || participant.tempName || 'Unknown'

                return (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card"
                  >
                    <span className="text-sm font-bold text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <span className="flex-1 text-sm truncate">{displayName}</span>
                    <span className={`text-sm font-bold min-w-[3rem] text-right ${
                      participant.auraScore > 0 ? 'text-green-500' :
                      participant.auraScore < 0 ? 'text-red-500' :
                      'text-muted-foreground'
                    }`}>
                      {participant.auraScore > 0 ? '+' : ''}{participant.auraScore.toFixed(1)}
                    </span>
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleSubEventVote(participant.id, 'UP')}
                        className={`p-0.5 rounded hover:bg-accent ${
                          vote === 'UP' ? 'text-green-500' : 'text-muted-foreground'
                        }`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSubEventVote(participant.id, 'DOWN')}
                        className={`p-0.5 rounded hover:bg-accent ${
                          vote === 'DOWN' ? 'text-red-500' : 'text-muted-foreground'
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Comments
            </h2>

            <div className="flex gap-2 mb-4">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
              />
              <Button onClick={() => handleAddComment()} disabled={!newComment.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-1">
              {topLevelComments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  allComments={selectedSubEvent.comments}
                  visitorId={visitorId}
                  isOwner={isOwner}
                  commentVotes={commentVotes}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  onVote={handleCommentVote}
                  onReply={(parentId) => setReplyingTo(parentId)}
                  onReplyContentChange={(content) => setReplyContent(content)}
                  onSubmitReply={(parentId) => handleAddComment(parentId)}
                  onCancelReply={() => { setReplyingTo(null); setReplyContent('') }}
                  onDelete={handleDeleteComment}
                />
              ))}

              {topLevelComments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              )}
            </div>
          </div>
        </div>
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

      <div className="max-w-6xl mx-auto">
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

                    <div className="flex">
                      <button
                        onClick={() => handleVote(participant.id, 'UP')}
                        className={`p-0.5 rounded hover:bg-accent ${
                          vote === 'UP' ? 'text-green-500' : 'text-muted-foreground'
                        }`}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleVote(participant.id, 'DOWN')}
                        className={`p-0.5 rounded hover:bg-accent ${
                          vote === 'DOWN' ? 'text-red-500' : 'text-muted-foreground'
                        }`}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                  <ImageUpload
                    value={newSubEventImage}
                    onChange={setNewSubEventImage}
                    onRemove={() => setNewSubEventImage('')}
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

            {/* Sub-Events List */}
            <div className="space-y-1">
              {subEvents.map(subEvent => (
                <div
                  key={subEvent.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer"
                  onClick={() => loadSubEvent(subEvent.id)}
                >
                  <span className="font-medium text-sm truncate">{subEvent.name}</span>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDialog({ open: true, subEventId: subEvent.id })
                      }}
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              ))}

              {subEvents.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No sub-events yet
                  {isOwner && <span className="block mt-1">Click "Add" to create one</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
