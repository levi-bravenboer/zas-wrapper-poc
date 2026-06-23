import { describe, expect, it } from 'vitest'

import type { LusciiMeasurementSeries } from '../charts/types'

import { computeStats } from './aggregates'

const numeric = (values: number[], unit: string | null = null): LusciiMeasurementSeries =>
  ({
    series_id: 's',
    instrument_id: 'i',
    item_id: 'it',
    archetype: 'numeric',
    unit,
    points: values.map((value, idx) => ({
      archetype: 'numeric',
      value,
      observed_at: `2026-06-${String(idx + 1).padStart(2, '0')}`,
    })),
  }) as unknown as LusciiMeasurementSeries

describe('computeStats', () => {
  it('computes average, min, max, latest with the unit', () => {
    const stats = computeStats([numeric([80, 136, 100], 'bpm')])
    expect(stats).not.toBeNull()
    expect(stats?.unit).toBe('bpm')
    expect(stats?.minimum).toBe('80')
    expect(stats?.maximum).toBe('136')
    expect(stats?.latest).toBe('100')
    // (80 + 136 + 100) / 3 = 105.33 → one decimal, comma separator
    expect(stats?.average).toBe('105,3')
  })

  it('returns null when there are no numeric/ordinal points', () => {
    const categorical = {
      series_id: 's',
      instrument_id: 'i',
      item_id: 'it',
      archetype: 'categorical',
      unit: null,
      points: [{ archetype: 'categorical', responses: ['Ja'], observed_at: '2026-06-01' }],
    } as unknown as LusciiMeasurementSeries
    expect(computeStats([categorical])).toBeNull()
  })
})
