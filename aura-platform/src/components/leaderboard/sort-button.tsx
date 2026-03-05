import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SortDirection = 'desc' | 'asc'

interface SortButtonProps {
  direction: SortDirection
  onChange: (direction: SortDirection) => void
}

export function SortButton({ direction, onChange }: SortButtonProps) {
  const toggle = () => {
    onChange(direction === 'desc' ? 'asc' : 'desc')
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} className="gap-2">
      {direction === 'desc' ? (
        <>
          <ArrowDownWideNarrow className="w-4 h-4" />
          <span className="hidden sm:inline">Highest</span>
        </>
      ) : (
        <>
          <ArrowUpWideNarrow className="w-4 h-4" />
          <span className="hidden sm:inline">Lowest</span>
        </>
      )}
    </Button>
  )
}
