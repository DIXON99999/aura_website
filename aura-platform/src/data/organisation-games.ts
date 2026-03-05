import type { OrganisationGame } from '@/types'
import { EntityTypes } from '@/types'

function createOrgGame(
  orgName: string,
  orgId: string,
  gameId: string,
  gameName: string
): OrganisationGame {
  const slug = `${orgId}-${gameId.replace('game-', '')}`
  return {
    id: `org-game-${slug}`,
    name: `${orgName} ${gameName}`,
    slug,
    organisationId: `org-${orgId}`,
    gameId,
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.ORGANISATION_GAME,
  }
}

// CS2 Organisation-Game entities
export const organisationGamesCS2: OrganisationGame[] = [
  createOrgGame('Vitality', 'vitality', 'game-cs2', 'CS2'),
  createOrgGame('Spirit', 'team-spirit', 'game-cs2', 'CS2'),
  createOrgGame('Falcons', 'falcons', 'game-cs2', 'CS2'),
  createOrgGame('BC.Game', 'bcgame', 'game-cs2', 'CS2'),
  createOrgGame('FURIA', 'furia', 'game-cs2', 'CS2'),
  createOrgGame('MOUZ', 'mouz', 'game-cs2', 'CS2'),
  createOrgGame('G2 Esports', 'g2', 'game-cs2', 'CS2'),
  createOrgGame('PARIVISION', 'parivision', 'game-cs2', 'CS2'),
  createOrgGame('Natus Vincere', 'navi', 'game-cs2', 'CS2'),
  createOrgGame('FaZe Clan', 'faze', 'game-cs2', 'CS2'),
  createOrgGame('Astralis', 'astralis', 'game-cs2', 'CS2'),
  createOrgGame('Aurora', 'aurora', 'game-cs2', 'CS2'),
  createOrgGame('Team Liquid', 'liquid', 'game-cs2', 'CS2'),
  createOrgGame('Complexity', 'col', 'game-cs2', 'CS2'),
  createOrgGame('The MongolZ', 'mongolz', 'game-cs2', 'CS2'),
  createOrgGame('BLEED Esports', 'bleed', 'game-cs2', 'CS2'),
]

// Valorant Organisation-Game entities
export const organisationGamesValorant: OrganisationGame[] = [
  // Orgs with both CS2 and Valorant
  createOrgGame('G2 Esports', 'g2', 'game-valorant', 'Valorant'),
  createOrgGame('Team Liquid', 'liquid', 'game-valorant', 'Valorant'),
  createOrgGame('FaZe Clan', 'faze', 'game-valorant', 'Valorant'),
  createOrgGame('Natus Vincere', 'navi', 'game-valorant', 'Valorant'),
  createOrgGame('Vitality', 'vitality', 'game-valorant', 'Valorant'),
  createOrgGame('FURIA', 'furia', 'game-valorant', 'Valorant'),

  // Americas
  createOrgGame('Sentinels', 'sen', 'game-valorant', 'Valorant'),
  createOrgGame('Cloud9', 'c9', 'game-valorant', 'Valorant'),
  createOrgGame('100 Thieves', '100t', 'game-valorant', 'Valorant'),
  createOrgGame('NRG Esports', 'nrg', 'game-valorant', 'Valorant'),
  createOrgGame('Evil Geniuses', 'eg', 'game-valorant', 'Valorant'),
  createOrgGame('LOUD', 'loud', 'game-valorant', 'Valorant'),
  createOrgGame('Leviatán', 'lev', 'game-valorant', 'Valorant'),
  createOrgGame('KRÜ Esports', 'kru', 'game-valorant', 'Valorant'),

  // EMEA
  createOrgGame('FNATIC', 'fnatic', 'game-valorant', 'Valorant'),
  createOrgGame('Karmine Corp', 'kc', 'game-valorant', 'Valorant'),
  createOrgGame('Team Heretics', 'heretics', 'game-valorant', 'Valorant'),
  createOrgGame('GIANTX', 'giantx', 'game-valorant', 'Valorant'),
  createOrgGame('BBL Esports', 'bbl', 'game-valorant', 'Valorant'),

  // Pacific
  createOrgGame('DRX', 'drx', 'game-valorant', 'Valorant'),
  createOrgGame('Paper Rex', 'prx', 'game-valorant', 'Valorant'),
  createOrgGame('T1', 't1', 'game-valorant', 'Valorant'),
  createOrgGame('ZETA DIVISION', 'zeta', 'game-valorant', 'Valorant'),
  createOrgGame('Gen.G', 'geng', 'game-valorant', 'Valorant'),
  createOrgGame('Talon Esports', 'talon', 'game-valorant', 'Valorant'),
  createOrgGame('Global Esports', 'ge', 'game-valorant', 'Valorant'),

  // China
  createOrgGame('EDward Gaming', 'edg', 'game-valorant', 'Valorant'),
  createOrgGame('Bilibili Gaming', 'blg', 'game-valorant', 'Valorant'),
  createOrgGame('Trace Esports', 'trace', 'game-valorant', 'Valorant'),
]

// League of Legends Organisation-Game entities
export const organisationGamesLoL: OrganisationGame[] = [
  createOrgGame('T1', 't1', 'game-lol', 'LoL'),
  createOrgGame('Gen.G', 'geng', 'game-lol', 'LoL'),
  createOrgGame('Bilibili Gaming', 'blg', 'game-lol', 'LoL'),
  createOrgGame('Cloud9', 'c9', 'game-lol', 'LoL'),
  createOrgGame('Team Liquid', 'liquid', 'game-lol', 'LoL'),
  createOrgGame('FNATIC', 'fnatic', 'game-lol', 'LoL'),
  createOrgGame('G2 Esports', 'g2', 'game-lol', 'LoL'),
  createOrgGame('100 Thieves', '100t', 'game-lol', 'LoL'),
]

// Fortnite Organisation-Game entities
export const organisationGamesFortnite: OrganisationGame[] = [
  createOrgGame('Dignitas', 'dig', 'game-fortnite', 'Fortnite'),
  createOrgGame('Falcons', 'falcons', 'game-fortnite', 'Fortnite'),
  createOrgGame('NRG Esports', 'nrg', 'game-fortnite', 'Fortnite'),
  createOrgGame('100 Thieves', '100t', 'game-fortnite', 'Fortnite'),
  createOrgGame('FaZe Clan', 'faze', 'game-fortnite', 'Fortnite'),
]

export const organisationGames: OrganisationGame[] = [
  ...organisationGamesCS2,
  ...organisationGamesValorant,
  ...organisationGamesLoL,
  ...organisationGamesFortnite,
]
