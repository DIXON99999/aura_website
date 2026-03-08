import { Database } from 'bun:sqlite'
import pg from 'pg'

const { Pool } = pg

type SqliteRow = Record<string, unknown>

interface PgColumn {
  column_name: string
  data_type: string
}

const SQLITE_PATH = process.env.SQLITE_PATH ?? './aura.db'

const TABLE_ORDER = [
  'countries',
  'games',
  'regions',
  'organisations',
  'organisation_games',
  'brands',
  'peripherals',
  'roles',
  'weapons',
  'characters',
  'players',
  'user_profiles',
  'users',
  'sessions',
  'events',
  'event_participants',
  'sub_events',
  'sub_event_participants',
  'aura_farms',
  'votes',
  'event_votes',
  'sub_event_votes',
  'sub_event_comments',
  'sub_event_comment_votes',
  'aura_farm_votes',
  'visitor_credits',
]

function asDateValue(value: unknown): string | null {
  if (value == null) return null

  if (typeof value === 'number') {
    // SQLite stored timestamps as epoch milliseconds.
    return new Date(value).toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) {
      return new Date(numeric).toISOString()
    }
    return trimmed
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return null
}

function asBooleanValue(value: unknown): boolean | null {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (['1', 'true', 't', 'yes', 'y'].includes(v)) return true
    if (['0', 'false', 'f', 'no', 'n'].includes(v)) return false
  }
  return null
}

function asJsonValue(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      return JSON.stringify(JSON.parse(trimmed))
    } catch {
      if (trimmed.includes(',')) {
        return JSON.stringify(
          trimmed
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        )
      }
      return JSON.stringify([trimmed])
    }
  }
  return JSON.stringify(value)
}

function normalizeValue(value: unknown, dataType: string): unknown {
  if (value == null) return null

  if (dataType === 'timestamp with time zone' || dataType === 'timestamp without time zone') {
    return asDateValue(value)
  }
  if (dataType === 'boolean') {
    return asBooleanValue(value)
  }
  if (dataType === 'json' || dataType === 'jsonb') {
    return asJsonValue(value)
  }

  return value
}

function getSourceValue(row: SqliteRow, columnName: string): unknown {
  if (columnName in row) return row[columnName]

  // Legacy SQLite vote tables used created_at where Postgres expects timestamp.
  if (columnName === 'timestamp' && 'created_at' in row) {
    return row.created_at
  }

  return null
}

function hasSourceColumn(row: SqliteRow, columnName: string): boolean {
  if (columnName in row) return true
  if (columnName === 'timestamp' && 'created_at' in row) return true
  return false
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

async function getPgTableColumns(pool: InstanceType<typeof Pool>, tableName: string): Promise<PgColumn[]> {
  const result = await pool.query<PgColumn>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  )
  return result.rows
}

async function getPgPrimaryKeyColumns(pool: InstanceType<typeof Pool>, tableName: string): Promise<string[]> {
  const result = await pool.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.table_name = $1
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [tableName]
  )
  return result.rows.map((r) => r.column_name)
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('digitalocean') ? { rejectUnauthorized: false } : undefined,
  })

  try {
    const sqliteTables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>
    const sqliteTableSet = new Set(sqliteTables.map((t) => t.name))

    const orderedTables = TABLE_ORDER.filter((t) => sqliteTableSet.has(t))
    const extraTables = [...sqliteTableSet].filter((t) => !orderedTables.includes(t)).sort()
    const tablesToProcess = [...orderedTables, ...extraTables]

    console.log(`SQLite source: ${SQLITE_PATH}`)
    console.log(`Found ${tablesToProcess.length} SQLite tables to process`)

    for (const table of tablesToProcess) {
      const pgColumns = await getPgTableColumns(pool, table)
      if (pgColumns.length === 0) {
        console.log(`- Skipping ${table}: table does not exist in Postgres`)
        continue
      }

      const sqliteRows = sqlite.query(`SELECT * FROM ${quoteIdent(table)}`).all() as SqliteRow[]
      if (sqliteRows.length === 0) {
        console.log(`- ${table}: 0 rows`)
        continue
      }

      const sampleRow = sqliteRows[0]!
      const insertColumns = pgColumns.filter((c) => hasSourceColumn(sampleRow, c.column_name))
      if (insertColumns.length === 0) {
        console.log(`- Skipping ${table}: no matching columns`)
        continue
      }

      const pkColumns = await getPgPrimaryKeyColumns(pool, table)

      const colNames = insertColumns.map((c) => quoteIdent(c.column_name)).join(', ')
      const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ')

      let conflictClause = 'ON CONFLICT DO NOTHING'
      if (pkColumns.length > 0) {
        const conflictTarget = pkColumns.map(quoteIdent).join(', ')
        const updateSet = insertColumns
          .filter((c) => !pkColumns.includes(c.column_name))
          .map((c) => `${quoteIdent(c.column_name)} = EXCLUDED.${quoteIdent(c.column_name)}`)
          .join(', ')
        if (updateSet.length > 0) {
          conflictClause = `ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateSet}`
        }
      }

      const sql = `INSERT INTO ${quoteIdent(table)} (${colNames}) VALUES (${placeholders}) ${conflictClause}`

      await pool.query('BEGIN')
      try {
        let migratedRows = 0
        let skippedRows = 0
        for (const row of sqliteRows) {
          const values = insertColumns.map((c) => normalizeValue(getSourceValue(row, c.column_name), c.data_type))
          try {
            await pool.query(sql, values)
            migratedRows += 1
          } catch (rowError) {
            const rowMessage = (rowError as Error).message
            if (
              rowMessage.includes('violates foreign key constraint') ||
              rowMessage.includes('duplicate key value violates unique constraint')
            ) {
              skippedRows += 1
              continue
            }
            const jsonColumns = insertColumns.filter((c) => c.data_type === 'json' || c.data_type === 'jsonb')
            const jsonDebug = Object.fromEntries(
              jsonColumns.map((c) => [c.column_name, normalizeValue(row[c.column_name], c.data_type)])
            )
            const rowId = typeof row.id === 'string' ? row.id : '(no id column)'
            throw new Error(
              `row insert failed (id=${rowId}): ${(rowError as Error).message}; json=${JSON.stringify(jsonDebug)}`
            )
          }
        }
        await pool.query('COMMIT')
        if (skippedRows > 0) {
          console.log(`- ${table}: migrated ${migratedRows} rows (${skippedRows} skipped due to FK constraints)`)
        } else {
          console.log(`- ${table}: migrated ${migratedRows} rows`)
        }
      } catch (error) {
        await pool.query('ROLLBACK')
        throw new Error(`Failed table "${table}": ${(error as Error).message}`)
      }
    }

    console.log('SQLite -> Postgres migration complete.')
  } finally {
    sqlite.close()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
