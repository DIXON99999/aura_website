import pg from 'pg'

const { Pool } = pg

async function fixImageUrls() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    // Fix aura_farms image URLs - extract filename from old URL and make it relative
    const auraFarmsResult = await pool.query(`
      UPDATE aura_farms 
      SET image_url = '/api/uploads/' || SUBSTRING(image_url FROM '[^/]+$')
      WHERE image_url IS NOT NULL 
        AND image_url LIKE '%trycloudflare.com%'
      RETURNING id, title, image_url
    `)

    console.log(`Fixed ${auraFarmsResult.rowCount} aura_farms image URLs:`)
    for (const row of auraFarmsResult.rows) {
      console.log(`  - ${row.title}: ${row.image_url}`)
    }

    // Check if there are any other tables with cloudflare URLs
    const tables = ['events', 'players', 'sub_events']
    for (const table of tables) {
      const checkResult = await pool.query(`
        SELECT COUNT(*) as count FROM ${table} 
        WHERE image_url LIKE '%trycloudflare.com%'
      `)
      if (parseInt(checkResult.rows[0].count) > 0) {
        console.log(`\nFixing ${table}...`)
        const fixResult = await pool.query(`
          UPDATE ${table} 
          SET image_url = '/api/uploads/' || SUBSTRING(image_url FROM '[^/]+$')
          WHERE image_url IS NOT NULL 
            AND image_url LIKE '%trycloudflare.com%'
          RETURNING id, image_url
        `)
        console.log(`  Fixed ${fixResult.rowCount} rows`)
      }
    }

    console.log('\nDone!')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

fixImageUrls()
