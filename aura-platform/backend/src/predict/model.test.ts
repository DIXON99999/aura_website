import { describe, expect, test } from 'bun:test'
import { CURRENT_MODEL, MODELS, V3_CONFIG } from './model'
import { V2_CONFIG } from './elo'

describe('model registry', () => {
  test('current model is the newest version', () => {
    expect(CURRENT_MODEL).toBe(MODELS.at(-1)!)
    expect(CURRENT_MODEL.version).toBe('elo-v3')
  })

  test('version names are unique (they key live results by model_version)', () => {
    expect(new Set(MODELS.map((m) => m.version)).size).toBe(MODELS.length)
  })

  test('v3 differs from v2 only by provisional K', () => {
    const { provisional, ...rest3 } = V3_CONFIG
    const { provisional: p2, ...rest2 } = V2_CONFIG
    expect(rest3).toEqual(rest2)
    expect(p2).toBeNull()
    expect(provisional).toEqual({ games: 10, mult: 2.5 })
  })

  test('each shipped version improved on the one before (backtest log-loss)', () => {
    for (let i = 1; i < MODELS.length; i++) {
      expect(MODELS[i].backtest.logLoss).toBeLessThan(MODELS[i - 1].backtest.logLoss)
    }
  })
})
