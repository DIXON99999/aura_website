import type { Region } from '@/types'
import { EntityTypes } from '@/types'

function createRegion(
  name: string,
  gameId: string,
  slug?: string,
  aliases?: string[]
): Region {
  const regionSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return {
    id: `region-${gameId}-${regionSlug}`,
    name,
    slug: `${gameId}-${regionSlug}`,
    gameId: `game-${gameId}`,
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.REGION,
    aliases,
  }
}

// Common regions used across many games
const commonRegions = (gameId: string): Region[] => [
  createRegion('North America', gameId, 'na', ['na', 'north america']),
  createRegion('Europe', gameId, 'eu', ['eu', 'europe', 'emea']),
  createRegion('Asia Pacific', gameId, 'apac', ['apac', 'asia', 'asia pacific']),
  createRegion('Latin America', gameId, 'latam', ['latam', 'south america', 'sa']),
  createRegion('Oceania', gameId, 'oce', ['oce', 'oceania', 'australia']),
]

// Extended regions for games with larger regional structures
const extendedRegions = (gameId: string): Region[] => [
  ...commonRegions(gameId),
  createRegion('Korea', gameId, 'kr', ['kr', 'korea', 'south korea']),
  createRegion('China', gameId, 'cn', ['cn', 'china']),
  createRegion('Japan', gameId, 'jp', ['jp', 'japan']),
  createRegion('Southeast Asia', gameId, 'sea', ['sea', 'southeast asia']),
  createRegion('Brazil', gameId, 'br', ['br', 'brazil']),
]

export const regions: Region[] = [
  // Valorant - VCT regions
  createRegion('Americas', 'valorant', 'americas', ['americas', 'na', 'latam', 'br']),
  createRegion('EMEA', 'valorant', 'emea', ['emea', 'eu', 'europe', 'mena', 'cis']),
  createRegion('Pacific', 'valorant', 'pacific', ['pacific', 'apac', 'kr', 'jp', 'sea']),
  createRegion('China', 'valorant', 'cn', ['cn', 'china']),

  // CS2 - Major regions
  createRegion('Europe', 'cs2', 'eu', ['eu', 'europe']),
  createRegion('CIS', 'cs2', 'cis', ['cis', 'russia', 'eastern europe']),
  createRegion('North America', 'cs2', 'na', ['na', 'north america']),
  createRegion('South America', 'cs2', 'sa', ['sa', 'south america', 'brazil']),
  createRegion('Asia', 'cs2', 'asia', ['asia', 'apac']),
  createRegion('Oceania', 'cs2', 'oce', ['oce', 'oceania', 'australia']),

  // League of Legends - Major leagues
  createRegion('LCK (Korea)', 'lol', 'lck', ['lck', 'korea', 'kr']),
  createRegion('LPL (China)', 'lol', 'lpl', ['lpl', 'china', 'cn']),
  createRegion('LEC (Europe)', 'lol', 'lec', ['lec', 'eu', 'europe']),
  createRegion('LCS (North America)', 'lol', 'lcs', ['lcs', 'na', 'north america']),
  createRegion('PCS (Pacific)', 'lol', 'pcs', ['pcs', 'pacific', 'taiwan', 'sea']),
  createRegion('VCS (Vietnam)', 'lol', 'vcs', ['vcs', 'vietnam']),
  createRegion('CBLOL (Brazil)', 'lol', 'cblol', ['cblol', 'brazil', 'br']),
  createRegion('LLA (Latin America)', 'lol', 'lla', ['lla', 'latam']),
  createRegion('LJL (Japan)', 'lol', 'ljl', ['ljl', 'japan', 'jp']),

  // Dota 2
  ...extendedRegions('dota2'),

  // Overwatch 2
  ...commonRegions('ow2'),
  createRegion('Korea', 'ow2', 'kr', ['kr', 'korea']),

  // Call of Duty
  ...commonRegions('cod'),

  // Rainbow Six Siege
  ...extendedRegions('r6'),

  // Apex Legends
  ...commonRegions('apex'),

  // Fortnite
  ...commonRegions('fortnite'),

  // Rocket League
  ...commonRegions('rocket-league'),
  createRegion('Middle East & North Africa', 'rocket-league', 'mena', ['mena']),

  // Fighting games - typically global/regional
  ...commonRegions('sf6'),
  createRegion('Japan', 'sf6', 'jp', ['jp', 'japan']),
  ...commonRegions('tekken8'),
  createRegion('Korea', 'tekken8', 'kr', ['kr', 'korea']),
  createRegion('Japan', 'tekken8', 'jp', ['jp', 'japan']),
  ...commonRegions('ssbu'),
  createRegion('Japan', 'ssbu', 'jp', ['jp', 'japan']),

  // Mobile Legends
  createRegion('Southeast Asia', 'mlbb', 'sea', ['sea', 'southeast asia']),
  createRegion('Indonesia', 'mlbb', 'id', ['id', 'indonesia']),
  createRegion('Philippines', 'mlbb', 'ph', ['ph', 'philippines']),
  createRegion('Malaysia/Singapore', 'mlbb', 'mysg', ['mysg', 'malaysia', 'singapore']),
  createRegion('Latin America', 'mlbb', 'latam', ['latam']),
  createRegion('MENA', 'mlbb', 'mena', ['mena', 'middle east']),

  // PUBG
  ...extendedRegions('pubg'),

  // StarCraft II
  createRegion('Korea', 'sc2', 'kr', ['kr', 'korea']),
  createRegion('Europe', 'sc2', 'eu', ['eu', 'europe']),
  createRegion('North America', 'sc2', 'na', ['na', 'north america']),
  createRegion('China', 'sc2', 'cn', ['cn', 'china']),
]
