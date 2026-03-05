import { Link } from 'react-router-dom'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuraStore, useAuthStore } from '@/stores'
import { useVisitorId } from '@/hooks'
import type { Entity, EntityType, Country, Game, OrganisationGame, Player, Peripheral, Role, Weapon, Character } from '@/types'
import { VoteDirection, EntityTypes, PeripheralType } from '@/types'

const gameTypeLabels: Record<string, string> = {
  FPS: 'FPS',
  MOBA: 'MOBA',
  FIGHTING: 'Fighting',
  CARD: 'Card Game',
  BATTLE_ROYALE: 'Battle Royale',
  SPORTS: 'Sports',
  OTHER: 'Other',
}

const peripheralTypeLabels: Record<string, string> = {
  [PeripheralType.MOUSE]: 'Mouse',
  [PeripheralType.MOUSEPAD]: 'Mousepad',
  [PeripheralType.KEYBOARD]: 'Keyboard',
  [PeripheralType.HEADSET]: 'Headset',
  [PeripheralType.MONITOR]: 'Monitor',
  [PeripheralType.CONTROLLER]: 'Controller',
}

function getFlagUrl(countryCode: string): string {
  return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`
}

function getEntityUrl(entity: Entity): string {
  const typeMap: Record<string, string> = {
    [EntityTypes.COUNTRY]: 'country',
    [EntityTypes.GAME]: 'game',
    [EntityTypes.ORGANISATION]: 'organisation',
    [EntityTypes.ORGANISATION_GAME]: 'team',
    [EntityTypes.PLAYER]: 'player',
    [EntityTypes.PERIPHERAL]: 'peripheral',
    [EntityTypes.ROLE]: 'role',
    [EntityTypes.WEAPON]: 'weapon',
    [EntityTypes.CHARACTER]: 'character',
  }
  const urlType = typeMap[entity.type] || 'entity'
  return `/${urlType}/${entity.slug}`
}

interface LeaderboardRowProps {
  entity: Entity
  rank: number
  entityType: EntityType
  showType?: boolean
}

export function LeaderboardRow({ entity, rank, entityType, showType }: LeaderboardRowProps) {
  const visitorId = useVisitorId()
  const authUser = useAuthStore((s) => s.user)
  const vote = useAuraStore((s) => s.vote)
  const removeVote = useAuraStore((s) => s.removeVote)
  const getVisitorVote = useAuraStore((s) => s.getVisitorVote)
  const games = useAuraStore((s) => s.games)
  const organisations = useAuraStore((s) => s.organisations)
  const countries = useAuraStore((s) => s.countries)

  const currentVote = visitorId ? getVisitorVote(visitorId, entity.id, entityType) : undefined

  // Check if this is the user's own profile
  const isOwnProfile = entity.type === EntityTypes.PLAYER &&
    (entity as Player).isUserProfile &&
    authUser &&
    (entity as Player).visitorId === authUser.id

  const handleVote = (direction: VoteDirection) => {
    if (!visitorId || isOwnProfile) return

    if (currentVote?.direction === direction) {
      removeVote(visitorId, entity.id, entityType)
    } else {
      vote(visitorId, entity.id, entityType, direction)
    }
  }

  const rankColor =
    rank === 1
      ? 'text-yellow-500'
      : rank === 2
        ? 'text-gray-400'
        : rank === 3
          ? 'text-amber-600'
          : 'text-muted-foreground'

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border hover:border-primary/50 transition-colors group">
      <Link to={getEntityUrl(entity)} className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn('w-6 text-center font-bold text-sm', rankColor)}>
          {rank}
        </div>

        <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {entity.type === EntityTypes.COUNTRY ? (
            <img
              src={getFlagUrl((entity as Country).flagCode)}
              alt={entity.name}
              className="w-full h-full object-cover"
            />
          ) : entity.imageUrl ? (
            <img
              src={entity.imageUrl}
              alt={entity.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">
              {entity.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
        {entity.type === EntityTypes.PLAYER ? (() => {
          const player = entity as Player
          const country = countries[player.countryId]
          const org = player.organisationId ? organisations[player.organisationId] : null
          const game = games[player.mainGameId]
          return (
            <>
              <h3 className="font-semibold truncate text-sm">{entity.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {country && (
                  <span className="flex items-center gap-1">
                    <img
                      src={getFlagUrl(country.flagCode)}
                      alt={country.name}
                      className="w-4 h-3 object-cover rounded-sm"
                    />
                  </span>
                )}
                {org && <span>{org.name}</span>}
                {!org && <span className="italic">Free Agent</span>}
                {game && <span>• {game.name}</span>}
              </div>
            </>
          )
        })() : entity.type === EntityTypes.ORGANISATION_GAME ? (
          <>
            <h3 className="font-semibold truncate text-sm">
              {organisations[(entity as OrganisationGame).organisationId]?.name || entity.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {games[(entity as OrganisationGame).gameId]?.name || 'Unknown Game'}
            </p>
          </>
        ) : entity.type === EntityTypes.PERIPHERAL ? (
          <>
            <h3 className="font-semibold truncate text-sm">{entity.name}</h3>
            <p className="text-xs text-muted-foreground">
              {peripheralTypeLabels[(entity as Peripheral).peripheralType] || (entity as Peripheral).peripheralType}
            </p>
          </>
        ) : entity.type === EntityTypes.ROLE ? (
          <>
            <h3 className="font-semibold truncate text-sm">{entity.name}</h3>
            <p className="text-xs text-muted-foreground">
              Role • {games[(entity as Role).gameId]?.name || 'Unknown Game'}
            </p>
          </>
        ) : entity.type === EntityTypes.WEAPON ? (
          <>
            <h3 className="font-semibold truncate text-sm">{entity.name}</h3>
            <p className="text-xs text-muted-foreground">
              Weapon • {games[(entity as Weapon).gameId]?.name || 'Unknown Game'}
            </p>
          </>
        ) : entity.type === EntityTypes.CHARACTER ? (
          <>
            <h3 className="font-semibold truncate text-sm">{entity.name}</h3>
            <p className="text-xs text-muted-foreground">
              Character • {games[(entity as Character).gameId]?.name || 'Unknown Game'}
            </p>
          </>
        ) : (
          <>
            <h3 className="font-semibold truncate text-sm">{entity.name}</h3>
            {entity.type === EntityTypes.GAME && (
              <p className="text-xs text-muted-foreground">
                {gameTypeLabels[(entity as Game).gameType]}
              </p>
            )}
            {showType && entity.type !== EntityTypes.GAME && (
              <p className="text-xs text-muted-foreground capitalize">
                {entityType.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            )}
          </>
        )}
        </div>
      </Link>

      <div className="flex items-center gap-1">
        {!isOwnProfile && (
          <button
            onClick={() => handleVote(VoteDirection.UP)}
            disabled={!visitorId}
            className={cn(
              'p-1.5 rounded transition-colors',
              currentVote?.direction === VoteDirection.UP
                ? 'text-green-500 bg-green-500/20'
                : 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10'
            )}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
        <div className={cn(
          'text-sm font-bold tabular-nums min-w-[4ch] text-center',
          entity.auraScore > 0 ? 'text-green-500' : entity.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'
        )}>
          {entity.auraScore}
        </div>
        {!isOwnProfile && (
          <button
            onClick={() => handleVote(VoteDirection.DOWN)}
            disabled={!visitorId}
            className={cn(
              'p-1.5 rounded transition-colors',
              currentVote?.direction === VoteDirection.DOWN
                ? 'text-red-500 bg-red-500/20'
                : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
            )}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
