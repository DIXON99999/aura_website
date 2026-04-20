import { useState, useEffect, useRef } from 'react'
import { api, type ChatMessage } from '@/lib/api'
import { Trash2, ImagePlus, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores'

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

export function ChatPage() {
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [canPost, setCanPost] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }, [content])

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null)
      return
    }
    const url = URL.createObjectURL(pendingFile)
    setPendingPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingFile])

  function selectFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    setPendingFile(file)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          selectFile(file)
          e.preventDefault()
          return
        }
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if ((!content.trim() && !pendingFile) || posting) return
    setPosting(true)
    try {
      let imageUrl: string | undefined
      if (pendingFile) {
        setUploading(true)
        const res = await api.uploadImage(pendingFile)
        imageUrl = res.imageUrl
        setUploading(false)
      }
      const created = await api.postChatMessage({
        title: title.trim() || undefined,
        content: content.trim(),
        imageUrl,
      })
      setMessages((prev) => [created, ...prev])
      setTitle('')
      setContent('')
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setUploading(false)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteChatMessage(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex justify-center px-4 pt-10 pb-24">
      <div className="w-full max-w-xl">
        {canPost && (
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

            {pendingPreview && (
              <div className="mt-2 relative inline-block">
                <img
                  src={pendingPreview}
                  alt="attachment preview"
                  className="max-h-48 rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPendingFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-background border border-border shadow hover:bg-muted"
                  aria-label="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                <ImagePlus className="w-5 h-5" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="submit"
                disabled={(!content.trim() && !pendingFile) || posting}
                className="text-sm font-medium text-violet-400 hover:text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Send
              </button>
            </div>
          </form>
        )}

        <div className="space-y-6">
          {messages.map((msg) => {
            const imgSrc = resolveMediaUrl(msg.imageUrl)
            return (
              <article key={msg.id} className="group">
                <div className="flex items-baseline justify-between gap-2">
                  {msg.title ? (
                    <h3 className="text-base font-semibold tracking-tight">{msg.title}</h3>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <time className="text-xs text-muted-foreground shrink-0">
                      {formatTime(msg.createdAt)}
                    </time>
                    {canPost && (
                      <button
                        type="button"
                        onClick={() => handleDelete(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {msg.content && (
                  <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                  </p>
                )}
                {imgSrc && (
                  <a href={imgSrc} target="_blank" rel="noreferrer" className="block mt-2">
                    <img
                      src={imgSrc}
                      alt=""
                      className="max-h-96 rounded-lg border border-border"
                    />
                  </a>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
