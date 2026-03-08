import { useState, useRef, useEffect, useCallback } from 'react'
import { api, type Entity } from '@/lib/api'
import { cn } from '@/lib/utils'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  rows?: number
  className?: string
  onFocus?: () => void
  onBlur?: () => void
  autoFocus?: boolean
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 1,
  className,
  onFocus,
  onBlur,
  autoFocus,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [suggestions, setSuggestions] = useState<Entity[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Search for players when mention query changes
  useEffect(() => {
    // Show dropdown when @ is detected (mentionStart >= 0)
    if (mentionStart === -1) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    // Show dropdown immediately when @ is typed
    setShowDropdown(true)

    if (mentionQuery.length < 1) {
      setSuggestions([])
      setLoading(false)
      return
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const players = await api.getPlayers({ search: mentionQuery })
        setSuggestions(players.slice(0, 8))
        setSelectedIndex(0)
      } catch {
        setSuggestions([])
      }
      setLoading(false)
    }, 150)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [mentionQuery, mentionStart])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart

    onChange(newValue)

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const matchStart = cursorPos - mentionMatch[0].length
      setMentionStart(matchStart)
      setMentionQuery(mentionMatch[1])
    } else {
      setMentionStart(-1)
      setMentionQuery('')
      setShowDropdown(false)
    }
  }, [onChange])

  const insertMention = useCallback((player: Entity) => {
    if (mentionStart === -1 || !textareaRef.current) return

    const cursorPos = textareaRef.current.selectionStart
    const beforeMention = value.slice(0, mentionStart)
    const afterMention = value.slice(cursorPos)
    const newValue = `${beforeMention}@${player.name} ${afterMention}`

    onChange(newValue)
    setShowDropdown(false)
    setMentionQuery('')
    setMentionStart(-1)

    // Focus back and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + player.name.length + 2 // +2 for @ and space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [mentionStart, value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Enter to submit when dropdown is not showing
    if (e.key === 'Enter' && !e.shiftKey && !showDropdown) {
      e.preventDefault()
      onSubmit?.()
      return
    }

    if (!showDropdown || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertMention(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }, [showDropdown, suggestions, selectedIndex, insertMention, onSubmit])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={cn(
          "w-full resize-none bg-transparent px-3 py-2 text-sm focus:outline-none",
          className
        )}
      />

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 bottom-full mb-1 max-h-48 overflow-y-auto rounded-lg border bg-card shadow-lg z-50"
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Searching...
            </div>
          ) : mentionQuery.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Type a name to mention someone...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No users found
            </div>
          ) : (
            suggestions.map((player, index) => (
              <button
                key={player.id}
                type="button"
                onClick={() => insertMention(player)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                  index === selectedIndex && "bg-accent"
                )}
              >
                {player.imageUrl ? (
                  <img
                    src={player.imageUrl}
                    alt={player.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                    style={{
                      backgroundColor: `hsl(${player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360}, 50%, 50%)`
                    }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium">{player.name}</span>
                {player.auraScore !== 0 && (
                  <span className={cn(
                    "text-xs ml-auto",
                    player.auraScore > 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {player.auraScore > 0 ? '+' : ''}{player.auraScore.toFixed(0)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
