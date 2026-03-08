import { Link } from 'react-router-dom'

interface MentionTextProps {
  content: string
  className?: string
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
          const slug = nameToSlug(username)
          return (
            <Link
              key={index}
              to={`/player/${slug}`}
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
