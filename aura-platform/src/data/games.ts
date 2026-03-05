import type { Game } from '@/types'
import { EntityTypes, GameType } from '@/types'

function createGame(
  name: string,
  gameType: GameType,
  slug?: string,
  aliases?: string[]
): Game {
  return {
    id: `game-${(slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    gameType,
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.GAME,
    aliases,
  }
}

export const games: Game[] = [
  // FPS / Hero Shooters
  createGame('Counter-Strike 2', GameType.FPS, 'cs2', ['cs2', 'csgo', 'cs', 'counter strike']),
  createGame('Valorant', GameType.FPS, undefined, ['valo', 'val']),
  createGame('Overwatch 2', GameType.FPS, 'ow2', ['ow2', 'ow', 'overwatch']),
  createGame('Marvel Rivals', GameType.FPS, 'marvel-rivals', ['marvel', 'rivals', 'mr']),
  createGame('Call of Duty', GameType.FPS, 'cod', ['cod', 'call of duty', 'warzone']),
  createGame('Rainbow Six Siege', GameType.FPS, 'r6', ['r6', 'r6s', 'siege', 'rainbow six']),
  createGame('Halo Infinite', GameType.FPS, 'halo', ['halo']),
  createGame('Team Fortress 2', GameType.FPS, 'tf2', ['tf2']),
  createGame('Escape from Tarkov', GameType.FPS, 'tarkov', ['tarkov', 'eft']),
  createGame('XDefiant', GameType.FPS),

  // MOBA
  createGame('League of Legends', GameType.MOBA, 'lol', ['lol', 'league']),
  createGame('Dota 2', GameType.MOBA, 'dota2', ['dota', 'dota2']),
  createGame('Mobile Legends', GameType.MOBA, 'mlbb', ['mlbb', 'ml', 'mobile legends']),
  createGame('Honor of Kings', GameType.MOBA, 'hok', ['hok', 'kog', 'kings']),
  createGame('Wild Rift', GameType.MOBA, undefined, ['wr', 'wildrift']),
  createGame('Heroes of the Storm', GameType.MOBA, 'hots', ['hots']),
  createGame('Smite', GameType.MOBA),

  // Battle Royale
  createGame('Fortnite', GameType.BATTLE_ROYALE, undefined, ['fn', 'fort']),
  createGame('Apex Legends', GameType.BATTLE_ROYALE, 'apex', ['apex']),
  createGame('PUBG', GameType.BATTLE_ROYALE, undefined, ['pubg', 'playerunknown']),
  createGame('Warzone', GameType.BATTLE_ROYALE, undefined, ['wz', 'warzone']),
  createGame('Free Fire', GameType.BATTLE_ROYALE, undefined, ['ff', 'freefire']),
  createGame('Naraka: Bladepoint', GameType.BATTLE_ROYALE, 'naraka', ['naraka']),

  // Fighting
  createGame('Street Fighter 6', GameType.FIGHTING, 'sf6', ['sf6', 'sf', 'street fighter']),
  createGame('Tekken 8', GameType.FIGHTING, 'tekken8', ['tekken', 't8']),
  createGame('Mortal Kombat 1', GameType.FIGHTING, 'mk1', ['mk1', 'mk', 'mortal kombat']),
  createGame('Super Smash Bros. Ultimate', GameType.FIGHTING, 'ssbu', ['ssbu', 'smash', 'smash bros', 'ultimate']),
  createGame('Guilty Gear Strive', GameType.FIGHTING, 'ggst', ['ggst', 'strive', 'guilty gear']),
  createGame('Dragon Ball FighterZ', GameType.FIGHTING, 'dbfz', ['dbfz', 'fighterz', 'dragon ball']),
  createGame('King of Fighters XV', GameType.FIGHTING, 'kof15', ['kof', 'kof15']),
  createGame('Granblue Fantasy Versus Rising', GameType.FIGHTING, 'gbvsr', ['gbvsr', 'gbvs', 'granblue']),

  // Card Games
  createGame('Hearthstone', GameType.CARD, undefined, ['hs']),
  createGame('Magic: The Gathering Arena', GameType.CARD, 'mtga', ['mtga', 'mtg', 'magic']),
  createGame('Legends of Runeterra', GameType.CARD, 'lor', ['lor', 'runeterra']),
  createGame('Yu-Gi-Oh! Master Duel', GameType.CARD, 'master-duel', ['yugioh', 'ygo', 'master duel']),
  createGame('Marvel Snap', GameType.CARD, undefined, ['snap']),
  createGame('Pokémon TCG Live', GameType.CARD, 'pokemon-tcg', ['pokemon', 'ptcg', 'pokemon tcg']),

  // Sports / Racing
  createGame('Rocket League', GameType.SPORTS, undefined, ['rl', 'rocket']),
  createGame('FIFA / EA FC', GameType.SPORTS, 'eafc', ['fifa', 'fc', 'eafc', 'ea fc']),
  createGame('NBA 2K', GameType.SPORTS, 'nba2k', ['2k', 'nba']),
  createGame('Madden NFL', GameType.SPORTS, 'madden', ['madden', 'nfl']),
  createGame('iRacing', GameType.SPORTS, undefined, ['iracing']),
  createGame('Gran Turismo', GameType.SPORTS, 'gt', ['gt', 'gran turismo']),
  createGame('F1', GameType.SPORTS, 'f1', ['f1', 'formula 1', 'formula one']),

  // Other
  createGame('StarCraft II', GameType.OTHER, 'sc2', ['sc2', 'starcraft']),
  createGame('Teamfight Tactics', GameType.OTHER, 'tft', ['tft']),
  createGame('Age of Empires IV', GameType.OTHER, 'aoe4', ['aoe', 'aoe4', 'age of empires']),
  createGame('Clash Royale', GameType.OTHER, undefined, ['cr', 'clash']),
  createGame('Brawl Stars', GameType.OTHER, undefined, ['bs', 'brawl']),
  createGame('World of Warcraft', GameType.OTHER, 'wow', ['wow', 'warcraft']),
  createGame('osu!', GameType.OTHER, 'osu', ['osu']),
  createGame('Trackmania', GameType.OTHER, undefined, ['tm', 'trackmania']),
]
