import type { Player } from '@/types'
import { EntityTypes } from '@/types'

// Country name to country ID mapping
const countryMap: Record<string, string> = {
  'France': 'country-fr',
  'Russia': 'country-ru',
  'Bosnia and Herzegovina': 'country-ba',
  'Ukraine': 'country-ua',
  'Estonia': 'country-ee',
  'Brazil': 'country-br',
  'Latvia': 'country-lv',
  'Sweden': 'country-se',
  'Israel': 'country-il',
  'Finland': 'country-fi',
  'Canada': 'country-ca',
  'Slovakia': 'country-sk',
  'Denmark': 'country-dk',
  'United Kingdom': 'country-gb',
  'Turkey': 'country-tr',
  'USA': 'country-us',
  'Australia': 'country-au',
  'Spain': 'country-es',
  'Hungary': 'country-hu',
  'Mongolia': 'country-mn',
  'Japan': 'country-jp',
  'Serbia': 'country-rs',
  'South Korea': 'country-kr',
  'China': 'country-cn',
  'Saudi Arabia': 'country-sa',
  'Botswana': 'country-bw',
  'New Zealand': 'country-nz',
}

// Team name to organisation ID mapping
const teamMap: Record<string, string | undefined> = {
  'Vitality': 'org-vitality',
  'Spirit': 'org-team-spirit',
  'Falcons': 'org-falcons',
  'BC.Game': 'org-bcgame',
  'FURIA': 'org-furia',
  'MOUZ': 'org-mouz',
  'G2 Esports': 'org-g2',
  'PARIVISION': 'org-parivision',
  'Natus Vincere': 'org-navi',
  'FaZe Clan': 'org-faze',
  'Astralis': 'org-astralis',
  'Aurora': 'org-aurora',
  'Team Liquid': 'org-liquid',
  'Complexity': 'org-col',
  'The MongolZ': 'org-mongolz',
  'BLEED Esports': 'org-bleed',
  'T1': 'org-t1',
  'Gen.G': 'org-geng',
  'Bilibili Gaming': 'org-blg',
  'Sentinels': 'org-sen',
  'Leviatán': 'org-lev',
  'Team Vitality': 'org-vitality',
  'Dignitas': 'org-dig',
  'Team Falcons': 'org-falcons',
  'Chiefs': 'org-chiefs',
  'Rivals': 'org-rivals',
  'Fury': 'org-fury',
  'Retired': undefined,
}

interface PlayerInput {
  nickname: string
  name: string
  country: string
  team: string
  game?: string // game slug, defaults to 'cs2'
}

