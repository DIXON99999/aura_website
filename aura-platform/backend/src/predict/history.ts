// Local cache of CS2 match history for backtesting, so model experiments don't
// re-download ~18k matches each run. The cache holds only the fields the model
// reads (see trim()).
//
//   bun --env-file=.env src/predict/history.ts [pages=180]   # (re)download
//
// Loading the cache (loadHistory) needs no token or network.
import { join } from 'node:path'
import type { PSMatch } from './pandascore.js'

export const HISTORY_FILE = join(import.meta.dir, '..', '..', 'data', 'history.json')

/** Keep just what applyMatch / predict / the backtest use. */
export function trim(m: PSMatch): PSMatch {
  return {
    id: m.id,
    name: m.name,
    scheduled_at: m.scheduled_at,
    begin_at: m.begin_at,
    status: m.status,
    winner_id: m.winner_id,
    draw: m.draw,
    forfeit: m.forfeit,
    number_of_games: m.number_of_games,
    tournament: {
      tier: m.tournament?.tier ?? null,
      type: m.tournament?.type ?? null,
      region: m.tournament?.region ?? null,
    },
    opponents: (m.opponents || []).map((o) => ({
      type: o.type,
      opponent: { id: o.opponent?.id, name: o.opponent?.name, location: o.opponent?.location ?? null },
    })),
    games: (m.games || []).map((g) => ({ position: g.position, finished: g.finished, winner: { id: g.winner?.id } })),
    results: m.results,
  }
}

/** Cached matches, oldest first. */
export async function loadHistory(file = HISTORY_FILE): Promise<PSMatch[]> {
  const f = Bun.file(file)
  if (!(await f.exists())) {
    throw new Error(`No history cache at ${file} — run: bun --env-file=.env src/predict/history.ts`)
  }
  const ms = (await f.json()) as PSMatch[]
  return ms.sort((a, b) => (a.scheduled_at || a.begin_at || '').localeCompare(b.scheduled_at || b.begin_at || ''))
}

async function download(pages: number) {
  const { pastPage } = await import('./pandascore.js') // needs PANDASCORE_TOKEN
  const out = new Map<number, PSMatch>()
  for (let p = 1; p <= pages; p++) {
    const batch = await pastPage(p)
    for (const m of batch) out.set(m.id, trim(m))
    if (p % 20 === 0) console.log(`  page ${p} (${out.size} matches)`)
    if (batch.length < 100) break
    await new Promise((r) => setTimeout(r, 1100)) // stay under 60 req/min
  }
  await Bun.write(HISTORY_FILE, JSON.stringify([...out.values()]))
  console.log(`wrote ${out.size} matches → ${HISTORY_FILE}`)
}

if (import.meta.main) {
  download(Number(process.argv[2] || 180)).catch((e) => { console.error(e); process.exit(1) })
}
