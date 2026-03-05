import type { Character } from '@/types'
import { EntityTypes } from '@/types'

function createCharacter(name: string, gameId: string, gameName: string, aliases?: string[]): Character {
  const slug = `${gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return {
    id: `character-${slug}`,
    name,
    slug,
    gameId,
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.CHARACTER,
    aliases,
  }
}

// Valorant Agents
const valorantCharacters = [
  // Duelists
  'Jett', 'Phoenix', 'Reyna', 'Raze', 'Yoru', 'Neon', 'Iso', 'Waylay',
  // Controllers
  'Brimstone', 'Omen', 'Viper', 'Astra', 'Harbor', 'Clove',
  // Initiators
  'Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko', 'Tejo',
  // Sentinels
  'Sage', 'Cypher', 'Killjoy', 'Chamber', 'Deadlock', 'Vyse',
].map((name) => createCharacter(name, 'game-valorant', 'valorant'))

// Overwatch 2 Heroes
const overwatchCharacters = [
  // Tanks
  'D.Va', 'Doomfist', 'Junker Queen', 'Mauga', 'Orisa', 'Ramattra', 'Reinhardt', 'Roadhog', 'Sigma', 'Winston', 'Wrecking Ball', 'Zarya', 'Hazard',
  // Damage
  'Ashe', 'Bastion', 'Cassidy', 'Echo', 'Genji', 'Hanzo', 'Junkrat', 'Mei', 'Pharah', 'Reaper', 'Sojourn', 'Soldier: 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Venture', 'Widowmaker',
  // Support
  'Ana', 'Baptiste', 'Brigitte', 'Illari', 'Juno', 'Kiriko', 'Lifeweaver', 'Lúcio', 'Mercy', 'Moira', 'Zenyatta',
].map((name) => createCharacter(name, 'game-ow2', 'ow2'))

// League of Legends Champions (popular ones)
const lolCharacters = [
  // Top
  'Aatrox', 'Camille', 'Darius', 'Fiora', 'Garen', 'Gwen', 'Irelia', 'Jax', 'K\'Sante', 'Mordekaiser', 'Renekton', 'Riven', 'Sett', 'Yone',
  // Jungle
  'Elise', 'Evelynn', 'Graves', 'Hecarim', 'Jarvan IV', 'Kha\'Zix', 'Lee Sin', 'Lillia', 'Nidalee', 'Rek\'Sai', 'Viego', 'Vi',
  // Mid
  'Ahri', 'Akali', 'Azir', 'Corki', 'Faker\'s Ryze', 'Katarina', 'LeBlanc', 'Orianna', 'Syndra', 'Sylas', 'Twisted Fate', 'Viktor', 'Yasuo', 'Zed', 'Zoe',
  // ADC
  'Aphelios', 'Caitlyn', 'Draven', 'Ezreal', 'Jhin', 'Jinx', 'Kai\'Sa', 'Lucian', 'Miss Fortune', 'Samira', 'Varus', 'Xayah', 'Zeri',
  // Support
  'Alistar', 'Braum', 'Leona', 'Lulu', 'Nami', 'Nautilus', 'Rakan', 'Renata Glasc', 'Thresh', 'Yuumi',
].map((name) => createCharacter(name, 'game-lol', 'lol'))

// Marvel Rivals Heroes
const marvelRivalsCharacters = [
  // Vanguards
  'Captain America', 'Doctor Strange', 'Groot', 'Hulk', 'Magneto', 'Peni Parker', 'Thor', 'Venom',
  // Duelists
  'Black Panther', 'Black Widow', 'Hawkeye', 'Hela', 'Human Torch', 'Iron Fist', 'Iron Man', 'Magik', 'Moon Knight', 'Mister Fantastic', 'Namor', 'Psylocke', 'Scarlet Witch', 'Spider-Man', 'Squirrel Girl', 'Star-Lord', 'Storm', 'The Punisher', 'Winter Soldier', 'Wolverine',
  // Strategists
  'Adam Warlock', 'Cloak & Dagger', 'Invisible Woman', 'Jeff the Land Shark', 'Loki', 'Luna Snow', 'Mantis', 'Rocket Raccoon',
].map((name) => createCharacter(name, 'game-marvel-rivals', 'marvel-rivals'))

export const characters: Character[] = [
  ...valorantCharacters,
  ...overwatchCharacters,
  ...lolCharacters,
  ...marvelRivalsCharacters,
]