function createPlayer(input: PlayerInput): Player {
  const countryId = countryMap[input.country]
  const organisationId = teamMap[input.team]
  const gameId = `game-${input.game || 'cs2'}`

  return {
    id: `player-${input.nickname.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: input.nickname,
    slug: input.nickname.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.PLAYER,
    countryId: countryId || 'country-unknown',
    organisationId: organisationId, // undefined if not in a team
    mainGameId: gameId,
    regionId: '', // Set via profile
    gameIds: [gameId],
    aliases: [input.name, input.nickname],
  }
}

const playerData: PlayerInput[] = [
  { nickname: "ZywOo", name: "Mathieu Herbaut", country: "France", team: "Vitality" },
  { nickname: "donk", name: "Danil Kryshkovets", country: "Russia", team: "Spirit" },
  { nickname: "m0NESY", name: "Ilya Osipov", country: "Russia", team: "Falcons" },
  { nickname: "NiKo", name: "Nikola Kovač", country: "Bosnia and Herzegovina", team: "Falcons" },
  { nickname: "s1mple", name: "Oleksandr Kostyliev", country: "Ukraine", team: "BC.Game" },
  { nickname: "ropz", name: "Robin Kool", country: "Estonia", team: "Vitality" },
  { nickname: "sh1ro", name: "Dmitry Sokolov", country: "Russia", team: "Spirit" },
  { nickname: "FalleN", name: "Gabriel Toledo", country: "Brazil", team: "FURIA" },
  { nickname: "YEKINDAR", name: "Mareks Gaļinskis", country: "Latvia", team: "FURIA" },
  { nickname: "Brollan", name: "Ludvig Brolin", country: "Sweden", team: "MOUZ" },
  { nickname: "Spinx", name: "Lotan Giladi", country: "Israel", team: "MOUZ" },
  { nickname: "flameZ", name: "Shahar Shushan", country: "Israel", team: "Vitality" },
  { nickname: "huNter-", name: "Nemanja Kovač", country: "Bosnia and Herzegovina", team: "G2 Esports" },
  { nickname: "Jame", name: "Dzhami Ali", country: "Russia", team: "PARIVISION" },
  { nickname: "b1t", name: "Valeriy Vakhovskiy", country: "Ukraine", team: "Natus Vincere" },
  { nickname: "w0nderful", name: "Ihor Zhdanov", country: "Ukraine", team: "Natus Vincere" },
  { nickname: "Aleksib", name: "Aleksi Virolainen", country: "Finland", team: "Natus Vincere" },
  { nickname: "KSCERATO", name: "Kaike Cerato", country: "Brazil", team: "FURIA" },
  { nickname: "molodoy", name: "Danil Golubenko", country: "Russia", team: "FURIA" },
  { nickname: "electronic", name: "Denis Sharipov", country: "Russia", team: "BC.Game" },
  { nickname: "Twistzz", name: "Russel Van Dulken", country: "Canada", team: "FaZe Clan" },
  { nickname: "broky", name: "Helvijs Saukants", country: "Latvia", team: "FaZe Clan" },
  { nickname: "frozen", name: "David Čerňanský", country: "Slovakia", team: "FaZe Clan" },
  { nickname: "karrigan", name: "Finn Andersen", country: "Denmark", team: "FaZe Clan" },
  { nickname: "device", name: "Nicolai Reedtz", country: "Denmark", team: "Astralis" },
  { nickname: "blameF", name: "Benjamin Bremer", country: "Denmark", team: "Astralis" },
  { nickname: "Magisk", name: "Emil Reif", country: "Denmark", team: "Astralis" },
  { nickname: "apEX", name: "Dan Madesclaire", country: "France", team: "Vitality" },
  { nickname: "mezii", name: "William Merriman", country: "United Kingdom", team: "Vitality" },
  { nickname: "XANTARES", name: "Ismailcan Dörtkardeş", country: "Turkey", team: "Aurora" },
  { nickname: "woxic", name: "Özgür Eker", country: "Turkey", team: "Aurora" },
  { nickname: "Calyx", name: "Buğra Arkın", country: "Turkey", team: "Aurora" },
  { nickname: "NAF", name: "Keith Markovic", country: "Canada", team: "Team Liquid" },
  { nickname: "EliGE", name: "Jonathan Jablonowski", country: "USA", team: "Team Liquid" },
  { nickname: "jks", name: "Justin Savage", country: "Australia", team: "Complexity" },
  { nickname: "HeavyGod", name: "Nikita Martynenko", country: "Israel", team: "G2 Esports" },
  { nickname: "SunPayus", name: "Alvaro Garcia", country: "Spain", team: "G2 Esports" },
  { nickname: "torzsi", name: "Ádám Torzsás", country: "Hungary", team: "MOUZ" },
  { nickname: "Jimpphat", name: "Jimi Salo", country: "Finland", team: "MOUZ" },
  { nickname: "910", name: "Tuvshintugs Enkhbold", country: "Mongolia", team: "The MongolZ" },
  { nickname: "Techno", name: "Sodbayar Munkhbold", country: "Mongolia", team: "The MongolZ" },
  { nickname: "kyousuke", name: "Ren Hayashi", country: "Japan", team: "Falcons" },
  { nickname: "nexa", name: "Nemanja Isaković", country: "Serbia", team: "BLEED Esports" },
  { nickname: "Stewie2K", name: "Jake Yip", country: "USA", team: "Free Agent" },
  { nickname: "kennyS", name: "Kenny Schrub", country: "France", team: "Retired/Content Creator" },

  // League of Legends players
  { nickname: "Faker", name: "Lee Sang-hyeok", country: "South Korea", team: "T1", game: "lol" },
  { nickname: "Chovy", name: "Jeong Ji-hoon", country: "South Korea", team: "Gen.G", game: "lol" },
  { nickname: "Ruler", name: "Park Jae-hyuk", country: "South Korea", team: "Gen.G", game: "lol" },
  { nickname: "Knight", name: "Zhuo Ding", country: "China", team: "Bilibili Gaming", game: "lol" },

  // Valorant players
  { nickname: "Derke", name: "Nikita Sirmitev", country: "Finland", team: "Team Vitality", game: "valorant" },
  { nickname: "Aspas", name: "Erick Santos", country: "Brazil", team: "Leviatán", game: "valorant" },
  { nickname: "TenZ", name: "Tyson Ngo", country: "Canada", team: "Sentinels", game: "valorant" },
  { nickname: "zekken", name: "Zachary Patrone", country: "USA", team: "Sentinels", game: "valorant" },

  // Fortnite players
  { nickname: "Bugha", name: "Kyle Giersdorf", country: "USA", team: "Dignitas", game: "fortnite" },
  { nickname: "Pollo", name: "Ahmad Zaki", country: "Saudi Arabia", team: "Team Falcons", game: "fortnite" },

  // Marvel Rivals players
  { nickname: "duep", name: "duep", country: "Australia", team: "Gen.G", game: "marvel-rivals" },
  { nickname: "zenstarry", name: "zenstarry", country: "Australia", team: "Gen.G", game: "marvel-rivals" },
  { nickname: "donald", name: "donald", country: "Australia", team: "Chiefs", game: "marvel-rivals" },
  { nickname: "six", name: "six", country: "Botswana", team: "Rivals", game: "marvel-rivals" },
  { nickname: "fmcl", name: "fmcl", country: "New Zealand", team: "Gen.G", game: "marvel-rivals" },
  { nickname: "daxu", name: "daxu", country: "Australia", team: "Fury", game: "marvel-rivals" },
  { nickname: "skittles", name: "skittles", country: "Australia", team: "Gen.G", game: "marvel-rivals" },
  { nickname: "mattyaf", name: "mattyaf", country: "France", team: "Retired", game: "marvel-rivals" },
]

export const players: Player[] = playerData.map(createPlayer)
