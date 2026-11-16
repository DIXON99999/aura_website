// Walk-forward backtest: replay history oldest → newest with the PRODUCTION
// model (applyMatch / modelProb), predicting every match from ratings as they
// stood before it, then applying its result. Nothing from the future leaks in.
//
// Splits (by time): first 50% = warm-up only, 50–75% = TUNE (choose params),
// last 25% = CONFIRM (untouched while tuning — the honest score).
//
//   bun src/predict/backtest.ts            # needs data/history.json (see history.ts)
import { applyMatch, V2_CONFIG, type ModelConfig, type Ratings } from './elo.js'
import { modelProb, recordH2H, isTier1, type H2HMap } from './logic.js'
import { brier, logLoss, accuracy, type Scored } from './metrics.js'
import type { PSMatch } from './pandascore.js'

export const WARM_GAMES = 5 // score only matches where both teams have ≥ this many prior matches
/** A parameter must cut TUNE log-loss by at least this much to be added —
 *  smaller gains are within noise and just add complexity. */
const MIN_GAIN = 0.001

export interface Row extends Scored { i: number; warm: boolean; tier1: boolean }

/** Matches the model can learn from: decisive, two real teams. */
export function isScorable(m: PSMatch): boolean {
  if (m.draw || m.forfeit || !m.winner_id || m.opponents?.length !== 2) return false
  return m.opponents.every((o) => o.type === 'Team' && o.opponent?.id)
}

/** Predict-then-update over `history` (must be oldest first). */
export function walkForward(history: PSMatch[], cfg: ModelConfig): Row[] {
  const r: Ratings = new Map()
  const h2h: H2HMap = new Map()
  const rows: Row[] = []
  let i = 0
  for (const m of history) {
    if (!isScorable(m)) continue
    const p = modelProb(r, h2h, m, cfg)!
    rows.push({
      i: i++,
      p: p.probA,
      y: m.winner_id === m.opponents[0].opponent!.id ? 1 : 0,
      warm: Math.min(p.teamA.games, p.teamB.games) >= WARM_GAMES,
      tier1: isTier1(m),
    })
    applyMatch(r, m, cfg)
    recordH2H(h2h, m)
  }
  return rows
}

export interface Score { n: number; logLoss: number; brier: number; acc: number }
const score = (xs: Scored[]): Score => ({ n: xs.length, logLoss: logLoss(xs), brier: brier(xs), acc: accuracy(xs) })

/** Score the tune and confirm windows (warm matches), plus tier-1 on confirm. */
export function evaluate(rows: Row[]) {
  const n = rows.length
  const tune = rows.filter((x) => x.i >= n * 0.5 && x.i < n * 0.75 && x.warm)
  const confirm = rows.filter((x) => x.i >= n * 0.75 && x.warm)
  return { tune: score(tune), confirm: score(confirm), confirmTier1: score(confirm.filter((x) => x.tier1)) }
}

// ── Candidate parameters (one group at a time, then greedily combined) ───────
type Patch = Partial<ModelConfig>
const GROUPS: Record<string, Patch[]> = {
  scale: [{ scale: 300 }, { scale: 350 }, { scale: 450 }, { scale: 500 }],
  kMap: [{ kMap: 16 }, { kMap: 20 }, { kMap: 28 }, { kMap: 32 }],
  tierK: [
    { tierK: { s: 1.25, a: 1.1, b: 1, c: 0.9, d: 0.8 } },
    { tierK: { s: 1.5, a: 1.25, b: 1, c: 0.85, d: 0.7 } },
    { tierK: { s: 2, a: 1.5, b: 1, c: 0.75, d: 0.5 } },
  ],
  provisional: [
    { provisional: { games: 5, mult: 3 } },
    { provisional: { games: 10, mult: 1.5 } },
    { provisional: { games: 10, mult: 2 } },
    { provisional: { games: 10, mult: 2.5 } },
    { provisional: { games: 10, mult: 3 } },
    { provisional: { games: 20, mult: 2 } },
  ],
  inactivity: [
    { inactivity: { graceDays: 30, halfLifeDays: 60 } },
    { inactivity: { graceDays: 30, halfLifeDays: 120 } },
    { inactivity: { graceDays: 60, halfLifeDays: 180 } },
  ],
  lan: [
    { lan: { k: 24, weight: 0.3 } },
    { lan: { k: 24, weight: 0.5 } },
    { lan: { k: 32, weight: 0.5 } },
  ],
  h2h: [{ h2hMaxWeight: 0 }, { h2hMaxWeight: 0.2 }, { h2hMaxWeight: 0.4 }],
}

