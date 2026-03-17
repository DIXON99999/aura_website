import { useState } from 'react'
import { ChevronDown, ChevronRight, X, Gamepad2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GameType } from '@/types'

const gameTypeOptions = [
  { value: GameType.FPS, label: 'FPS', description: 'First Person Shooters' },
  { value: GameType.MOBA, label: 'MOBA', description: 'Multiplayer Online Battle Arena' },
  { value: GameType.BATTLE_ROYALE, label: 'Battle Royale', description: 'Last one standing' },
  { value: GameType.FIGHTING, label: 'Fighting', description: 'Combat games' },
  { value: GameType.CARD, label: 'Card Game', description: 'Strategy card games' },
  { value: GameType.SPORTS, label: 'Sports', description: 'Sports simulations' },
  { value: GameType.OTHER, label: 'Other', description: 'Other genres' },
]

interface FilterSectionProps {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

function FilterSection({ title, icon, count, children, defaultOpen = false }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          {count > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
              {count}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="pb-3 px-1">{children}</div>}
    </div>
  )
}

interface FilterItemProps {
  label: string
  description?: string
  selected: boolean
  onToggle: () => void
}

function FilterItem({ label, description, selected, onToggle }: FilterItemProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2 py-2 px-2 rounded-md text-sm transition-colors',
        selected ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground'
      )}
    >
      <div className={cn(
        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
        selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
      )}>
        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
      <div className="text-left">
        <div className="font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
    </button>
  )
}

interface GameSidebarFilterProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
  className?: string
}

export function GameSidebarFilter({ selectedTypes, onChange, className }: GameSidebarFilterProps) {
  const toggleType = (type: string) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type]
    onChange(newTypes)
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className={cn('bg-card rounded-lg border', className)}>
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-semibold">Filters</span>
        {selectedTypes.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="p-2">
        <FilterSection
          title="Game Type"
          icon={<Gamepad2 className="w-4 h-4 text-muted-foreground" />}
          count={selectedTypes.length}
          defaultOpen={true}
        >
          <div className="space-y-0.5">
            {gameTypeOptions.map(option => (
              <FilterItem
                key={option.value}
                label={option.label}
                description={option.description}
                selected={selectedTypes.includes(option.value)}
                onToggle={() => toggleType(option.value)}
              />
            ))}
          </div>
        </FilterSection>
      </div>
    </div>
  )
}

// Mobile filter button
interface MobileGameFilterButtonProps {
  selectedTypes: string[]
  onChange: (types: string[]) => void
}

export function MobileGameFilterButton({ selectedTypes, onChange }: MobileGameFilterButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="xl:hidden flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
      >
        <span>Filters</span>
        {selectedTypes.length > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
            {selectedTypes.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold">Filters</span>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <GameSidebarFilter selectedTypes={selectedTypes} onChange={onChange} className="border-0 rounded-none" />
          </div>
        </div>
      )}
    </>
  )
}
