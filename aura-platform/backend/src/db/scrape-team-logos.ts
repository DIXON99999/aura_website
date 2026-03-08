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

// Mapping from our database slugs to prosettings team slugs
const teamSlugMap: Record<string, string[]> = {
  'bcgame': ['bc-game', 'bcgame'],
  'vitality': ['team-vitality', 'vitality'],
  'team-spirit': ['team-spirit', 'spirit'],
  'falcons': ['falcons-esports', 'falcons'],
  'furia': ['furia', 'furia-esports'],
  'mouz': ['mouz', 'mousesports'],
  'g2': ['g2-esports', 'g2'],
  'navi': ['natus-vincere', 'navi'],
  'faze': ['faze-clan', 'faze'],
  'astralis': ['astralis'],
  'aurora': ['aurora-gaming', 'aurora'],
  'liquid': ['team-liquid', 'liquid'],
  'col': ['complexity', 'complexity-gaming'],
  'mongolz': ['the-mongolz', 'mongolz'],
  'bleed': ['bleed-esports', 'bleed'],
  'sen': ['sentinels'],
  'c9': ['cloud9', 'c9'],
  '100t': ['100-thieves', '100thieves'],
  'nrg': ['nrg-esports', 'nrg'],
  'eg': ['evil-geniuses', 'eg'],
  'loud': ['loud'],
  'fnatic': ['fnatic'],
  'drx': ['drx'],
  'prx': ['paper-rex', 'paperrex'],
  'edg': ['edward-gaming', 'edg'],
  't1': ['t1'],
  'kc': ['karmine-corp', 'kcorp'],
  'kru': ['kru-esports', 'kru'],
  'zeta': ['zeta-division', 'zeta'],
  'geng': ['gen-g', 'geng'],
  'blg': ['bilibili-gaming', 'blg'],
  'lev': ['leviatan'],
  'heretics': ['team-heretics', 'heretics'],
  'dig': ['dignitas'],
  'chiefs': ['chiefs-esports-club', 'chiefs'],
  'virtus-pro': ['virtus-pro', 'virtuspro'],
  'big': ['big', 'big-clan'],
  'ence': ['ence'],
  'heroic': ['heroic'],
  'eternal-fire': ['eternal-fire', 'eternalfire'],
  '9-pandas': ['9-pandas', '9pandas'],
  'saw': ['saw', 'saw-esports'],
  'betboom': ['betboom', 'betboom-team'],
  'pain': ['pain-gaming', 'pain'],
  'imperial': ['imperial', 'imperial-esports'],
  'mibr': ['mibr'],
  'oddik': ['oddik'],
  'flyquest': ['flyquest'],
  'wildcard': ['wildcard', 'wildcard-gaming'],
  'rare-atom': ['rare-atom'],
  'lynn-vision': ['lynn-vision', 'lynnvision'],
  'boss': ['boss'],
  '3dmax': ['3dmax'],
  'apeks': ['apeks'],
  'gamerlegion': ['gamerlegion', 'gamer-legion'],
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

function generateTeamImageUrls(slug: string): string[] {
  const urls: string[] = []
  const variations = teamSlugMap[slug] || [slug]

  for (const v of variations) {
    // Try different variations and extensions
    const slugVariations = [v, v.toLowerCase(), v.replace(/-/g, '')]
    for (const sv of slugVariations) {
      urls.push(`${BASE_URL}/${sv}.png`)
      urls.push(`${BASE_URL}/${sv}.webp`)
      urls.push(`${BASE_URL}/${sv}.svg`)
      urls.push(`${BASE_URL}/${sv}-logo.png`)
      urls.push(`${BASE_URL}/${sv}-logo.webp`)
    }
  }

  return [...new Set(urls)] // Remove duplicates
}

function imageFileExists(imageUrl: string | null): boolean {
  if (!imageUrl) return false
  // Extract filename from /api/uploads/filename.ext
  const match = imageUrl.match(/\/api\/uploads\/(.+)$/)
  if (!match) return false
  const filename = match[1]
  const filepath = path.join(uploadsDir, filename)
  return fs.existsSync(filepath)
}

async function scrapeTeamLogos() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  console.log('=== Scraping Team Logos (from prosettings.net) ===\n')

  // Get ALL organisations and check if their image file exists
  const orgsResult = await pool.query(
    "SELECT id, name, slug, image_url FROM organisations ORDER BY name"
  )

  let downloaded = 0
  let skipped = 0
  let notFound = 0

  for (const org of orgsResult.rows) {
    const hasValidImage = imageFileExists(org.image_url)

    if (hasValidImage) {
      console.log(`  ${org.name} - already has image, skipping`)
      skipped++
      continue
    }

    console.log(`  ${org.name} (${org.slug})`)
    const urls = generateTeamImageUrls(org.slug)

    const result = await downloadImage(urls)

    if (result) {
      const filename = `${randomUUID()}.${result.ext}`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, result.buffer)

      const imageUrl = `/api/uploads/${filename}`
      await pool.query('UPDATE organisations SET image_url = $1 WHERE id = $2', [imageUrl, org.id])
      console.log(`    Saved: ${imageUrl}`)
      downloaded++
    } else {
      console.log(`    Not found on prosettings`)
      notFound++
    }

    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n=== Done ===`)
  console.log(`Downloaded: ${downloaded}`)
  console.log(`Skipped (already have): ${skipped}`)
  console.log(`Not found: ${notFound}`)

  await pool.end()
}

scrapeTeamLogos().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
