import { describe, expect, it } from 'vitest'

import {
  collectSparkPoints,
  formatNumber,
  formatPoint,
  isAllNumeric,
  pickLatest,
  pickTrend,
  type SparkPoint,
} from './instrumentSummary'
import type { LusciiMeasurementSeries } from './types'

const numericSeries = (
  points: Array<{ value: number; observed_at: string }>,
  unit: string | null = null,
): LusciiMeasurementSeries =>
  ({
    archetype: 'numeric',
    unit,
    points: points.map((p) => ({ archetype: 'numeric', value: p.value, observed_at: p.observed_at })),
  }) as unknown as LusciiMeasurementSeries

describe('formatNumber', () => {
  it('keeps integers bare', () => {
    expect(formatNumber(72)).toBe('72')
  })

  it('renders one decimal with a comma separator', () => {
    expect(formatNumber(36.6)).toBe('36,6')
  })
})

describe('formatPoint', () => {
  it('appends the unit for numeric points', () => {
    const s = numericSeries([{ value: 80, observed_at: '2026-06-01' }], 'bpm')
    expect(formatPoint(s, s.points![0]!)).toBe('80 bpm')
  })

  it('joins categorical responses', () => {
    const s = { archetype: 'categorical', unit: null } as unknown as LusciiMeasurementSeries
    const point = { archetype: 'categorical', responses: ['Ja', 'Soms'], observed_at: '2026-06-01' }
    expect(formatPoint(s, point as never)).toBe('Ja, Soms')
  })

  it('returns the dash for an empty categorical response', () => {
    const s = { archetype: 'categorical', unit: null } as unknown as LusciiMeasurementSeries
    const point = { archetype: 'categorical', responses: null, observed_at: '2026-06-01' }
    expect(formatPoint(s, point as never)).toBe('—')
  })
})

describe('pickLatest', () => {
  it('returns the value with the most recent observed_at across series', () => {
    const a = numericSeries([{ value: 1, observed_at: '2026-06-01' }])
    const b = numericSeries([{ value: 9, observed_at: '2026-06-03' }])
    expect(pickLatest([a, b])).toBe('9')
  })

  it('returns null when there are no points', () => {
    expect(pickLatest([])).toBeNull()
  })
})

describe('collectSparkPoints', () => {
  it('collects numeric/ordinal points sorted chronologically', () => {
    const s = numericSeries([
      { value: 2, observed_at: '2026-06-02' },
      { value: 1, observed_at: '2026-06-01' },
    ])
    const points = collectSparkPoints([s])
    expect(points.map((p) => p.value)).toEqual([1, 2])
  })
})

describe('pickTrend', () => {
  const pt = (value: number): SparkPoint =>
    ({ archetype: 'numeric', value, observed_at: '2026-06-01' }) as SparkPoint

  it('reports an upward step', () => {
    expect(pickTrend([pt(1), pt(3)])).toEqual({ delta: 2, dir: 'up' })
  })

  it('reports a downward step', () => {
    expect(pickTrend([pt(5), pt(2)])).toEqual({ delta: -3, dir: 'down' })
  })

  it('reports a flat step', () => {
    expect(pickTrend([pt(4), pt(4)])).toEqual({ delta: 0, dir: 'flat' })
  })

  it('returns null with fewer than two points', () => {
    expect(pickTrend([pt(1)])).toBeNull()
  })
})

describe('isAllNumeric', () => {
  it('is true when every series is numeric', () => {
    expect(isAllNumeric([numericSeries([{ value: 1, observed_at: '2026-06-01' }])])).toBe(true)
  })

  it('is false for an empty list', () => {
    expect(isAllNumeric([])).toBe(false)
  })

  it('is false when a non-numeric series is present', () => {
    const ordinal = { archetype: 'ordinal' } as unknown as LusciiMeasurementSeries
    expect(isAllNumeric([numericSeries([{ value: 1, observed_at: '2026-06-01' }]), ordinal])).toBe(
      false,
    )
  })
})
