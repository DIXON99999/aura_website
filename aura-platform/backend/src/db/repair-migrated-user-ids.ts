import { Database } from 'bun:sqlite'
import pg from 'pg'

const { Pool } = pg

async function repairMigratedUserIds() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const sqlite = new Database('./aura.db', { readonly: true })
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const sqliteUsers = sqlite.query('SELECT id, email FROM users').all() as Array<{ id: string; email: string }>
    const pgUsers = (await pool.query<{ id: string; email: string }>('SELECT id, email FROM users')).rows
    const pgIdByEmail = new Map(pgUsers.map((u) => [u.email, u.id]))

    const mismatches = sqliteUsers
      .filter((s) => pgIdByEmail.has(s.email) && pgIdByEmail.get(s.email) !== s.id)
      .map((s) => ({ email: s.email, sqliteId: s.id, pgId: pgIdByEmail.get(s.email)! }))

    if (mismatches.length === 0) {
      console.log('No mismatched user IDs found.')
      return
    }

    console.log(`Found ${mismatches.length} mismatched user IDs. Repairing...`)

    for (const mismatch of mismatches) {
      const { email, sqliteId, pgId } = mismatch
      await pool.query('BEGIN')
      try {
        const sqliteIdExists = (await pool.query('SELECT 1 FROM users WHERE id = $1', [sqliteId])).rows.length > 0
        const pgIdExists = (await pool.query('SELECT 1 FROM users WHERE id = $1', [pgId])).rows.length > 0

        if (sqliteIdExists || !pgIdExists) {
          throw new Error(`Unexpected ID state for ${email}; sqliteIdExists=${sqliteIdExists}, pgIdExists=${pgIdExists}`)
        }

        await pool.query('UPDATE sessions SET user_id = $1 WHERE user_id = $2', [sqliteId, pgId])
        await pool.query('UPDATE events SET owner_id = $1 WHERE owner_id = $2', [sqliteId, pgId])
        await pool.query('UPDATE aura_farms SET owner_id = $1 WHERE owner_id = $2', [sqliteId, pgId])
        await pool.query('UPDATE players SET visitor_id = $1 WHERE visitor_id = $2', [sqliteId, pgId])
        await pool.query('UPDATE user_profiles SET visitor_id = $1 WHERE visitor_id = $2', [sqliteId, pgId])
        await pool.query('UPDATE users SET id = $1 WHERE id = $2', [sqliteId, pgId])

        await pool.query('COMMIT')
        console.log(`Repaired ${email}: ${pgId} -> ${sqliteId}`)
      } catch (error) {
        await pool.query('ROLLBACK')
        throw error
      }
    }

    console.log('User ID repair complete.')
  } finally {
    sqlite.close()
    await pool.end()
  }
}

repairMigratedUserIds().catch((error) => {
  console.error('Repair failed:', error)
  process.exit(1)
})
