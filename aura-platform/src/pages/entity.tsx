import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react'
import { useAuraStore, useAuthStore } from '@/stores'
import { useVisitorId } from '@/hooks'
import { cn } from '@/lib/utils'
import { VoteDirection, EntityTypes } from '@/types'
import type { Entity, EntityType, Country, Player, Game, Organisation, OrganisationGame, Peripheral, Role, Weapon, Character, Brand } from '@/types'

function getFlagUrl(countryCode: string): string {
  return `https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`
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
    [EntityTypes.BRAND]: 'brand',
  }
  return `/${typeMap[entity.type] || 'entity'}/${entity.slug}`
}

interface AssociationGroup {
  label: string
  entities: Entity[]
}

function MiniCard({ entity }: { entity: Entity }) {
  const renderImage = () => {
    if (entity.type === EntityTypes.COUNTRY) {
      return (
        <img
          src={`https://flagcdn.com/w40/${(entity as Country).flagCode.toLowerCase()}.png`}
          alt={entity.name}
          className="w-full h-full object-cover"
        />
      )
    }
    if (entity.imageUrl) {
      return (
        <img
          src={entity.imageUrl}
          alt={entity.name}
          className="w-full h-full object-cover"
        />
      )
    }
    return (
      <span className="text-xs font-bold text-muted-foreground">
        {entity.name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <Link
      to={getEntityUrl(entity)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card/50 border border-border hover:border-primary/50 transition-colors"
    >
      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
        {renderImage()}
      </div>
      <span className="text-xs font-medium truncate max-w-[100px]">{entity.name}</span>
      <span className={cn(
        'text-xs tabular-nums',
        entity.auraScore > 0 ? 'text-green-500' : entity.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'
      )}>
        {entity.auraScore}
      </span>
    </Link>
  )
}

interface Stores {
  countries: Record<string, Country>
  games: Record<string, Game>
  organisations: Record<string, Organisation>
  organisationGames: Record<string, OrganisationGame>
  players: Record<string, Player>
  peripherals: Record<string, Peripheral>
  roles: Record<string, Role>
  weapons: Record<string, Weapon>
  characters: Record<string, Character>
  brands: Record<string, Brand>
}

function getEntityFromStores(
  entityType: string,
  slug: string,
  stores: Stores
): { entity: Entity | undefined; type: EntityType } {
  const { countries, games, organisations, organisationGames, players, peripherals, roles, weapons, characters } = stores

  switch (entityType) {
    case 'country':
      return { entity: Object.values(countries).find(e => e.slug === slug), type: EntityTypes.COUNTRY }
    case 'game':
      return { entity: Object.values(games).find(e => e.slug === slug), type: EntityTypes.GAME }
    case 'organisation':
      return { entity: Object.values(organisations).find(e => e.slug === slug), type: EntityTypes.ORGANISATION }
    case 'team':
      return { entity: Object.values(organisationGames).find(e => e.slug === slug), type: EntityTypes.ORGANISATION_GAME }
    case 'player':
      return { entity: Object.values(players).find(e => e.slug === slug), type: EntityTypes.PLAYER }
    case 'peripheral':
      return { entity: Object.values(peripherals).find(e => e.slug === slug), type: EntityTypes.PERIPHERAL }
    case 'role':
      return { entity: Object.values(roles).find(e => e.slug === slug), type: EntityTypes.ROLE }
    case 'weapon':
      return { entity: Object.values(weapons).find(e => e.slug === slug), type: EntityTypes.WEAPON }
    case 'character':
      return { entity: Object.values(characters).find(e => e.slug === slug), type: EntityTypes.CHARACTER }
    default:
      return { entity: undefined, type: EntityTypes.PLAYER }
  }
}

function getAssociations(entity: Entity, stores: Stores): AssociationGroup[] {
  const { countries, games, organisations, organisationGames, players, roles, weapons, characters, brands, peripherals } = stores
  const groups: AssociationGroup[] = []
  const TOP_N = 10

  const sortByAura = (a: Entity, b: Entity) => b.auraScore - a.auraScore

  switch (entity.type) {
    case EntityTypes.COUNTRY: {
      const countryPlayers = Object.values(players)
        .filter(p => p.countryId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)
      if (countryPlayers.length > 0) {
        groups.push({ label: 'Players', entities: countryPlayers })
      }
      break
    }

    case EntityTypes.GAME: {
      const gameTeams = Object.values(organisationGames)
        .filter(og => og.gameId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)
      const gamePlayers = Object.values(players)
        .filter(p => p.mainGameId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)
      const gameRoles = Object.values(roles)
        .filter(r => r.gameId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)
      const gameWeapons = Object.values(weapons)
        .filter(w => w.gameId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)
      const gameCharacters = Object.values(characters)
        .filter(c => c.gameId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)

      if (gameTeams.length > 0) groups.push({ label: 'Teams', entities: gameTeams })
      if (gamePlayers.length > 0) groups.push({ label: 'Players', entities: gamePlayers })
      if (gameRoles.length > 0) groups.push({ label: 'Roles', entities: gameRoles })
      if (gameCharacters.length > 0) groups.push({ label: 'Characters', entities: gameCharacters })
      if (gameWeapons.length > 0) groups.push({ label: 'Weapons', entities: gameWeapons })
      break
    }

    case EntityTypes.ORGANISATION: {
      const orgTeams = Object.values(organisationGames)
        .filter(og => og.organisationId === entity.id)
        .sort(sortByAura)
      const orgPlayers = Object.values(players)
        .filter(p => p.organisationId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)

      if (orgTeams.length > 0) groups.push({ label: 'Teams', entities: orgTeams })
      if (orgPlayers.length > 0) groups.push({ label: 'Players', entities: orgPlayers })
      break
    }

    case EntityTypes.ORGANISATION_GAME: {
      const orgGame = entity as OrganisationGame
      const org = organisations[orgGame.organisationId]
      const game = games[orgGame.gameId]
      const teamPlayers = Object.values(players)
        .filter(p => p.organisationId === orgGame.organisationId && p.mainGameId === orgGame.gameId)
        .sort(sortByAura)
        .slice(0, TOP_N)

      if (org) groups.push({ label: 'Organisation', entities: [org] })
      if (game) groups.push({ label: 'Game', entities: [game] })
      if (teamPlayers.length > 0) groups.push({ label: 'Players', entities: teamPlayers })
      break
    }

    case EntityTypes.PLAYER: {
      const player = entity as Player
      const country = countries[player.countryId]
      const org = player.organisationId ? organisations[player.organisationId] : null
      const game = games[player.mainGameId]

      if (country) groups.push({ label: 'Country', entities: [country] })
      if (org) groups.push({ label: 'Organisation', entities: [org] })
      if (game) groups.push({ label: 'Game', entities: [game] })
      break
    }

    case EntityTypes.PERIPHERAL: {
      const peripheral = entity as Peripheral
      const brand = brands[peripheral.brandId]
      if (brand) groups.push({ label: 'Brand', entities: [brand] })
      break
    }

    case EntityTypes.ROLE:
    case EntityTypes.WEAPON:
    case EntityTypes.CHARACTER: {
      const gameId = (entity as Role | Weapon | Character).gameId
      const game = games[gameId]
      if (game) groups.push({ label: 'Game', entities: [game] })
      break
    }

    case EntityTypes.BRAND: {
      const brandPeripherals = Object.values(peripherals)
        .filter(p => p.brandId === entity.id)
        .sort(sortByAura)
        .slice(0, TOP_N)
      if (brandPeripherals.length > 0) groups.push({ label: 'Peripherals', entities: brandPeripherals })
      break
    }
  }

  return groups
}

export function EntityPage() {
  const { entityType, slug } = useParams<{ entityType: string; slug: string }>()
  const visitorId = useVisitorId()
  const authUser = useAuthStore((s) => s.user)
  const vote = useAuraStore((s) => s.vote)
  const removeVote = useAuraStore((s) => s.removeVote)
  const getVisitorVote = useAuraStore((s) => s.getVisitorVote)

  const countries = useAuraStore((s) => s.countries)
  const games = useAuraStore((s) => s.games)
  const regions = useAuraStore((s) => s.regions)
  const organisations = useAuraStore((s) => s.organisations)
  const organisationGames = useAuraStore((s) => s.organisationGames)
  const players = useAuraStore((s) => s.players)
  const peripherals = useAuraStore((s) => s.peripherals)
  const roles = useAuraStore((s) => s.roles)
  const weapons = useAuraStore((s) => s.weapons)
  const characters = useAuraStore((s) => s.characters)
  const brands = useAuraStore((s) => s.brands)

  const stores: Stores = { countries, games, organisations, organisationGames, players, peripherals, roles, weapons, characters, brands }

  if (!entityType || !slug) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Not Found</h1>
        <Link to="/" className="text-primary hover:underline">Go back home</Link>
      </div>
    )
  }

  const { entity, type } = getEntityFromStores(entityType, slug, stores)

  const associations = useMemo(() => {
    if (!entity) return []
    return getAssociations(entity, stores)
  }, [entity, stores])

  if (!entity) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Entity Not Found</h1>
        <Link to="/" className="text-primary hover:underline">Go back home</Link>
      </div>
    )
  }

  const currentVote = visitorId ? getVisitorVote(visitorId, entity.id, type) : undefined

  // Check if this is the user's own profile
  const isOwnProfile = entity.type === EntityTypes.PLAYER &&
    (entity as Player).isUserProfile &&
    authUser &&
    (entity as Player).visitorId === authUser.id

  const handleVote = (direction: VoteDirection) => {
    if (!visitorId || isOwnProfile) return
    if (currentVote?.direction === direction) {
      removeVote(visitorId, entity.id, type)
    } else {
      vote(visitorId, entity.id, type, direction)
    }
  }

  const renderImage = () => {
    if (entity.type === EntityTypes.COUNTRY) {
      return (
        <img
          src={getFlagUrl((entity as Country).flagCode)}
          alt={entity.name}
          className="w-full h-full object-cover"
        />
      )
    }
    if (entity.imageUrl) {
      return (
        <img
          src={entity.imageUrl}
          alt={entity.name}
          className="w-full h-full object-cover"
        />
      )
    }
    return (
      <span className="text-4xl font-bold text-muted-foreground">
        {entity.name.charAt(0).toUpperCase()}
      </span>
    )
  }

  const renderSubtitle = () => {
    switch (entity.type) {
      case EntityTypes.PLAYER: {
        const player = entity as Player
        const region = player.regionId ? regions[player.regionId] : null
        const game = player.mainGameId ? games[player.mainGameId] : null
        if (region && game) {
          return <p className="text-muted-foreground">{game.name} • {region.name}</p>
        }
        return null
      }
      case EntityTypes.ORGANISATION_GAME: {
        const orgGame = entity as OrganisationGame
        const org = organisations[orgGame.organisationId]
        const game = games[orgGame.gameId]
        return <p className="text-muted-foreground">{org?.name} - {game?.name}</p>
      }
      case EntityTypes.GAME: {
        const game = entity as Game
        return <p className="text-muted-foreground capitalize">{game.gameType.toLowerCase().replace('_', ' ')}</p>
      }
      case EntityTypes.ROLE:
      case EntityTypes.WEAPON:
      case EntityTypes.CHARACTER: {
        const gameId = (entity as Role | Weapon | Character).gameId
        const game = games[gameId]
        const typeLabel = entity.type === EntityTypes.ROLE ? 'Role' : entity.type === EntityTypes.WEAPON ? 'Weapon' : 'Character'
        return <p className="text-muted-foreground">{typeLabel} - {game?.name}</p>
      }
      case EntityTypes.PERIPHERAL: {
        const peripheral = entity as Peripheral
        return <p className="text-muted-foreground capitalize">{peripheral.peripheralType.toLowerCase()}</p>
      }
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center">
          <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center overflow-hidden mb-6">
            {renderImage()}
          </div>

          <h1 className="text-3xl font-bold mb-2">{entity.name}</h1>
          {renderSubtitle()}

          {associations.length > 0 && (
            <div className="w-full mt-8">
              <div className="flex flex-wrap gap-2 justify-center">
                {associations
                  .flatMap((group) => group.entities)
                  .sort((a, b) => b.auraScore - a.auraScore)
                  .slice(0, 10)
                  .map((e) => (
                    <MiniCard key={e.id} entity={e} />
                  ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-8">
            {!isOwnProfile && (
              <button
                onClick={() => handleVote(VoteDirection.UP)}
                disabled={!visitorId}
                className={cn(
                  'p-3 rounded-lg transition-colors',
                  currentVote?.direction === VoteDirection.UP
                    ? 'text-green-500 bg-green-500/20'
                    : 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10'
                )}
              >
                <ChevronUp className="w-8 h-8" />
              </button>
            )}
            <div className={cn(
              'text-3xl font-bold tabular-nums min-w-[6ch] text-center',
              entity.auraScore > 0 ? 'text-green-500' : entity.auraScore < 0 ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {entity.auraScore}
            </div>
            {!isOwnProfile && (
              <button
                onClick={() => handleVote(VoteDirection.DOWN)}
                disabled={!visitorId}
                className={cn(
                  'p-3 rounded-lg transition-colors',
                  currentVote?.direction === VoteDirection.DOWN
                    ? 'text-red-500 bg-red-500/20'
                    : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
                )}
              >
                <ChevronDown className="w-8 h-8" />
              </button>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-2">Aura Score</p>
        </div>
      </div>
    </div>
  )
}
