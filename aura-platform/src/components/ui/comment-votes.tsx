import { useState } from 'react'
import { ArrowBigUp, ArrowBigDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommentVotesProps {
  score: number
  currentVote?: 'UP' | 'DOWN' | null
  onVote: (direction: 'UP' | 'DOWN') => void
  className?: string
}

export function CommentVotes({
  score,
  currentVote,
  onVote,
  className,
}: CommentVotesProps) {
  const [voting, setVoting] = useState(false)

  const scoreColor = currentVote === 'UP'
    ? 'text-green-500'
    : currentVote === 'DOWN'
      ? 'text-red-500'
      : score > 0
        ? 'text-green-500'
        : score < 0
          ? 'text-red-500'
          : 'text-muted-foreground'

  const handleVote = async (direction: 'UP' | 'DOWN') => {
    if (voting) return
    setVoting(true)
    try {
      onVote(direction)
    } finally {
      // Brief cooldown to prevent rapid double-clicks
      setTimeout(() => setVoting(false), 300)
    }
  }

  return (
    <div className={cn('flex items-center gap-0.5 rounded-full bg-accent/50 hover:bg-accent transition-colors', className)}>
      <button
        onClick={() => handleVote('UP')}
        disabled={voting}
        className={cn(
          'p-1 rounded-full transition-all',
          currentVote === 'UP'
            ? 'text-green-500 scale-110'
            : 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10'
        )}
        title={currentVote === 'UP' ? 'Remove upvote' : 'Upvote'}
      >
        <ArrowBigUp
          className="w-5 h-5"
          fill={currentVote === 'UP' ? 'currentColor' : 'none'}
        />
      </button>

      <span className={cn('text-xs font-bold tabular-nums min-w-[1.25rem] text-center select-none', scoreColor)}>
        {score}
      </span>

      <button
        onClick={() => handleVote('DOWN')}
        disabled={voting}
        className={cn(
          'p-1 rounded-full transition-all',
          currentVote === 'DOWN'
            ? 'text-red-500 scale-110'
            : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
        )}
        title={currentVote === 'DOWN' ? 'Remove downvote' : 'Downvote'}
      >
        <ArrowBigDown
          className="w-5 h-5"
          fill={currentVote === 'DOWN' ? 'currentColor' : 'none'}
        />
      </button>
    </div>
  )
}
