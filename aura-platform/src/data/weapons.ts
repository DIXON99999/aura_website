import type { Weapon } from '@/types'
import { EntityTypes } from '@/types'

function createWeapon(name: string, gameId: string, gameName: string, aliases?: string[]): Weapon {
  const slug = `${gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return {
    id: `weapon-${slug}`,
    name,
    slug,
    gameId,
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.WEAPON,
    aliases,
  }
}

// CS2 Weapons
const cs2Weapons = [
  // Rifles
  { name: 'AK-47', aliases: ['ak', 'ak47'] },
  { name: 'M4A4', aliases: ['m4', 'm4a4'] },
  { name: 'M4A1-S', aliases: ['m4a1', 'm4a1s', 'silencer'] },
  { name: 'AWP', aliases: ['awp', 'big green'] },
  { name: 'SG 553', aliases: ['sg', 'krieg'] },
  { name: 'AUG', aliases: ['aug'] },
  { name: 'Galil AR', aliases: ['galil'] },
  { name: 'FAMAS', aliases: ['famas'] },
  // SMGs
  { name: 'MAC-10', aliases: ['mac10', 'mac'] },
  { name: 'MP9', aliases: ['mp9'] },
  { name: 'UMP-45', aliases: ['ump'] },
  { name: 'P90', aliases: ['p90'] },
  { name: 'MP7', aliases: ['mp7'] },
  { name: 'MP5-SD', aliases: ['mp5'] },
  // Pistols
  { name: 'Desert Eagle', aliases: ['deagle', 'deag'] },
  { name: 'USP-S', aliases: ['usp'] },
  { name: 'Glock-18', aliases: ['glock'] },
  { name: 'P250', aliases: ['p250'] },
  { name: 'Five-SeveN', aliases: ['five seven', '57'] },
  { name: 'Tec-9', aliases: ['tec9'] },
  { name: 'CZ75-Auto', aliases: ['cz', 'cz75'] },
  // Heavy
  { name: 'Nova', aliases: ['nova'] },
  { name: 'XM1014', aliases: ['xm', 'auto shotty'] },
  { name: 'MAG-7', aliases: ['mag7', 'swag7'] },
  { name: 'Negev', aliases: ['negev'] },
  { name: 'M249', aliases: ['m249'] },
  // Snipers
  { name: 'Scout', aliases: ['ssg08', 'scout'] },
  { name: 'SCAR-20', aliases: ['scar', 'auto sniper'] },
  { name: 'G3SG1', aliases: ['g3'] },
].map((w) => createWeapon(w.name, 'game-cs2', 'cs2', w.aliases))

// Valorant Weapons
const valorantWeapons = [
  // Sidearms
  { name: 'Classic', aliases: [] },
  { name: 'Shorty', aliases: [] },
  { name: 'Frenzy', aliases: [] },
  { name: 'Ghost', aliases: [] },
  { name: 'Sheriff', aliases: [] },
  // SMGs
  { name: 'Stinger', aliases: [] },
  { name: 'Spectre', aliases: [] },
  // Shotguns
  { name: 'Bucky', aliases: [] },
  { name: 'Judge', aliases: [] },
  // Rifles
  { name: 'Bulldog', aliases: [] },
  { name: 'Guardian', aliases: [] },
  { name: 'Phantom', aliases: [] },
  { name: 'Vandal', aliases: [] },
  // Snipers
  { name: 'Marshal', aliases: [] },
  { name: 'Outlaw', aliases: [] },
  { name: 'Operator', aliases: ['op', 'awp'] },
  // Machine Guns
  { name: 'Ares', aliases: [] },
  { name: 'Odin', aliases: [] },
].map((w) => createWeapon(w.name, 'game-valorant', 'valorant', w.aliases))

export const weapons: Weapon[] = [
  ...cs2Weapons,
  ...valorantWeapons,
]
