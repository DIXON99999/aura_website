// Elo backtest on PandaScore CS2 history — proves predictive signal before we build anything.
// Pulls recent past matches, replays them chronologically, predicts each BEFORE updating ratings.

const TOKEN = process.env.PANDASCORE_TOKEN
if (!TOKEN) { console.error('Missing PANDASCORE_TOKEN'); process.exit(1) }

const BASE = 'https://api.pandascore.co'
const PAGES = Number(process.env.PAGES || 50)   // 50 pages * 100 = 5000 most-recent matches
const K = Number(process.env.K || 32)
const START = 1500
const WARM = Number(process.env.WARM || 10)     // only score matches where both teams have >= WARM prior games
const WARMUP_FRAC = Number(process.env.WARMUP_FRAC || 0.5) // train on first half, score the rest

interface Opp { type?: string; opponent?: { id?: number; name?: string } }
interface Match {
  id: number; name: string; scheduled_at: string | null; begin_at: string | null
  winner_id: number | null; winner_type?: string; draw?: boolean; forfeit?: boolean
  opponents: Opp[]
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchPage(page: number, tries = 0): Promise<Match[]> {
  const url = `${BASE}/csgo/matches/past?per_page=100&page=${page}&sort=-scheduled_at&token=${TOKEN}`
  const res = await fetch(url)
  if (res.status === 429 && tries < 5) {
    const wait = Number(res.headers.get('retry-after') || 2) * 1000 + 500
    await sleep(wait)
    return fetchPage(page, tries + 1)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}: ${(await res.text()).slice(0, 200)}`)
  return res.json() as Promise<Match[]>
}

function expected(a: number, b: number): number { return 1 / (1 + Math.pow(10, (b - a) / 400)) }

async function main() {
  console.log(`Fetching ${PAGES} pages (${PAGES * 100} most-recent CS2 matches)...`)
  const all: Match[] = []
  for (let p = 1; p <= PAGES; p++) {
    const batch = await fetchPage(p)
    all.push(...batch)
    if (batch.length < 100) break
    if (p % 10 === 0) process.stdout.write(`  page ${p} (${all.length} matches)\n`)
    await sleep(1100)   // stay under the 60 req/min burst limit
  }

  // Keep only decisive Team-vs-Team matches, sorted chronologically (oldest first)
  const clean = all
    .filter(m => !m.draw && !m.forfeit && m.winner_id && m.opponents?.length === 2)
    .filter(m => m.opponents.every(o => o.opponent?.id && o.type === 'Team'))
    .map(m => ({ ...m, t: m.scheduled_at || m.begin_at || '' }))
    .filter(m => m.t)
    .sort((a, b) => a.t.localeCompare(b.t))

  console.log(`\n${clean.length} decisive Team-vs-Team matches`)
  if (clean.length) console.log(`Date range: ${clean[0].t.slice(0,10)} → ${clean[clean.length-1].t.slice(0,10)}`)

  const elo = new Map<number, number>()
  const games = new Map<number, number>()
  const R = (id: number) => elo.get(id) ?? START
  const G = (id: number) => games.get(id) ?? 0

  let scored = 0, correct = 0, brier = 0, logloss = 0
  let warmScored = 0, warmCorrect = 0, warmBrier = 0
  const scoreFrom = Math.floor(clean.length * WARMUP_FRAC)

  for (let i = 0; i < clean.length; i++) {
    const m = clean[i]
    const inTest = i >= scoreFrom            // only score the held-out later period
    const [o1, o2] = m.opponents
    const id1 = o1.opponent!.id!, id2 = o2.opponent!.id!
    const r1 = R(id1), r2 = R(id2)
    const p1 = expected(r1, r2)                 // predicted P(team1 wins)
    const won1 = m.winner_id === id1 ? 1 : 0

    const bothWarm = G(id1) >= WARM && G(id2) >= WARM
    const pickCorrect = (p1 >= 0.5 ? won1 === 1 : won1 === 0) ? 1 : 0
    const b = Math.pow(p1 - won1, 2)
    const ll = -(won1 * Math.log(Math.max(p1, 1e-9)) + (1 - won1) * Math.log(Math.max(1 - p1, 1e-9)))
    if (inTest) {
      scored++; correct += pickCorrect; brier += b; logloss += ll
      if (bothWarm) { warmScored++; warmCorrect += pickCorrect; warmBrier += b }
    }

    // Update ratings
    elo.set(id1, r1 + K * (won1 - p1))
    elo.set(id2, r2 + K * ((1 - won1) - (1 - p1)))
    games.set(id1, G(id1) + 1); games.set(id2, G(id2) + 1)
  }

  const pct = (n: number, d: number) => d ? (100 * n / d).toFixed(1) + '%' : 'n/a'
  console.log(`\n================ ELO BACKTEST ================`)
  console.log(`Trained on first ${(WARMUP_FRAC*100).toFixed(0)}%, scored held-out ${((1-WARMUP_FRAC)*100).toFixed(0)}%`)
  console.log(`Test predictions:  ${scored}`)
  console.log(`  Accuracy:        ${pct(correct, scored)}   (coin-flip = 50%)`)
  console.log(`  Brier score:     ${(brier / scored).toFixed(4)}   (lower better; 0.25 = no skill)`)
  console.log(`  Log loss:        ${(logloss / scored).toFixed(4)}   (0.693 = no skill)`)
  console.log(`\nWarm matches (both teams >= ${WARM} prior games): ${warmScored}`)
  console.log(`  Accuracy:        ${pct(warmCorrect, warmScored)}`)
  console.log(`  Brier score:     ${warmScored ? (warmBrier / warmScored).toFixed(4) : 'n/a'}`)
  console.log(`\nTeams rated: ${elo.size}`)
  const top = [...elo.entries()].filter(([id]) => G(id) >= 20).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const nameOf = new Map<number, string>()
  for (const m of clean) for (const o of m.opponents) nameOf.set(o.opponent!.id!, o.opponent!.name || '?')
  console.log(`\nTop 10 teams by current Elo (>=20 games):`)
  for (const [id, r] of top) console.log(`  ${Math.round(r)}  ${nameOf.get(id)}  (${G(id)} games)`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
