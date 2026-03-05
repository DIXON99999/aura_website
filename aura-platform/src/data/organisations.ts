import type { Organisation } from '@/types'
import { EntityTypes } from '@/types'

function createOrganisation(name: string, slug?: string): Organisation {
  return {
    id: `org-${(slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.ORGANISATION,
  }
}

export const organisations: Organisation[] = [
  // Multi-game orgs (CS2 + Valorant)
  createOrganisation('Vitality'),
  createOrganisation('Spirit', 'team-spirit'),
  createOrganisation('Falcons'),
  createOrganisation('BC.Game', 'bcgame'),
  createOrganisation('FURIA'),
  createOrganisation('MOUZ'),
  createOrganisation('G2 Esports', 'g2'),
  createOrganisation('PARIVISION'),
  createOrganisation('Natus Vincere', 'navi'),
  createOrganisation('FaZe Clan', 'faze'),
  createOrganisation('Astralis'),
  createOrganisation('Aurora'),
  createOrganisation('Team Liquid', 'liquid'),
  createOrganisation('Complexity', 'col'),
  createOrganisation('The MongolZ', 'mongolz'),
  createOrganisation('BLEED Esports', 'bleed'),

  // Valorant orgs
  createOrganisation('Sentinels', 'sen'),
  createOrganisation('Cloud9', 'c9'),
  createOrganisation('100 Thieves', '100t'),
  createOrganisation('NRG Esports', 'nrg'),
  createOrganisation('Evil Geniuses', 'eg'),
  createOrganisation('LOUD'),
  createOrganisation('FNATIC', 'fnatic'),
  createOrganisation('DRX'),
  createOrganisation('Paper Rex', 'prx'),
  createOrganisation('EDward Gaming', 'edg'),
  createOrganisation('T1'),
  createOrganisation('Karmine Corp', 'kc'),
  createOrganisation('KRÜ Esports', 'kru'),
  createOrganisation('ZETA DIVISION', 'zeta'),
  createOrganisation('Gen.G', 'geng'),
  createOrganisation('Bilibili Gaming', 'blg'),
  createOrganisation('Leviatán', 'lev'),
  createOrganisation('Team Heretics', 'heretics'),
  createOrganisation('GIANTX', 'giantx'),
  createOrganisation('BBL Esports', 'bbl'),
  createOrganisation('Trace Esports', 'trace'),
  createOrganisation('Global Esports', 'ge'),
  createOrganisation('Talon Esports', 'talon'),
  createOrganisation('Dignitas', 'dig'),
]
