// In-process scheduler: keeps predictions fresh while the backend runs.
//  - live poll (map scores + live odds for running matches) every LIVE_SECONDS
//  - light refresh (predict + settle + capture maps) every REFRESH_MINUTES
//  - full backfill (rebuild ratings + H2H) every BACKFILL_HOURS
// Runs never overlap. Disable with SCHEDULER=0.
import { runRefresh, runBackfill, pollLive } from './ingest.js'

const LIVE_MS = Number(process.env.LIVE_SECONDS || 60) * 1000
const REFRESH_MS = Number(process.env.REFRESH_MINUTES || 30) * 60_000
const BACKFILL_MS = Number(process.env.BACKFILL_HOURS || 12) * 3_600_000

let running = false
async function guarded(fn: () => Promise<unknown>, label: string, quiet = false) {
  if (running) { if (!quiet) console.log(`[scheduler] ${label} skipped — a run is in progress`); return }
  running = true
  const t = Date.now()
  try {
    if (!quiet) console.log(`[scheduler] ${label} started`)
    await fn()
    if (!quiet) console.log(`[scheduler] ${label} done in ${((Date.now() - t) / 1000).toFixed(0)}s`)
  } catch (e) {
    console.error(`[scheduler] ${label} failed:`, e)
  } finally {
    running = false
  }
}

let lastLive = 0
async function live() {
  const n = await pollLive()
  if (n !== lastLive) console.log(`[live] ${n} match(es) live`)
  lastLive = n
}

export function startScheduler() {
  if (process.env.SCHEDULER === '0') { console.log('[scheduler] disabled (SCHEDULER=0)'); return }
  console.log(`[scheduler] on — live poll every ${LIVE_MS / 1000}s, refresh every ${REFRESH_MS / 60000}m, full backfill every ${BACKFILL_MS / 3600000}h`)
  setTimeout(() => guarded(runRefresh, 'initial refresh'), 3_000)
  setInterval(() => guarded(live, 'live poll', true), LIVE_MS) // quiet: logs only when the live count changes
  setInterval(() => guarded(runRefresh, 'refresh'), REFRESH_MS)
  setInterval(() => guarded(runBackfill, 'backfill'), BACKFILL_MS)
}
