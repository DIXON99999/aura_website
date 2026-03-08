import pg from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Map org slugs to GitHub folder paths (game/team-folder)
const orgLogoMap: Record<string, string[]> = {
  'vitality': ['cs/team-vitality', 'valorant/team-vitality'],
  'team-spirit': ['cs/team-spirit', 'dota2/team-spirit'],
  'falcons': ['cs/falcons', 'cs/falcons-esport', 'cs/team-falcons'],
  'furia': ['cs/furia', 'valorant/furia'],
  'mouz': ['cs/mousesports', 'cs/mouz'],
  'g2': ['cs/g2-esports', 'valorant/g2-esports', 'lol/g2-esports'],
  'parivision': [],
  'navi': ['cs/natus-vincere', 'valorant/natus-vincere', 'dota2/natus-vincere'],
  'faze': ['cs/faze-clan', 'valorant/faze-clan'],
  'astralis': ['cs/astralis', 'lol/astralis'],
  'aurora': ['cs/aurora-gaming', 'cs/aurora'],
  'liquid': ['cs/team-liquid', 'valorant/team-liquid', 'dota2/team-liquid'],
  'col': ['cs/complexity', 'cs/complexity-gaming'],
  'mongolz': ['cs/the-mongolz'],
  'bleed': ['valorant/bleed', 'valorant/bleed-esports'],
  'sen': ['valorant/sentinels'],
  'c9': ['cs/cloud9', 'valorant/cloud9', 'lol/cloud9'],
  '100t': ['cs/100-thieves', 'valorant/100-thieves', 'lol/100-thieves'],
  'nrg': ['cs/nrg', 'cs/nrg-esports', 'valorant/nrg'],
  'eg': ['cs/evil-geniuses', 'valorant/evil-geniuses', 'dota2/evil-geniuses'],
  'loud': ['cs/loud', 'valorant/loud'],
  'fnatic': ['cs/fnatic', 'valorant/fnatic', 'dota2/fnatic'],
  'drx': ['cs/drx', 'valorant/drx', 'lol/drx'],
  'prx': ['valorant/paper-rex'],
  'edg': ['lol/edward-gaming', 'valorant/edward-gaming', 'valorant/edg'],
  't1': ['cs/t1', 'valorant/t1', 'lol/t1', 'lol/sk-telecom-t1'],
  'kc': ['cs/karmine-corp', 'valorant/karmine-corp', 'lol/karmine-corp'],
  'kru': ['valorant/kru', 'valorant/kru-esports'],
  'zeta': ['valorant/zeta-division'],
  'geng': ['call-of-duty/gen.g-esports', 'cs/geng', 'cs/gen-g', 'valorant/gen-g', 'lol/gen-g'],
  'blg': ['lol/bilibili-gaming', 'lol/bilibili'],
  'lev': ['valorant/leviatan'],
  'heretics': ['cs/team-heretics', 'valorant/team-heretics'],
  'dig': ['cs/dignitas', 'valorant/dignitas'],
  'bcgame': [],
  'chiefs': ['cs/chiefs-esports-club', 'cs/chiefs'],
  'rivals': [],
  'fury': [],
}

const uploadsDir = path.join(process.cwd(), 'uploads')

async function downloadLogo(githubPath: string): Promise<Buffer | null> {
  // The logo filename is {folder-name}-logo.png
  const folderName = githubPath.split('/').pop()
  const url = `https://raw.githubusercontent.com/lootmarket/esport-team-logos/master/${githubPath}/${folderName}-logo.png`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.log(`  Not found: ${url}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.log(`  Error fetching ${url}:`, error)
    return null
  }
}

async function downloadLogos() {
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  // Get all organisations from database
  const orgsResult = await pool.query('SELECT id, slug, name, image_url FROM organisations')
  const orgs = orgsResult.rows

  console.log(`Found ${orgs.length} organisations in database`)

  for (const org of orgs) {
    const paths = orgLogoMap[org.slug]

    if (!paths || paths.length === 0) {
      console.log(`\nNo logo mapping for: ${org.name} (${org.slug})`)
      continue
    }

    if (org.image_url) {
      console.log(`\nSkipping ${org.name} - already has image`)
      continue
    }

    console.log(`\nSearching logo for: ${org.name} (${org.slug})`)

    let logoBuffer: Buffer | null = null
    let foundPath = ''

    for (const githubPath of paths) {
      console.log(`  Trying: ${githubPath}`)
      logoBuffer = await downloadLogo(githubPath)
      if (logoBuffer) {
        foundPath = githubPath
        break
      }
    }

    if (logoBuffer) {
      const filename = `${randomUUID()}.png`
      const filepath = path.join(uploadsDir, filename)
      fs.writeFileSync(filepath, logoBuffer)

      // Update database with the image URL
      const imageUrl = `/api/uploads/${filename}`
      await pool.query('UPDATE organisations SET image_url = $1 WHERE id = $2', [imageUrl, org.id])

      console.log(`  SUCCESS: Downloaded from ${foundPath} -> ${imageUrl}`)
    } else {
      console.log(`  FAILED: No logo found for ${org.name}`)
    }
  }

  console.log('\nDone!')
  await pool.end()
}

downloadLogos().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
