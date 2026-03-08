import pg from 'pg'

const { Pool } = pg

async function checkUserMigration() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const email = 'liam.t.dixon@gmail.com'
    const userResult = await pool.query(
      'SELECT id, email, player_id, created_at FROM users WHERE email = $1',
      [email]
    )
    const user = userResult.rows[0] as { id: string; email: string; player_id: string | null; created_at: string } | undefined
    if (!user) {
      console.log(JSON.stringify({ error: 'user not found', email }, null, 2))
      return
    }

    const [profileResult, eventResult, farmResult, sessionsResult] = await Promise.all([
      pool.query(
        'SELECT id, name, visitor_id, is_user_profile, country_id, main_game_id FROM players WHERE visitor_id = $1 AND is_user_profile = true',
        [user.id]
      ),
      pool.query('SELECT id, name, owner_id FROM events WHERE owner_id = $1 ORDER BY created_at DESC', [user.id]),
      pool.query('SELECT id, title, owner_id FROM aura_farms WHERE owner_id = $1 ORDER BY created_at DESC', [user.id]),
      pool.query('SELECT COUNT(*)::int as c FROM sessions WHERE user_id = $1', [user.id]),
    ])

    console.log(
      JSON.stringify(
        {
          user,
          profileCount: profileResult.rows.length,
          eventCount: eventResult.rows.length,
          farmCount: farmResult.rows.length,
          sessions: sessionsResult.rows[0]?.c ?? 0,
          events: eventResult.rows,
          auraFarms: farmResult.rows,
        },
        null,
        2
      )
    )
  } finally {
    await pool.end()
  }
}

checkUserMigration().catch((error) => {
  console.error(error)
  process.exit(1)
})
