import pg from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const uploadsDir = path.join(process.cwd(), 'uploads')
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const BASE_URL = 'https://prosettings.net/wp-content/uploads'

// Peripheral slug to prosettings image filename mapping
const peripheralImageMap: Record<string, string[]> = {
  // Mice
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

async function scrapePeripherals() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  console.log('=== Scraping Peripheral Images (from prosettings.net) ===\n')

  // Get peripherals without images
  const peripheralsResult = await pool.query(
    "SELECT DISTINCT ON (slug) id, name, slug, peripheral_type, image_url FROM peripherals WHERE (image_url IS NULL OR image_url = '') ORDER BY slug, id"
  )

  let downloaded = 0
  let notFound = 0

  for (const peripheral of peripheralsResult.rows) {
    console.log(`  ${peripheral.name} (${peripheral.slug})`)

    const urls = generatePeripheralImageUrls(peripheral.slug)

    if (urls.length === 0) {
      console.log(`    No image mapping`)
      notFound++
      continue
    }

    const result = await downloadImage(urls)

    if (result) {
      const filename = `${randomUUID()}.${result.ext}`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, result.buffer)

      const imageUrl = `/api/uploads/${filename}`
      await pool.query('UPDATE peripherals SET image_url = $1 WHERE slug = $2', [imageUrl, peripheral.slug])
      console.log(`    Saved: ${imageUrl}`)
      downloaded++
    } else {
      console.log(`    Not found`)
      notFound++
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n=== Done ===`)
  console.log(`Downloaded: ${downloaded}`)
  console.log(`Not found: ${notFound}`)

  await pool.end()
}

scrapePeripherals().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
