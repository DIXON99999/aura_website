import { ChevronUp, ChevronDown } from 'lucide-react'
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
  const scoreColor = score > 0 ? 'text-green-500' : score < 0 ? 'text-red-500' : 'text-muted-foreground'

  const handleVote = (direction: 'UP' | 'DOWN') => {
    console.log('CommentVotes: voting', direction, 'current score:', score)
    onVote(direction)
  }

  return (
    <div className={cn('flex items-center rounded-full bg-accent/50 hover:bg-accent', className)}>
      <button
        onClick={() => handleVote('UP')}
        className={cn(
          'p-1.5 rounded-full transition-colors',
          currentVote === 'UP'
            ? 'text-green-500 bg-green-500/20'
            : 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10'
        )}
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <span className={cn('text-xs font-bold tabular-nums min-w-[1rem] text-center', scoreColor)}>
        {score}
      </span>

      <button
        onClick={() => handleVote('DOWN')}
        className={cn(
          'p-1.5 rounded-full transition-colors',
          currentVote === 'DOWN'
            ? 'text-red-500 bg-red-500/20'
            : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
        )}
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  )
}
