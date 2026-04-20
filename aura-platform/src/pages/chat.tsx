import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api, type ChatMessage } from '@/lib/api'
import {
  Trash2,
  ImagePlus,
  X,
  Loader2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from 'lucide-react'
import { useAuthStore, useAuraStore } from '@/stores'
import { EntityTypes, type Player } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const base = API_BASE.replace(/\/api\/?$/, '')
  return `${base}${url}`
}

function formatTime(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type Attachment =
  | { kind: 'file'; file: File; preview: string }
  | { kind: 'url'; url: string }

export function ChatPage() {
  const user = useAuthStore((s) => s.user)
  const players = useAuraStore((s) => s.players)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [canPost, setCanPost] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const messageRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [msgs, perm] = await Promise.all([
          api.getChatMessages(),
          user ? api.canPostChat() : Promise.resolve({ canPost: false }),
        ])
        if (cancelled) return
        setMessages(msgs)
        setCanPost(perm.canPost)
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (messages.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.msgId
          if (id) setActiveId(id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    messageRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [messages])

  function jumpTo(id: string) {
    const el = messageRefs.current.get(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  function chapterLabel(msg: ChatMessage): string {
    if (msg.title && msg.title.trim()) return msg.title.trim()
    const snippet = msg.content.trim().split('\n')[0]
    if (snippet) return snippet.length > 48 ? snippet.slice(0, 48) + '…' : snippet
    return 'Untitled'
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteChatMessage(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
      if (editingId === id) setEditingId(null)
    } catch {
      // ignore
    }
  }

  // Unique pool of players referenced across all messages (preserving newest-first order)
  const playerPool = useMemo(() => {
    const seen = new Set<string>()
    const result: Player[] = []
    for (const msg of messages) {
      for (const pid of msg.playerIds) {
        if (seen.has(pid)) continue
        const p = players[pid]
        if (p && p.type === EntityTypes.PLAYER) {
          seen.add(pid)
          result.push(p as Player)
        }
      }
    }
    return result
  }, [messages, players])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex justify-center px-4 pt-10 pb-24 relative">
      {messages.length > 0 && (
        <aside className="hidden lg:block fixed left-4 top-24 w-56 max-h-[calc(100vh-8rem)] overflow-y-auto z-30">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Chapters
          </div>
          <nav className="space-y-0.5">
            {messages.map((msg) => {
              const isActive = activeId === msg.id
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => jumpTo(msg.id)}
                  className={
                    'w-full text-left px-2 py-1.5 rounded-md text-sm truncate border-l-2 transition-colors ' +
                    (isActive
                      ? 'border-violet-500 bg-violet-500/10 text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50')
                  }
                  title={chapterLabel(msg)}
                >
                  {chapterLabel(msg)}
                </button>
              )
            })}
          </nav>
        </aside>
      )}

      {playerPool.length > 0 && (
        <aside className="hidden lg:block fixed right-4 top-24 w-56 max-h-[calc(100vh-8rem)] overflow-y-auto z-30">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Players
          </div>
          <div className="space-y-1">
            {playerPool.map((p) => (
              <Link
                key={p.id}
                to={`/player/${p.slug}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                title={p.name}
              >
                <PlayerAvatar player={p} size={7} />
                <span className="text-sm truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        </aside>
      )}

      <div className="w-full max-w-xl">
        {canPost && !editingId && (
          <MessageComposer
            key="new"
            mode="create"
            onSubmit={async ({ title, content, imageUrls, playerIds }) => {
              const created = await api.postChatMessage({
                title: title || undefined,
                content,
                imageUrls,
                playerIds,
              })
              setMessages((prev) => [created, ...prev])
            }}
          />
        )}

        <div className="space-y-6">
          {messages.map((msg) => {
            const isEditing = editingId === msg.id
            return (
              <article
                key={msg.id}
                data-msg-id={msg.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(msg.id, el)
                  else messageRefs.current.delete(msg.id)
                }}
                className="group scroll-mt-24"
              >
                {isEditing ? (
                  <MessageComposer
                    key={`edit-${msg.id}`}
                    mode="edit"
                    initial={{
                      title: msg.title || '',
                      content: msg.content,
                      imageUrls: msg.imageUrls,
                      playerIds: msg.playerIds,
                    }}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async ({ title, content, imageUrls, playerIds }) => {
                      const updated = await api.updateChatMessage(msg.id, {
                        title: title || undefined,
                        content,
                        imageUrls,
                        playerIds,
                      })
                      setMessages((prev) =>
                        prev.map((m) => (m.id === msg.id ? updated : m))
                      )
                      setEditingId(null)
                    }}
                  />
                ) : (
                  <>
                    {msg.imageUrls.length > 0 && (
                      <ImageGallery
                        urls={msg.imageUrls}
                        onOpen={(index, resolved) =>
                          setLightbox({ urls: resolved, index })
                        }
                      />
                    )}
                    <div className={`flex items-baseline justify-between gap-2 ${msg.imageUrls.length > 0 ? 'mt-3' : ''}`}>
                      {msg.title ? (
                        <h3 className="text-base font-semibold tracking-tight">{msg.title}</h3>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2">
                        <time
                          className="text-xs text-muted-foreground shrink-0"
                          title={msg.updatedAt ? `Edited ${formatTime(msg.updatedAt)}` : undefined}
                        >
                          {formatTime(msg.createdAt)}
                          {msg.updatedAt && <span className="ml-1 italic">(edited)</span>}
                        </time>
                        {canPost && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(msg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              aria-label="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(msg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {msg.content && (
                      <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                      </p>
                    )}
                    {msg.playerIds.length > 0 && (
                      <MessagePlayerChips playerIds={msg.playerIds} />
                    )}
                  </>
                )}
              </article>
            )
          })}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox({ ...lightbox, index: i })}
        />
      )}
    </div>
  )
}

const AVATAR_SIZE: Record<5 | 6 | 7, string> = {
  5: 'w-5 h-5',
  6: 'w-6 h-6',
  7: 'w-7 h-7',
}

function PlayerAvatar({ player, size = 7 }: { player: Player; size?: 5 | 6 | 7 }) {
  const src = resolveMediaUrl(player.imageUrl)
  const cls = AVATAR_SIZE[size]
  if (!src) {
    return (
      <div
        className={`${cls} rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0`}
      >
        {player.name.slice(0, 1).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={player.name}
      className={`${cls} rounded-full object-cover bg-muted shrink-0`}
    />
  )
}

function MessagePlayerChips({ playerIds }: { playerIds: string[] }) {
  const players = useAuraStore((s) => s.players)
  const list = playerIds
    .map((id) => players[id])
    .filter((p): p is Player => !!p && p.type === EntityTypes.PLAYER)
  if (list.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map((p) => (
        <Link
          key={p.id}
          to={`/player/${p.slug}`}
          className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-muted/60 hover:bg-muted text-xs font-medium transition-colors"
        >
          <PlayerAvatar player={p} size={5} />
          {p.name}
        </Link>
      ))}
    </div>
  )
}

function ImageGallery({
  urls,
  onOpen,
}: {
  urls: string[]
  onOpen: (index: number, resolved: string[]) => void
}) {
  const resolved = urls.map(resolveMediaUrl).filter((u): u is string => !!u)
  if (resolved.length === 0) return null
  const gridClass =
    resolved.length === 1
      ? 'grid-cols-1'
      : resolved.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-2 sm:grid-cols-3'
  return (
    <div className={`grid gap-2 ${gridClass}`}>
      {resolved.map((src, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i, resolved)}
          className="block overflow-hidden rounded-lg border border-border cursor-zoom-in"
        >
          <img
            src={src}
            alt=""
            className={
              resolved.length === 1
                ? 'max-h-96 w-full object-contain bg-muted/30'
                : 'w-full h-40 object-cover hover:opacity-90 transition-opacity'
            }
          />
        </button>
      ))}
    </div>
  )
}

function Lightbox({
  urls,
  index,
  onClose,
  onIndexChange,
}: {
  urls: string[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && index < urls.length - 1) onIndexChange(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', handleKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prev
    }
  }, [index, urls.length, onClose, onIndexChange])

  const hasPrev = index > 0
  const hasNext = index < urls.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onIndexChange(index - 1)
          }}
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onIndexChange(index + 1)
          }}
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <img
        src={urls[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
      />

      {urls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 px-2.5 py-1 rounded-full">
          {index + 1} / {urls.length}
        </div>
      )}
    </div>
  )
}

function MessageComposer({
  mode,
  initial,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit'
  initial?: { title: string; content: string; imageUrls: string[]; playerIds: string[] }
  onSubmit: (data: {
    title: string
    content: string
    imageUrls: string[]
    playerIds: string[]
  }) => Promise<void>
  onCancel?: () => void
}) {
  const players = useAuraStore((s) => s.players)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [attachments, setAttachments] = useState<Attachment[]>(
    (initial?.imageUrls ?? []).map((url) => ({ kind: 'url', url }))
  )
  const [playerIds, setPlayerIds] = useState<string[]>(initial?.playerIds ?? [])
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }, [content])

  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.kind === 'file') URL.revokeObjectURL(a.preview)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(files: FileList | File[] | null) {
    if (!files) return
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) return
    setAttachments((prev) => [
      ...prev,
      ...list.map<Attachment>((file) => ({
        kind: 'file',
        file,
        preview: URL.createObjectURL(file),
      })),
    ])
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const removed = prev[index]
      if (removed?.kind === 'file') URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      addFiles(files)
      e.preventDefault()
    }
  }

  const selectedPlayers = useMemo(
    () =>
      playerIds
        .map((id) => players[id])
        .filter((p): p is Player => !!p && p.type === EntityTypes.PLAYER),
    [playerIds, players]
  )

  const hasContent =
    content.trim().length > 0 || attachments.length > 0 || playerIds.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasContent || posting) return
    setPosting(true)
    try {
      const fileAttachments = attachments.filter((a) => a.kind === 'file') as Extract<
        Attachment,
        { kind: 'file' }
      >[]
      let uploaded: string[] = []
      if (fileAttachments.length > 0) {
        setUploading(true)
        uploaded = await Promise.all(
          fileAttachments.map((a) => api.uploadImage(a.file).then((r) => r.imageUrl))
        )
        setUploading(false)
      }
      let uploadedIdx = 0
      const imageUrls = attachments.map((a) =>
        a.kind === 'url' ? a.url : uploaded[uploadedIdx++]
      )
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        imageUrls,
        playerIds,
      })
      if (mode === 'create') {
        setTitle('')
        setContent('')
        setAttachments([])
        setPlayerIds([])
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch {
      setUploading(false)
    } finally {
      setPosting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onPaste={handlePaste}
      className="mb-8 rounded-xl border border-border bg-card/40 p-4"
    >
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/60"
      />
      <textarea
        ref={textareaRef}
        placeholder="Write a message..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={5000}
        rows={2}
        className="mt-2 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />

      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => {
            const src = a.kind === 'file' ? a.preview : resolveMediaUrl(a.url) || ''
            return (
              <div key={i} className="relative">
                <img
                  src={src}
                  alt="attachment"
                  className="h-24 w-24 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-background border border-border shadow hover:bg-muted"
                  aria-label="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selectedPlayers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedPlayers.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-1 py-0.5 rounded-full bg-muted/60 text-xs font-medium"
            >
              <PlayerAvatar player={p} size={5} />
              <span className="pl-0.5">{p.name}</span>
              <button
                type="button"
                onClick={() => setPlayerIds((prev) => prev.filter((id) => id !== p.id))}
                className="p-0.5 rounded-full hover:bg-background/70 text-muted-foreground hover:text-foreground"
                aria-label="Remove player"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer text-muted-foreground hover:text-foreground" title="Add image">
            <ImagePlus className="w-5 h-5" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          <PlayerPicker
            selected={playerIds}
            onAdd={(id) =>
              setPlayerIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
            }
          />
        </div>
        <div className="flex items-center gap-3">
          {mode === 'edit' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!hasContent || posting}
            className="text-sm font-medium text-violet-400 hover:text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'edit' ? 'Save' : 'Send'}
          </button>
        </div>
      </div>
    </form>
  )
}

function PlayerPicker({
  selected,
  onAdd,
}: {
  selected: string[]
  onAdd: (id: string) => void
}) {
  const players = useAuraStore((s) => s.players)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick)
      return () => document.removeEventListener('mousedown', onDocClick)
    }
  }, [open])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = Object.values(players).filter(
      (p): p is Player => p.type === EntityTypes.PLAYER
    )
    const filtered = q
      ? all.filter((p) => p.name.toLowerCase().includes(q))
      : all
    return filtered
      .filter((p) => !selected.includes(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10)
  }, [players, query, selected])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground"
        title="Add player"
      >
        <UserPlus className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-64 rounded-lg border border-border bg-popover shadow-lg p-2 z-10">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players..."
            autoFocus
            className="w-full px-2 py-1 text-sm bg-transparent border-b border-border outline-none placeholder:text-muted-foreground/60"
          />
          <div className="mt-1 max-h-60 overflow-y-auto">
            {matches.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No players found
              </div>
            ) : (
              matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onAdd(p.id)
                    setQuery('')
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left"
                >
                  <PlayerAvatar player={p} size={6} />
                  <span className="text-sm truncate">{p.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
