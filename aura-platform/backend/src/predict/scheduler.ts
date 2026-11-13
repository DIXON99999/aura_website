// In-process scheduler: keeps predictions fresh while the backend runs.
//  - light refresh (predict + settle + capture maps) every REFRESH_MINUTES
//  - full backfill (rebuild ratings + H2H) every BACKFILL_HOURS
// Runs never overlap. Disable with SCHEDULER=0.
import { runRefresh, runBackfill } from './ingest.js'

const REFRESH_MS = Number(process.env.REFRESH_MINUTES || 30) * 60_000
const BACKFILL_MS = Number(process.env.BACKFILL_HOURS || 12) * 3_600_000

let running = false
async function guarded(fn: () => Promise<void>, label: string) {
  if (running) { console.log(`[scheduler] ${label} skipped — a run is in progress`); return }
  running = true
  const t = Date.now()
  try {
    console.log(`[scheduler] ${label} started`)
    await fn()
    console.log(`[scheduler] ${label} done in ${((Date.now() - t) / 1000).toFixed(0)}s`)
  } catch (e) {
    console.error(`[scheduler] ${label} failed:`, e)
  } finally {
    running = false
  }
}

export function startScheduler() {
  if (process.env.SCHEDULER === '0') { console.log('[scheduler] disabled (SCHEDULER=0)'); return }
  console.log(`[scheduler] on — refresh every ${REFRESH_MS / 60000}m, full backfill every ${BACKFILL_MS / 3600000}h`)
  setTimeout(() => guarded(runRefresh, 'initial refresh'), 3_000)
  setInterval(() => guarded(runRefresh, 'refresh'), REFRESH_MS)
  setInterval(() => guarded(runBackfill, 'backfill'), BACKFILL_MS)
}
