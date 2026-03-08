import pg from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const uploadsDir = path.join(process.cwd(), 'uploads')
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE_URL = 'https://prosettings.net/wp-content/uploads'

// Mapping from our database slugs/names to prosettings slugs
const playerSlugMap: Record<string, string> = {
  'zywoo': 'zywoo',
  'donk': 'donk',
  'm0nesy': 'm0nesy',
  'niko': 'niko',
  's1mple': 's1mple',
  'ropz': 'ropz',
  'sh1ro': 'sh1ro',
  'fallen': 'fallen',
  'yekindar': 'yekindar',
  'brollan': 'brollan',
  'spinx': 'spinx',
  'flamez': 'flamez',
  'hunter-': 'hunter',
  'jame': 'jame',
  'b1t': 'b1t',
  'w0nderful': 'w0nderful',
  'aleksib': 'aleksib',
  'kscerato': 'kscerato',
  'electronic': 'electronic',
  'twistzz': 'twistzz',
  'broky': 'broky',
  'frozen': 'frozen',
  'karrigan': 'karrigan',
  'device': 'device',
  'blamef': 'blamef',
  'magisk': 'magisk',
  'apex': 'apex',
  'naf': 'naf',
  'elige': 'elige',
  'jks': 'jks',
  '910': '910',
  'techno': 'techno4k',
  'faker': 'faker',
  'chovy': 'chovy',
  'ruler': 'ruler',
  'knight': 'knight9',
  'derke': 'derke',
  'aspas': 'aspas',
  'tenz': 'tenz',
  'zekken': 'zekken',
  'bugha': 'bugha',
}

const teamSlugMap: Record<string, string> = {
  'vitality': 'team-vitality',
  'team-spirit': 'team-spirit',
  'falcons': 'falcons-esports',
  'furia': 'furia',
  'mouz': 'mouz',
  'g2': 'g2-esports',
  'navi': 'natus-vincere',
  'faze': 'faze-clan',
  'astralis': 'astralis',
  'aurora': 'aurora-gaming',
  'liquid': 'team-liquid',
  'col': 'complexity',
  'mongolz': 'the-mongolz',
  'bleed': 'bleed-esports',
  'sen': 'sentinels',
  'c9': 'cloud9',
  '100t': '100-thieves',
  'nrg': 'nrg-esports',
  'eg': 'evil-geniuses',
  'loud': 'loud',
  'fnatic': 'fnatic',
  'drx': 'drx',
  'prx': 'paper-rex',
  'edg': 'edward-gaming',
  't1': 't1',
  'kc': 'karmine-corp',
  'kru': 'kru-esports',
  'zeta': 'zeta-division',
  'geng': 'gen-g',
  'blg': 'bilibili-gaming',
  'lev': 'leviatan',
  'heretics': 'team-heretics',
  'dig': 'dignitas',
  'chiefs': 'chiefs-esports-club',
}

const brandSlugMap: Record<string, string> = {
  'zowie': 'zowie',
  'razer': 'razer',
  'logitech': 'logitech',
  'endgame-gear': 'endgame-gear',
  'pulsar': 'pulsar',
  'finalmouse': 'finalmouse',
  'lamzu': 'lamzu',
  'vaxee': 'vaxee',
  'artisan': 'artisan',
  'steelseries': 'steelseries',
  'lethal-gaming-gear': 'lethal-gaming-gear',
  'x-raypad': 'xraypad',
  'skypad': 'skypad',
  'wlmouse': 'wlmouse',
  'ninjutso': 'ninjutso',
  'g-wolves': 'g-wolves',
  'hitscan': 'hitscan',
  'atk': 'atk-gear',
}

