import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('digitalocean') ? { rejectUnauthorized: false } : undefined,
})

async function fixUrls() {
  // Fix organisation image URLs from /uploads/ to /api/uploads/
  const result = await pool.query(`
    UPDATE organisations
    SET image_url = REPLACE(image_url, '/uploads/', '/api/uploads/')
    WHERE image_url LIKE '/uploads/%'
  `)

  console.log('Fixed', result.rowCount, 'organisation image URLs')

  const sample = await pool.query('SELECT name, image_url FROM organisations WHERE image_url IS NOT NULL LIMIT 3')
  console.log('Sample URLs:', sample.rows)

  await pool.end()
}

fixUrls().catch(console.error)
