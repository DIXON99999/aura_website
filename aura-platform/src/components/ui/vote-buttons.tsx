import { useState, useRef } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingNumber {
  id: number
  value: number
  x: number
  y: number
}

interface VoteButtonsProps {
  score: number
  currentVote?: 'UP' | 'DOWN' | null
  onVote: (direction: 'UP' | 'DOWN') => void
  upDisabled?: boolean
  downDisabled?: boolean
  upTitle?: string
  downTitle?: string
  size?: 'sm' | 'md' | 'lg'
  layout?: 'vertical' | 'horizontal'
  variant?: 'default' | 'pill'
  className?: string
  hideButtons?: boolean
  hideScore?: boolean
}

export function VoteButtons({
  score,
  currentVote,
  onVote,
  upDisabled,
  downDisabled,
  upTitle,
  downTitle,
  size = 'md',
  layout = 'vertical',
  variant = 'default',
  className,
  hideButtons,
  hideScore,
}: VoteButtonsProps) {
  const [pressing, setPressing] = useState<'up' | 'down' | null>(null)
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const idCounter = useRef(0)

  const sizeClasses = {
    sm: { button: 'p-0.5', icon: 'w-4 h-4', score: 'text-xs' },
    md: { button: 'p-1.5', icon: 'w-5 h-5', score: 'text-sm' },
    lg: { button: 'p-3', icon: 'w-8 h-8', score: 'text-3xl' },
  }

  const handleVote = (direction: 'UP' | 'DOWN', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if ((direction === 'UP' && upDisabled) || (direction === 'DOWN' && downDisabled)) {
      return
    }

    // Trigger squish animation
    setPressing(direction === 'UP' ? 'up' : 'down')
    setTimeout(() => setPressing(null), 150)

    // Calculate floating number value
    let delta = 0
    if (currentVote === direction) {
      // Removing vote
      delta = direction === 'UP' ? -1 : 1
    } else if (currentVote) {
      // Changing vote
      delta = direction === 'UP' ? 2 : -2
    } else {
      // New vote
      delta = direction === 'UP' ? 1 : -1
    }

    // Create floating number at click position relative to container
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const newNumber: FloatingNumber = {
        id: idCounter.current++,
        value: delta,
        x,
        y,
      }

      setFloatingNumbers(prev => [...prev, newNumber])

      // Remove after animation
      setTimeout(() => {
        setFloatingNumbers(prev => prev.filter(n => n.id !== newNumber.id))
      }, 800)
    }

    onVote(direction)
  }

  const scoreColor = score > 0 ? 'text-green-500' : score < 0 ? 'text-red-500' : 'text-muted-foreground'

  const isPill = variant === 'pill'

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center',
        layout === 'vertical' ? 'flex-col' : 'flex-row',
        isPill && 'rounded-full bg-accent/50 hover:bg-accent',
        className
      )}
    >
      {/* Floating numbers */}
      {floatingNumbers.map(num => (
        <span
          key={num.id}
          className={cn(
            'absolute pointer-events-none font-bold animate-float-up z-50',
            num.value > 0 ? 'text-green-500' : 'text-red-500',
            size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-base'
          )}
          style={{
            left: num.x,
            top: num.y,
          }}
        >
          {num.value > 0 ? '+' : ''}{num.value}
        </span>
      ))}

      {!hideButtons ? (
        <button
          onClick={(e) => handleVote('UP', e)}
          disabled={upDisabled}
          className={cn(
            'transition-all duration-150 text-green-500',
            isPill ? 'p-1.5 rounded-full' : cn('rounded', sizeClasses[size].button),
            upDisabled
              ? 'opacity-30 cursor-not-allowed'
              : isPill
                ? 'hover:bg-green-500/10'
                : 'opacity-60 hover:opacity-100 hover:bg-green-500/10',
            currentVote === 'UP' && (isPill ? '' : 'opacity-100 bg-green-500/10'),
            pressing === 'up' && 'scale-75'
          )}
          title={upTitle}
        >
          <ChevronUp className={sizeClasses[size].icon} />
        </button>
      ) : (
        <div className={cn(isPill ? 'p-1.5' : sizeClasses[size].button)}>
          <div className={cn(sizeClasses[size].icon, 'invisible')} />
        </div>
      )}

      {!hideScore && (
        <div
          className={cn(
            'font-bold tabular-nums text-center transition-transform duration-150',
            sizeClasses[size].score,
            scoreColor,
            isPill ? 'min-w-[1rem]' : layout === 'vertical' ? 'min-w-[3ch]' : 'min-w-[4ch]',
            pressing && 'scale-110'
          )}
        >
          {typeof score === 'number' ? (Number.isInteger(score) ? score : score.toFixed(0)) : score}
        </div>
      )}

      {!hideButtons ? (
        <button
          onClick={(e) => handleVote('DOWN', e)}
          disabled={downDisabled}
          className={cn(
            'transition-all duration-150 text-red-500',
            isPill ? 'p-1.5 rounded-full' : cn('rounded', sizeClasses[size].button),
            downDisabled
              ? 'opacity-30 cursor-not-allowed'
              : isPill
                ? 'hover:bg-red-500/10'
                : 'opacity-60 hover:opacity-100 hover:bg-red-500/10',
            currentVote === 'DOWN' && (isPill ? '' : 'opacity-100 bg-red-500/10'),
            pressing === 'down' && 'scale-75'
          )}
          title={downTitle}
        >
          <ChevronDown className={sizeClasses[size].icon} />
        </button>
      ) : (
        <div className={cn(isPill ? 'p-1.5' : sizeClasses[size].button)}>
          <div className={cn(sizeClasses[size].icon, 'invisible')} />
        </div>
      )}
    </div>
  )
}