// Peripheral slug to prosettings image filename mapping
const peripheralImageMap: Record<string, string[]> = {
  'logitech-g-pro-x-superlight-2': ['logitech-g-pro-x-superlight-2-dex-black', 'logitech-g-pro-x-superlight'],
  'logitech-g-pro-superstrike': ['logitech-g-pro-x2-superstrike', 'logitech-g-pro-2-lightspeed'],
  'razer-viper-v3-pro': ['razer-viper-v3-pro-black', 'razer-viper-v3-pro'],
  'razer-deathadder-v3-pro': ['razer-deathadder-v3-pro'],
  'razer-deathadder-v4-pro': ['razer-deathadder-v4-pro-black', 'razer-deathadder-v4-pro'],
  'razer-viper-mini-signature-edition': ['razer-viper-signature-edition'],
  'zowie-ec-dw': ['zowie-ec2-cw', 'zowie-ec2-c', 'zowie-ec2'],
  'zowie-fk-dw': ['zowie-fk2-dw', 'zowie-fk2-c', 'zowie-fk2'],
  'zowie-s2-dw': ['zowie-s2-dw', 'zowie-s2-c', 'zowie-s2'],
  'zowie-u2-dw': ['zowie-u2'],
  'zowie-za-dw': ['zowie-za13-dw', 'zowie-za13-c', 'zowie-za13-b'],
  'pulsar-x2v2': ['pulsar-x2-v2', 'pulsar-x2-v2-white', 'pulsar-x2'],
  'finalmouse-ultralightx': ['finalmouse-ultralight-x', 'finalmouse-ultralight-2'],
  'endgame gear-op1-8k': ['endgame-gear-op1-8k-black', 'endgame-gear-op1-8k'],
  'endgame gear-xm2we': ['endgame-gear-xm2we-white', 'endgame-gear-xm2w'],
  'wlmouse-beast-x': ['wlmouse-beast-x-black', 'wlmouse-beast-x'],
  'wlmouse-huan': ['wlmouse-huan-ma-gic', 'wlmouse-beast-x-mini-magnesium'],
  'hitscan-hyperlight': ['hitscan-hyperlight-black', 'hitscan-hyperlight'],
  // Mousepads
  'artisan-hien': ['artisan-hien-fx-soft', 'artisan-hien'],
  'artisan-zero': ['artisan-ninja-fx-zero-soft', 'artisan-zero'],
  'artisan-hayate-otsu': ['artisan-hayate-otsu', 'artisan-ninja-fx-hayate-kou'],
  'artisan-raiden': ['artisan-raiden-fx-mid', 'artisan-raiden'],
  'artisan-shidenkai': ['artisan-ninja-fx-shidenkai-xsoft', 'artisan-shidenkai-v2-snow-white'],
  'logitech-g640': ['logitech-g640-black', 'logitech-g640'],
  'steelseries-qck': ['steelseries-qck', 'steelseries-qck-large'],
  'zowie-g-sr': ['zowie-g-sr', 'zowie-g-sr-ii'],
}

// Game slug to prosettings image filename patterns
const gameSlugMap: Record<string, string[]> = {
  'cs2': ['cs2-icon-black', 'cs2-logo', 'counter-strike-2', 'cs2'],
  'valorant': ['valorant-logo', 'valorant'],
  'ow2': ['overwatch', 'overwatch-2', 'ow2-logo'],
  'lol': ['league-of-legends-logo', 'league-of-legends', 'lol-logo'],
  'dota2': ['dota2-logo', 'dota-2-logo', 'dota2'],
  'apex': ['apex-legends-logo-test', 'apex-legends-logo', 'apex-legends'],
  'fortnite': ['fortnite-logo-test', 'fortnite-logo', 'fortnite'],
  'pubg': ['pubg-2', 'pubg-logo', 'pubg'],
  'r6': ['rainbow6-logo', 'rainbow-six-siege', 'r6-logo'],
  'cod': ['call-of-duty-warzone-logo-test', 'call-of-duty-logo', 'cod-logo'],
  'marvel-rivals': ['marvel-rivals-logo-1', 'marvel-rivals-logo', 'marvel-rivals'],
  'rocket-league': ['rocket-league-logo', 'rocket-league'],
  'sf6': ['street-fighter-6-logo', 'sf6-logo', 'street-fighter-6'],
  'tekken8': ['tekken-8-logo', 'tekken8-logo', 'tekken-8'],
  'sc2': ['starcraft-2-logo', 'sc2-logo', 'starcraft-ii'],
}

