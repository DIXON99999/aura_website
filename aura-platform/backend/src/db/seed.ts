import { Database } from 'bun:sqlite'

const db = new Database('aura.db', { create: true })

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS countries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    flag_code TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_type TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS organisations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS organisation_games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    organisation_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS peripherals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    peripheral_type TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS weapons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    game_id TEXT NOT NULL,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    country_id TEXT,
    organisation_id TEXT,
    main_game_id TEXT,
    region_id TEXT,
    game_ids TEXT,
    associated_entity_ids TEXT,
    is_user_profile INTEGER DEFAULT 0,
    visitor_id TEXT,
    aura_score REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    aliases TEXT,
    created_at INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    visitor_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL
  )
`)

const now = Date.now()

// Prepared statements
const insertCountry = db.prepare(`INSERT OR IGNORE INTO countries (id, name, slug, flag_code, aura_score, created_at) VALUES (?, ?, ?, ?, 0, ?)`)
const insertGame = db.prepare(`INSERT OR IGNORE INTO games (id, name, slug, game_type, aura_score, aliases, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)`)
const insertOrg = db.prepare(`INSERT OR IGNORE INTO organisations (id, name, slug, aura_score, created_at) VALUES (?, ?, ?, 0, ?)`)
const insertBrand = db.prepare(`INSERT OR IGNORE INTO brands (id, name, slug, aura_score, created_at) VALUES (?, ?, ?, 0, ?)`)
const insertPlayer = db.prepare(`INSERT OR IGNORE INTO players (id, name, slug, country_id, organisation_id, main_game_id, game_ids, aura_score, aliases, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
const insertPeripheral = db.prepare(`INSERT OR IGNORE INTO peripherals (id, name, slug, peripheral_type, brand_id, aura_score, aliases, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`)
const insertRegion = db.prepare(`INSERT OR IGNORE INTO regions (id, name, slug, game_id, aura_score, created_at) VALUES (?, ?, ?, ?, 0, ?)`)
const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (id, name, slug, game_id, aura_score, created_at) VALUES (?, ?, ?, ?, 0, ?)`)
const insertCharacter = db.prepare(`INSERT OR IGNORE INTO characters (id, name, slug, game_id, aura_score, created_at) VALUES (?, ?, ?, ?, 0, ?)`)

// Countries
const countriesData = [
  { name: 'United States', flagCode: 'US' },
  { name: 'Canada', flagCode: 'CA' },
  { name: 'Mexico', flagCode: 'MX' },
  { name: 'Brazil', flagCode: 'BR' },
  { name: 'Argentina', flagCode: 'AR' },
  { name: 'Chile', flagCode: 'CL' },
  { name: 'Peru', flagCode: 'PE' },
  { name: 'Colombia', flagCode: 'CO' },
  { name: 'United Kingdom', flagCode: 'GB' },
  { name: 'France', flagCode: 'FR' },
  { name: 'Germany', flagCode: 'DE' },
  { name: 'Spain', flagCode: 'ES' },
  { name: 'Portugal', flagCode: 'PT' },
  { name: 'Netherlands', flagCode: 'NL' },
  { name: 'Belgium', flagCode: 'BE' },
  { name: 'Switzerland', flagCode: 'CH' },
  { name: 'Austria', flagCode: 'AT' },
  { name: 'Ireland', flagCode: 'IE' },
  { name: 'Sweden', flagCode: 'SE' },
  { name: 'Denmark', flagCode: 'DK' },
  { name: 'Norway', flagCode: 'NO' },
  { name: 'Finland', flagCode: 'FI' },
  { name: 'Iceland', flagCode: 'IS' },
  { name: 'Poland', flagCode: 'PL' },
  { name: 'Ukraine', flagCode: 'UA' },
  { name: 'Russia', flagCode: 'RU' },
  { name: 'Czech Republic', flagCode: 'CZ' },
  { name: 'Slovakia', flagCode: 'SK' },
  { name: 'Hungary', flagCode: 'HU' },
  { name: 'Romania', flagCode: 'RO' },
  { name: 'Bulgaria', flagCode: 'BG' },
  { name: 'Serbia', flagCode: 'RS' },
  { name: 'Croatia', flagCode: 'HR' },
  { name: 'Slovenia', flagCode: 'SI' },
  { name: 'Bosnia and Herzegovina', flagCode: 'BA' },
  { name: 'North Macedonia', flagCode: 'MK' },
  { name: 'Montenegro', flagCode: 'ME' },
  { name: 'Kosovo', flagCode: 'XK' },
  { name: 'Latvia', flagCode: 'LV' },
  { name: 'Lithuania', flagCode: 'LT' },
  { name: 'Estonia', flagCode: 'EE' },
  { name: 'Belarus', flagCode: 'BY' },
  { name: 'Moldova', flagCode: 'MD' },
  { name: 'Italy', flagCode: 'IT' },
  { name: 'Greece', flagCode: 'GR' },
  { name: 'Turkey', flagCode: 'TR' },
  { name: 'Cyprus', flagCode: 'CY' },
  { name: 'Malta', flagCode: 'MT' },
  { name: 'South Korea', flagCode: 'KR' },
  { name: 'Japan', flagCode: 'JP' },
  { name: 'China', flagCode: 'CN' },
  { name: 'Taiwan', flagCode: 'TW' },
  { name: 'Hong Kong', flagCode: 'HK' },
  { name: 'Macau', flagCode: 'MO' },
  { name: 'Mongolia', flagCode: 'MN' },
  { name: 'Philippines', flagCode: 'PH' },
  { name: 'Vietnam', flagCode: 'VN' },
  { name: 'Thailand', flagCode: 'TH' },
  { name: 'Indonesia', flagCode: 'ID' },
  { name: 'Malaysia', flagCode: 'MY' },
  { name: 'Singapore', flagCode: 'SG' },
  { name: 'Myanmar', flagCode: 'MM' },
  { name: 'Cambodia', flagCode: 'KH' },
  { name: 'Laos', flagCode: 'LA' },
  { name: 'India', flagCode: 'IN' },
  { name: 'Pakistan', flagCode: 'PK' },
  { name: 'Bangladesh', flagCode: 'BD' },
  { name: 'Sri Lanka', flagCode: 'LK' },
  { name: 'Nepal', flagCode: 'NP' },
  { name: 'Kazakhstan', flagCode: 'KZ' },
  { name: 'Uzbekistan', flagCode: 'UZ' },
  { name: 'Israel', flagCode: 'IL' },
  { name: 'United Arab Emirates', flagCode: 'AE' },
  { name: 'Saudi Arabia', flagCode: 'SA' },
  { name: 'Qatar', flagCode: 'QA' },
  { name: 'Kuwait', flagCode: 'KW' },
  { name: 'Bahrain', flagCode: 'BH' },
  { name: 'Jordan', flagCode: 'JO' },
  { name: 'Lebanon', flagCode: 'LB' },
  { name: 'Iran', flagCode: 'IR' },
  { name: 'Iraq', flagCode: 'IQ' },
  { name: 'Australia', flagCode: 'AU' },
  { name: 'New Zealand', flagCode: 'NZ' },
  { name: 'Botswana', flagCode: 'BW' },
  { name: 'South Africa', flagCode: 'ZA' },
  { name: 'Egypt', flagCode: 'EG' },
  { name: 'Morocco', flagCode: 'MA' },
  { name: 'Nigeria', flagCode: 'NG' },
  { name: 'Kenya', flagCode: 'KE' },
  { name: 'Algeria', flagCode: 'DZ' },
  { name: 'Tunisia', flagCode: 'TN' },
]

console.log('Seeding countries...')
for (const c of countriesData) {
  insertCountry.run(`country-${c.flagCode.toLowerCase()}`, c.name, c.name.toLowerCase().replace(/\s+/g, '-'), c.flagCode, now)
}

// Games
const gamesData = [
  { name: 'Counter-Strike 2', slug: 'cs2', gameType: 'FPS', aliases: ['cs2', 'csgo', 'cs', 'counter strike'] },
  { name: 'Valorant', slug: 'valorant', gameType: 'FPS', aliases: ['valo', 'val'] },
  { name: 'Overwatch 2', slug: 'ow2', gameType: 'FPS', aliases: ['ow2', 'ow', 'overwatch'] },
  { name: 'Marvel Rivals', slug: 'marvel-rivals', gameType: 'FPS', aliases: ['marvel', 'rivals', 'mr'] },
  { name: 'Call of Duty', slug: 'cod', gameType: 'FPS', aliases: ['cod', 'call of duty', 'warzone'] },
  { name: 'Rainbow Six Siege', slug: 'r6', gameType: 'FPS', aliases: ['r6', 'r6s', 'siege', 'rainbow six'] },
  { name: 'League of Legends', slug: 'lol', gameType: 'MOBA', aliases: ['lol', 'league'] },
  { name: 'Dota 2', slug: 'dota2', gameType: 'MOBA', aliases: ['dota', 'dota2'] },
  { name: 'Fortnite', slug: 'fortnite', gameType: 'BATTLE_ROYALE', aliases: ['fn', 'fort'] },
  { name: 'Apex Legends', slug: 'apex', gameType: 'BATTLE_ROYALE', aliases: ['apex'] },
  { name: 'PUBG', slug: 'pubg', gameType: 'BATTLE_ROYALE', aliases: ['pubg', 'playerunknown'] },
  { name: 'Street Fighter 6', slug: 'sf6', gameType: 'FIGHTING', aliases: ['sf6', 'sf', 'street fighter'] },
  { name: 'Tekken 8', slug: 'tekken8', gameType: 'FIGHTING', aliases: ['tekken', 't8'] },
  { name: 'Rocket League', slug: 'rocket-league', gameType: 'SPORTS', aliases: ['rl', 'rocket'] },
  { name: 'StarCraft II', slug: 'sc2', gameType: 'OTHER', aliases: ['sc2', 'starcraft'] },
]

console.log('Seeding games...')
for (const g of gamesData) {
  insertGame.run(`game-${g.slug}`, g.name, g.slug, g.gameType, JSON.stringify(g.aliases), now)
}

// Organisations
const organisationsData = [
  { name: 'Vitality', slug: 'vitality' },
  { name: 'Spirit', slug: 'team-spirit' },
  { name: 'Falcons', slug: 'falcons' },
  { name: 'BC.Game', slug: 'bcgame' },
  { name: 'FURIA', slug: 'furia' },
  { name: 'MOUZ', slug: 'mouz' },
  { name: 'G2 Esports', slug: 'g2' },
  { name: 'PARIVISION', slug: 'parivision' },
  { name: 'Natus Vincere', slug: 'navi' },
  { name: 'FaZe Clan', slug: 'faze' },
  { name: 'Astralis', slug: 'astralis' },
  { name: 'Aurora', slug: 'aurora' },
  { name: 'Team Liquid', slug: 'liquid' },
  { name: 'Complexity', slug: 'col' },
  { name: 'The MongolZ', slug: 'mongolz' },
  { name: 'BLEED Esports', slug: 'bleed' },
  { name: 'Sentinels', slug: 'sen' },
  { name: 'Cloud9', slug: 'c9' },
  { name: '100 Thieves', slug: '100t' },
  { name: 'NRG Esports', slug: 'nrg' },
  { name: 'Evil Geniuses', slug: 'eg' },
  { name: 'LOUD', slug: 'loud' },
  { name: 'FNATIC', slug: 'fnatic' },
  { name: 'DRX', slug: 'drx' },
  { name: 'Paper Rex', slug: 'prx' },
  { name: 'EDward Gaming', slug: 'edg' },
  { name: 'T1', slug: 't1' },
  { name: 'Karmine Corp', slug: 'kc' },
  { name: 'KRU Esports', slug: 'kru' },
  { name: 'ZETA DIVISION', slug: 'zeta' },
  { name: 'Gen.G', slug: 'geng' },
  { name: 'Bilibili Gaming', slug: 'blg' },
  { name: 'Leviatan', slug: 'lev' },
  { name: 'Team Heretics', slug: 'heretics' },
  { name: 'Dignitas', slug: 'dig' },
  { name: 'Chiefs', slug: 'chiefs' },
  { name: 'Rivals', slug: 'rivals' },
  { name: 'Fury', slug: 'fury' },
]

console.log('Seeding organisations...')
for (const o of organisationsData) {
  insertOrg.run(`org-${o.slug}`, o.name, o.slug, now)
}

// Brands
const brandsData = ['Zowie', 'Razer', 'Logitech', 'Endgame Gear', 'Hitscan', 'ATK', 'Pulsar', 'WLMouse', 'Finalmouse', 'Lamzu', 'Ninjutso', 'Vaxee', 'G-Wolves', 'Artisan', 'SteelSeries', 'Lethal Gaming Gear', 'X-raypad', 'Skypad']

console.log('Seeding brands...')
for (const b of brandsData) {
  const slug = b.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  insertBrand.run(`brand-${slug}`, b, slug, now)
}

// Players
const playersData = [
  { nickname: 'ZywOo', name: 'Mathieu Herbaut', country: 'fr', team: 'vitality', game: 'cs2' },
  { nickname: 'donk', name: 'Danil Kryshkovets', country: 'ru', team: 'team-spirit', game: 'cs2' },
  { nickname: 'm0NESY', name: 'Ilya Osipov', country: 'ru', team: 'falcons', game: 'cs2' },
  { nickname: 'NiKo', name: 'Nikola Kovac', country: 'ba', team: 'falcons', game: 'cs2' },
  { nickname: 's1mple', name: 'Oleksandr Kostyliev', country: 'ua', team: 'bcgame', game: 'cs2' },
  { nickname: 'ropz', name: 'Robin Kool', country: 'ee', team: 'vitality', game: 'cs2' },
  { nickname: 'sh1ro', name: 'Dmitry Sokolov', country: 'ru', team: 'team-spirit', game: 'cs2' },
  { nickname: 'FalleN', name: 'Gabriel Toledo', country: 'br', team: 'furia', game: 'cs2' },
  { nickname: 'YEKINDAR', name: 'Mareks Galinskis', country: 'lv', team: 'furia', game: 'cs2' },
  { nickname: 'Brollan', name: 'Ludvig Brolin', country: 'se', team: 'mouz', game: 'cs2' },
  { nickname: 'Spinx', name: 'Lotan Giladi', country: 'il', team: 'mouz', game: 'cs2' },
  { nickname: 'flameZ', name: 'Shahar Shushan', country: 'il', team: 'vitality', game: 'cs2' },
  { nickname: 'huNter-', name: 'Nemanja Kovac', country: 'ba', team: 'g2', game: 'cs2' },
  { nickname: 'Jame', name: 'Dzhami Ali', country: 'ru', team: 'parivision', game: 'cs2' },
  { nickname: 'b1t', name: 'Valeriy Vakhovskiy', country: 'ua', team: 'navi', game: 'cs2' },
  { nickname: 'w0nderful', name: 'Ihor Zhdanov', country: 'ua', team: 'navi', game: 'cs2' },
  { nickname: 'Aleksib', name: 'Aleksi Virolainen', country: 'fi', team: 'navi', game: 'cs2' },
  { nickname: 'KSCERATO', name: 'Kaike Cerato', country: 'br', team: 'furia', game: 'cs2' },
  { nickname: 'electronic', name: 'Denis Sharipov', country: 'ru', team: 'bcgame', game: 'cs2' },
  { nickname: 'Twistzz', name: 'Russel Van Dulken', country: 'ca', team: 'faze', game: 'cs2' },
  { nickname: 'broky', name: 'Helvijs Saukants', country: 'lv', team: 'faze', game: 'cs2' },
  { nickname: 'frozen', name: 'David Cernansky', country: 'sk', team: 'faze', game: 'cs2' },
  { nickname: 'karrigan', name: 'Finn Andersen', country: 'dk', team: 'faze', game: 'cs2' },
  { nickname: 'device', name: 'Nicolai Reedtz', country: 'dk', team: 'astralis', game: 'cs2' },
  { nickname: 'blameF', name: 'Benjamin Bremer', country: 'dk', team: 'astralis', game: 'cs2' },
  { nickname: 'Magisk', name: 'Emil Reif', country: 'dk', team: 'astralis', game: 'cs2' },
  { nickname: 'apEX', name: 'Dan Madesclaire', country: 'fr', team: 'vitality', game: 'cs2' },
  { nickname: 'NAF', name: 'Keith Markovic', country: 'ca', team: 'liquid', game: 'cs2' },
  { nickname: 'EliGE', name: 'Jonathan Jablonowski', country: 'us', team: 'liquid', game: 'cs2' },
  { nickname: 'jks', name: 'Justin Savage', country: 'au', team: 'col', game: 'cs2' },
  { nickname: '910', name: 'Tuvshintugs Enkhbold', country: 'mn', team: 'mongolz', game: 'cs2' },
  { nickname: 'Techno', name: 'Sodbayar Munkhbold', country: 'mn', team: 'mongolz', game: 'cs2' },
  // League of Legends
  { nickname: 'Faker', name: 'Lee Sang-hyeok', country: 'kr', team: 't1', game: 'lol' },
  { nickname: 'Chovy', name: 'Jeong Ji-hoon', country: 'kr', team: 'geng', game: 'lol' },
  { nickname: 'Ruler', name: 'Park Jae-hyuk', country: 'kr', team: 'geng', game: 'lol' },
  { nickname: 'Knight', name: 'Zhuo Ding', country: 'cn', team: 'blg', game: 'lol' },
  // Valorant
  { nickname: 'Derke', name: 'Nikita Sirmitev', country: 'fi', team: 'vitality', game: 'valorant' },
  { nickname: 'Aspas', name: 'Erick Santos', country: 'br', team: 'lev', game: 'valorant' },
  { nickname: 'TenZ', name: 'Tyson Ngo', country: 'ca', team: 'sen', game: 'valorant' },
  { nickname: 'zekken', name: 'Zachary Patrone', country: 'us', team: 'sen', game: 'valorant' },
  // Fortnite
  { nickname: 'Bugha', name: 'Kyle Giersdorf', country: 'us', team: 'dig', game: 'fortnite' },
  // Marvel Rivals
  { nickname: 'duep', name: 'duep', country: 'au', team: 'geng', game: 'marvel-rivals' },
  { nickname: 'zenstarry', name: 'zenstarry', country: 'au', team: 'geng', game: 'marvel-rivals' },
  { nickname: 'donald', name: 'donald', country: 'au', team: 'chiefs', game: 'marvel-rivals' },
  { nickname: 'six', name: 'six', country: 'bw', team: 'rivals', game: 'marvel-rivals' },
  { nickname: 'fmcl', name: 'fmcl', country: 'nz', team: 'geng', game: 'marvel-rivals' },
  { nickname: 'daxu', name: 'daxu', country: 'au', team: 'fury', game: 'marvel-rivals' },
  { nickname: 'skittles', name: 'skittles', country: 'au', team: 'geng', game: 'marvel-rivals' },
]

console.log('Seeding players...')
for (const p of playersData) {
  const slug = p.nickname.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  insertPlayer.run(
    `player-${slug}`,
    p.nickname,
    slug,
    `country-${p.country}`,
    p.team ? `org-${p.team}` : null,
    `game-${p.game}`,
    JSON.stringify([`game-${p.game}`]),
    JSON.stringify([p.name, p.nickname]),
    now
  )
}

// Peripherals
const peripheralsData = [
  { brand: 'zowie', model: 'EC-DW', type: 'MOUSE' },
  { brand: 'zowie', model: 'FK-DW', type: 'MOUSE' },
  { brand: 'razer', model: 'DeathAdder V3 Pro', type: 'MOUSE' },
  { brand: 'razer', model: 'Viper V3 Pro', type: 'MOUSE' },
  { brand: 'logitech', model: 'G Pro X Superlight 2', type: 'MOUSE' },
  { brand: 'pulsar', model: 'X2V2', type: 'MOUSE' },
  { brand: 'finalmouse', model: 'UltralightX', type: 'MOUSE' },
  { brand: 'artisan', model: 'Hien', type: 'MOUSEPAD' },
  { brand: 'artisan', model: 'Zero', type: 'MOUSEPAD' },
  { brand: 'steelseries', model: 'QcK', type: 'MOUSEPAD' },
  { brand: 'zowie', model: 'G-SR', type: 'MOUSEPAD' },
  { brand: 'logitech', model: 'G640', type: 'MOUSEPAD' },
]

console.log('Seeding peripherals...')
for (const p of peripheralsData) {
  const fullName = `${p.brand} ${p.model}`
  const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  insertPeripheral.run(`peripheral-${slug}`, fullName, slug, p.type, `brand-${p.brand}`, JSON.stringify([p.model, p.brand]), now)
}

// Regions
const regionsData = [
  { name: 'Americas', game: 'valorant', slug: 'americas' },
  { name: 'EMEA', game: 'valorant', slug: 'emea' },
  { name: 'Pacific', game: 'valorant', slug: 'pacific' },
  { name: 'Europe', game: 'cs2', slug: 'eu' },
  { name: 'CIS', game: 'cs2', slug: 'cis' },
  { name: 'North America', game: 'cs2', slug: 'na' },
  { name: 'South America', game: 'cs2', slug: 'sa' },
  { name: 'Asia', game: 'cs2', slug: 'asia' },
  { name: 'Oceania', game: 'cs2', slug: 'oce' },
  { name: 'LCK (Korea)', game: 'lol', slug: 'lck' },
  { name: 'LPL (China)', game: 'lol', slug: 'lpl' },
  { name: 'LEC (Europe)', game: 'lol', slug: 'lec' },
  { name: 'LCS (North America)', game: 'lol', slug: 'lcs' },
]

console.log('Seeding regions...')
for (const r of regionsData) {
  insertRegion.run(`region-${r.game}-${r.slug}`, r.name, `${r.game}-${r.slug}`, `game-${r.game}`, now)
}

// Roles
const rolesData = [
  { name: 'Entry Fragger', game: 'cs2' },
  { name: 'AWPer', game: 'cs2' },
  { name: 'In-Game Leader', game: 'cs2' },
  { name: 'Support', game: 'cs2' },
  { name: 'Lurker', game: 'cs2' },
  { name: 'Duelist', game: 'valorant' },
  { name: 'Controller', game: 'valorant' },
  { name: 'Initiator', game: 'valorant' },
  { name: 'Sentinel', game: 'valorant' },
  { name: 'Vanguard', game: 'marvel-rivals' },
  { name: 'Duelist', game: 'marvel-rivals' },
  { name: 'Strategist', game: 'marvel-rivals' },
]

console.log('Seeding roles...')
for (const r of rolesData) {
  const slug = `${r.game}-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  insertRole.run(`role-${slug}`, r.name, slug, `game-${r.game}`, now)
}

// Characters
const charactersData = [
  ...['Jett', 'Phoenix', 'Reyna', 'Raze', 'Sage', 'Cypher', 'Killjoy', 'Chamber', 'Sova', 'Breach', 'Skye', 'Fade', 'Brimstone', 'Omen', 'Viper', 'Astra'].map(n => ({ name: n, game: 'valorant' })),
  ...['Captain America', 'Doctor Strange', 'Hulk', 'Thor', 'Venom', 'Black Panther', 'Iron Man', 'Spider-Man', 'Wolverine', 'Luna Snow', 'Loki', 'Rocket Raccoon'].map(n => ({ name: n, game: 'marvel-rivals' })),
]

console.log('Seeding characters...')
for (const c of charactersData) {
  const slug = `${c.game}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  insertCharacter.run(`character-${slug}`, c.name, slug, `game-${c.game}`, now)
}

console.log('Seed complete!')
db.close()
