import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { GameType } from '@/types'

const gameTypeOptions = [
  { value: GameType.FPS, label: 'FPS' },
  { value: GameType.MOBA, label: 'MOBA' },
  { value: GameType.BATTLE_ROYALE, label: 'Battle Royale' },
  { value: GameType.FIGHTING, label: 'Fighting' },
  { value: GameType.CARD, label: 'Card Game' },
  { value: GameType.SPORTS, label: 'Sports' },
  { value: GameType.OTHER, label: 'Other' },
]

interface GameFilterProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
}

export function GameFilter({ selectedTypes, onChange }: GameFilterProps) {
  const [open, setOpen] = useState(false)

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((t) => t !== type))
    } else {
      onChange([...selectedTypes, type])
    }
  }

  const clearFilters = () => {
    onChange([])
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
            {selectedTypes.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                {selectedTypes.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Game Type</span>
            {selectedTypes.length > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {gameTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => toggleType(option.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  selectedTypes.includes(option.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:border-primary/50'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {selectedTypes.length > 0 && (
        <div className="flex items-center gap-1">
          {selectedTypes.map((type) => {
            const option = gameTypeOptions.find((o) => o.value === type)
            return (
              <Badge
                key={type}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {option?.label}
                <button
                  onClick={() => toggleType(type)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