async function downloadImage(urls: string[]): Promise<{ buffer: Buffer; ext: string } | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      })
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const ext = url.split('.').pop()?.split('?')[0] || 'png'
        console.log(`    Found: ${url}`)
        return { buffer: Buffer.from(arrayBuffer), ext }
      }
    } catch (error) {
      // Continue to next URL
    }
  }
  return null
}

function generatePeripheralImageUrls(slug: string): string[] {
  const urls: string[] = []
  const imageNames = peripheralImageMap[slug]

  if (imageNames) {
    for (const name of imageNames) {
      urls.push(`${BASE_URL}/${name}.png`)
      urls.push(`${BASE_URL}/${name}.webp`)
    }
  }

  return urls
}

function generateImageUrls(slug: string, type: 'player' | 'team' | 'brand' | 'game'): string[] {
  const urls: string[] = []

  if (type === 'game') {
    // Games have specific filename patterns, try SVG first then PNG
    const patterns = gameSlugMap[slug] || [slug]
    for (const p of patterns) {
      urls.push(`${BASE_URL}/${p}.svg`)
      urls.push(`${BASE_URL}/${p}.png`)
    }
    return urls
  }

  const variations = [slug, slug.toLowerCase(), slug.replace(/-/g, '')]

  for (const v of variations) {
    if (type === 'player') {
      // Players often have .webp images
      urls.push(`${BASE_URL}/${v}.webp`)
      urls.push(`${BASE_URL}/${v}.png`)
      urls.push(`${BASE_URL}/${v}.jpg`)
    } else {
      // Teams and brands usually have .png
      urls.push(`${BASE_URL}/${v}.png`)
      urls.push(`${BASE_URL}/${v}.webp`)
      urls.push(`${BASE_URL}/${v}.svg`)
    }
  }

  return urls
}