const describe = (p: Patch) => JSON.stringify(p).replace(/[{}"]/g, '').replace(/:/g, '=')
const fmt = (s: Score) => `${s.logLoss.toFixed(4)}  ${s.brier.toFixed(4)}  ${(s.acc * 100).toFixed(1)}%`
function line(label: string, e: ReturnType<typeof evaluate>, base?: ReturnType<typeof evaluate>) {
  const d = base ? (e.tune.logLoss - base.tune.logLoss) : 0
  const mark = base ? (d < 0 ? ` ▼${(-d).toFixed(4)}` : ` ▲${d.toFixed(4)}`) : ''
  console.log(`${label.padEnd(58)} ${fmt(e.tune)}${mark.padEnd(10)} | ${fmt(e.confirm)} | ${fmt(e.confirmTier1)}`)
}

async function main() {
  const { loadHistory } = await import('./history.js')
  const history = await loadHistory()
  const run = (cfg: ModelConfig) => evaluate(walkForward(history, cfg))
  const base = run(V2_CONFIG)
  const rows = walkForward(history, V2_CONFIG)
  console.log(`${history.length} cached matches, ${rows.length} scorable · tune n=${base.tune.n}, confirm n=${base.confirm.n} (tier-1 ${base.confirmTier1.n})\n`)
  console.log(`${''.padEnd(58)} TUNE logloss brier  acc            | CONFIRM logloss brier acc | CONFIRM tier-1`)
  line('v2 (shipped)', base)

  // 1) each parameter alone
  const bestPerGroup: Record<string, { patch: Patch; e: ReturnType<typeof evaluate> } | null> = {}
  for (const [g, patches] of Object.entries(GROUPS)) {
    console.log(`— ${g}`)
    let best: { patch: Patch; e: ReturnType<typeof evaluate> } | null = null
    for (const patch of patches) {
      const e = run({ ...V2_CONFIG, ...patch })
      line(`  ${describe(patch)}`, e, base)
      if (e.tune.logLoss < base.tune.logLoss && (!best || e.tune.logLoss < best.e.tune.logLoss)) best = { patch, e }
    }
    bestPerGroup[g] = best
  }

  // 2) greedy combination on the TUNE window, biggest single gain first
  const order = Object.entries(bestPerGroup).filter(([, b]) => b).sort((a, b) => a[1]!.e.tune.logLoss - b[1]!.e.tune.logLoss)
  let cfg: ModelConfig = { ...V2_CONFIG }
  let cur = base
  console.log(`\n— greedy combination (kept only if TUNE log-loss improves by ≥ ${MIN_GAIN})`)
  for (const [g, b] of order) {
    const trial = { ...cfg, ...b!.patch }
    const e = run(trial)
    const keep = cur.tune.logLoss - e.tune.logLoss >= MIN_GAIN
    line(`  ${keep ? '+' : '×'} ${g}: ${describe(b!.patch)}`, e, base)
    if (keep) { cfg = trial; cur = e }
  }

  console.log('\n— RESULT')
  line('v2 (shipped)', base)
  line('v3 candidate', cur, base)
  const better = cur.confirm.logLoss < base.confirm.logLoss
  console.log(`\nConfirm-window log-loss: v2 ${base.confirm.logLoss.toFixed(4)} → v3 ${cur.confirm.logLoss.toFixed(4)}  ${better ? 'IMPROVES ✓' : 'does NOT improve ✗'}`)
  console.log(`v3 config: ${JSON.stringify(cfg)}`)
}

if (import.meta.main) main().catch((e) => { console.error(e); process.exit(1) })
