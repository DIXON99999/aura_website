import type { Role } from '@/types'
import { EntityTypes } from '@/types'

function createRole(name: string, gameId: string, gameName: string): Role {
  const slug = `${gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return {
    id: `role-${slug}`,
    name,
    slug,
    gameId,
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.ROLE,
  }
}

// CS2 Roles
const cs2Roles = [
  'Entry Fragger',
  'AWPer',
  'In-Game Leader',
  'Support',
  'Lurker',
  'Rifler',
].map((name) => createRole(name, 'game-cs2', 'cs2'))

// Valorant Roles
const valorantRoles = [
  'Duelist',
  'Controller',
  'Initiator',
  'Sentinel',
].map((name) => createRole(name, 'game-valorant', 'valorant'))

// League of Legends Roles
const lolRoles = [
  'Top',
  'Jungle',
  'Mid',
  'ADC',
  'Support',
].map((name) => createRole(name, 'game-lol', 'lol'))

// Overwatch Roles
const overwatchRoles = [
  'Tank',
  'Damage',
  'Support',
].map((name) => createRole(name, 'game-ow2', 'ow2'))

// Marvel Rivals Roles
const marvelRivalsRoles = [
  'Vanguard',
  'Duelist',
  'Strategist',
].map((name) => createRole(name, 'game-marvel-rivals', 'marvel-rivals'))

export const roles: Role[] = [
  ...cs2Roles,
  ...valorantRoles,
  ...lolRoles,
  ...overwatchRoles,
  ...marvelRivalsRoles,
]