async function scrapeImages() {
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  console.log('=== Scraping Player Images ===\n')

  // Get players without images
  const playersResult = await pool.query(
    "SELECT id, name, slug, image_url FROM players WHERE image_url IS NULL OR image_url = ''"
  )

  for (const player of playersResult.rows) {
    const prosettingsSlug = playerSlugMap[player.slug] || player.slug
    console.log(`  ${player.name} (${player.slug} -> ${prosettingsSlug})`)

    const urls = generateImageUrls(prosettingsSlug, 'player')
    const result = await downloadImage(urls)

    if (result) {
      const filename = `${randomUUID()}.${result.ext}`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, result.buffer)

      const imageUrl = `/api/uploads/${filename}`
      await pool.query('UPDATE players SET image_url = $1 WHERE id = $2', [imageUrl, player.id])
      console.log(`    Saved: ${imageUrl}`)
    } else {
      console.log(`    Not found`)
    }

    // Rate limiting - be nice to the server
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n=== Scraping Organisation Images ===\n')

  // Get organisations without images
  const orgsResult = await pool.query(
    "SELECT id, name, slug, image_url FROM organisations WHERE image_url IS NULL OR image_url = ''"
  )

  for (const org of orgsResult.rows) {
    const prosettingsSlug = teamSlugMap[org.slug] || org.slug
    console.log(`  ${org.name} (${org.slug} -> ${prosettingsSlug})`)

    const urls = generateImageUrls(prosettingsSlug, 'team')
    const result = await downloadImage(urls)

    if (result) {
      const filename = `${randomUUID()}.${result.ext}`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, result.buffer)

      const imageUrl = `/api/uploads/${filename}`
      await pool.query('UPDATE organisations SET image_url = $1 WHERE id = $2', [imageUrl, org.id])
      console.log(`    Saved: ${imageUrl}`)
    } else {
      console.log(`    Not found`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n=== Scraping Brand Images ===\n')

  // Get brands without images
  const brandsResult = await pool.query(
    "SELECT id, name, slug, image_url FROM brands WHERE image_url IS NULL OR image_url = ''"
  )

  for (const brand of brandsResult.rows) {
    const prosettingsSlug = brandSlugMap[brand.slug] || brand.slug
    console.log(`  ${brand.name} (${brand.slug} -> ${prosettingsSlug})`)

    const urls = generateImageUrls(prosettingsSlug, 'brand')
    const result = await downloadImage(urls)

    if (result) {
      const filename = `${randomUUID()}.${result.ext}`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, result.buffer)

      const imageUrl = `/api/uploads/${filename}`
      await pool.query('UPDATE brands SET image_url = $1 WHERE id = $2', [imageUrl, brand.id])
      console.log(`    Saved: ${imageUrl}`)
    } else {
      console.log(`    Not found`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n=== Scraping Peripheral Images (from prosettings.net) ===\n')

  // Get peripherals without images
  const peripheralsResult = await pool.query(
    "SELECT DISTINCT ON (slug) id, name, slug, peripheral_type, image_url FROM peripherals WHERE (image_url IS NULL OR image_url = '') ORDER BY slug, id"
  )

  for (const peripheral of peripheralsResult.rows) {
    console.log(`  ${peripheral.name} (${peripheral.slug})`)

    const urls = generatePeripheralImageUrls(peripheral.slug)

    if (urls.length === 0) {
      console.log(`    No image mapping`)
      continue
    }

    const result = await downloadImage(urls)

    if (result) {
      const filename = `${randomUUID()}.${result.ext}`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, result.buffer)

      const imageUrl = `/api/uploads/${filename}`
      // Update all peripherals with this slug
      await pool.query('UPDATE peripherals SET image_url = $1 WHERE slug = $2', [imageUrl, peripheral.slug])
      console.log(`    Saved: ${imageUrl}`)
    } else {
      console.log(`    Not found`)
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n=== Scraping Game Images ===\n')

  // Get games without images
  const gamesResult = await pool.query(
    "SELECT id, name, slug, image_url FROM games WHERE image_url IS NULL OR image_url = ''"
  )

  for (const game of gamesResult.rows) {
    console.log(`  ${game.name} (${game.slug})`)

    const urls = generateImageUrls(game.slug, 'game')
    const result = await downloadImage(urls)

    if (result) {
      const filename = `${randomUUID()}.${result.ext}`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, result.buffer)

      const imageUrl = `/api/uploads/${filename}`
      await pool.query('UPDATE games SET image_url = $1 WHERE id = $2', [imageUrl, game.id])
      console.log(`    Saved: ${imageUrl}`)
    } else {
      console.log(`    Not found`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log('\n=== Summary ===')

  const playerCount = (await pool.query("SELECT COUNT(*) FROM players WHERE image_url IS NOT NULL AND image_url != ''")).rows[0].count
  const orgCount = (await pool.query("SELECT COUNT(*) FROM organisations WHERE image_url IS NOT NULL AND image_url != ''")).rows[0].count
  const brandCount = (await pool.query("SELECT COUNT(*) FROM brands WHERE image_url IS NOT NULL AND image_url != ''")).rows[0].count
  const gameCount = (await pool.query("SELECT COUNT(*) FROM games WHERE image_url IS NOT NULL AND image_url != ''")).rows[0].count

  const peripheralCount = (await pool.query("SELECT COUNT(DISTINCT slug) FROM peripherals WHERE image_url IS NOT NULL AND image_url != ''")).rows[0].count

  console.log(`Players with images: ${playerCount}`)
  console.log(`Organisations with images: ${orgCount}`)
  console.log(`Brands with images: ${brandCount}`)
  console.log(`Games with images: ${gameCount}`)
  console.log(`Peripherals with images: ${peripheralCount}`)

  await pool.end()
  console.log('\nDone!')
}

scrapeImages().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
