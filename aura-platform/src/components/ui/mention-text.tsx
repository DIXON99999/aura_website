import { Link } from 'react-router-dom'

interface MentionTextProps {
  content: string
  className?: string
}

export function MentionText({ content, className = '' }: MentionTextProps) {
  if (!content) return null

  // Split content by @mentions
  const parts = content.split(/(@\w+)/g)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const username = part.slice(1)
          return (
            <Link
              key={index}
              to={`/players?search=${encodeURIComponent(username)}`}
              className="text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </span>
  )
}
