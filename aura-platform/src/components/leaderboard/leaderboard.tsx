import { useMemo } from 'react'
import { LeaderboardRow } from './leaderboard-row'
import type { Entity, EntityType } from '@/types'
import type { SortDirection } from './sort-button'

interface LeaderboardProps {
  entities: Entity[]
  entityType: EntityType | 'mixed'
  searchQuery?: string
  emptyMessage?: string
  sortDirection?: SortDirection
}

export function Leaderboard({
  entities,
  entityType,
  searchQuery = '',
  emptyMessage = 'No entities found',
  sortDirection = 'desc',
}: LeaderboardProps) {
  const filteredAndSorted = useMemo(() => {
    let result = [...entities]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((e) =>
        e.name.toLowerCase().includes(query) ||
        e.slug.toLowerCase().includes(query) ||
        e.aliases?.some((a) => a.toLowerCase().includes(query))
      )
    }

    result.sort((a, b) =>
      sortDirection === 'desc'
        ? b.auraScore - a.auraScore
        : a.auraScore - b.auraScore
    )

    return result
  }, [entities, searchQuery, sortDirection])

  if (filteredAndSorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg">{emptyMessage}</p>
        {searchQuery && (
          <p className="text-sm mt-2">Try a different search term</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {filteredAndSorted.map((entity, index) => (
        <LeaderboardRow
          key={entity.id}
          entity={entity}
          rank={index + 1}
          entityType={entityType === 'mixed' ? entity.type : entityType}
          showType={entityType === 'mixed'}
        />
      ))}
    </div>
  )
}
