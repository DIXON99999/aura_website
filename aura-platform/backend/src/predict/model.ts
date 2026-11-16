// Model registry: every model version the site has shipped, its config, and
// its walk-forward backtest scores (from `bun src/predict/backtest.ts` on the
// CONFIRM window — the most recent 25% of ~18k cached matches, never used for
// tuning). CURRENT_MODEL is what ingest uses for new predictions.
import { V2_CONFIG, type ModelConfig } from './elo.js'

export interface Backtest {
  logLoss: number
  brier: number
  accuracy: number
  n: number
  tier1Accuracy: number
  tier1N: number
}

export interface ModelInfo {
  version: string
  summary: string
  config: ModelConfig
  backtest: Backtest
}

/** v3 = v2 + provisional K: a team's first 10 matches move its rating 2.5× as
 *  fast, so new teams / reshuffled rosters reach their true level sooner.
 *  Tried and rejected (no reliable gain): tier-weighted K, inactivity shrink,
 *  LAN rating, rating scale, base K, stronger head-to-head. */
export const V3_CONFIG: ModelConfig = { ...V2_CONFIG, provisional: { games: 10, mult: 2.5 } }

export const MODELS: ModelInfo[] = [
  {
    version: 'map-elo-h2h-v2',
    summary: 'Map-level Elo + head-to-head',
    config: V2_CONFIG,
    backtest: { logLoss: 0.6388, brier: 0.2243, accuracy: 0.630, n: 3674, tier1Accuracy: 0.620, tier1N: 245 },
  },
  {
    version: 'elo-v3',
    summary: 'v2 + fast-converging ratings for new teams',
    config: V3_CONFIG,
    backtest: { logLoss: 0.6349, brier: 0.2226, accuracy: 0.642, n: 3674, tier1Accuracy: 0.641, tier1N: 245 },
  },
]

export const CURRENT_MODEL: ModelInfo = MODELS[MODELS.length - 1]
