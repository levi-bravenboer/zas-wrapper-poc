import { describe, expect, it } from 'vitest'

import { groupSeriesByInstrument, hasErrorCode } from './grouping'
import type { LusciiMeasurementSeries } from './types'

const series = (
  instrumentId: string,
  observedAt: string[],
  instrumentName: string | null = null,
): LusciiMeasurementSeries =>
  ({
    series_id: `${instrumentId}-${observedAt.join('')}`,
    instrument_id: instrumentId,
    instrument_name: instrumentName,
    item_id: 'item',
    archetype: 'numeric',
    points: observedAt.map((at) => ({ archetype: 'numeric', value: 1, observed_at: at })),
  }) as unknown as LusciiMeasurementSeries

describe('groupSeriesByInstrument', () => {
  it('buckets series by instrument id', () => {
    const groups = groupSeriesByInstrument([
      series('a', ['2026-06-01']),
      series('a', ['2026-06-02']),
      series('b', ['2026-06-01']),
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.instrument_id === 'a')?.series).toHaveLength(2)
  })

  it('skips series with no points', () => {
    const empty = { instrument_id: 'c', points: [] } as unknown as LusciiMeasurementSeries
    expect(groupSeriesByInstrument([empty])).toHaveLength(0)
  })

  it('keeps backend order by default (no sort)', () => {
    const groups = groupSeriesByInstrument([
      series('old', ['2026-01-01']),
      series('new', ['2026-06-01']),
    ])
    expect(groups.map((g) => g.instrument_id)).toEqual(['old', 'new'])
  })

  it('puts the freshest instrument first when sorting by freshness', () => {
    const groups = groupSeriesByInstrument(
      [series('old', ['2026-01-01']), series('new', ['2026-06-01'])],
      { sort: 'freshness' },
    )
    expect(groups.map((g) => g.instrument_id)).toEqual(['new', 'old'])
  })

  it('backfills a missing instrument name from a later series', () => {
    const groups = groupSeriesByInstrument([
      series('a', ['2026-06-01'], null),
      series('a', ['2026-06-02'], 'Hartslag'),
    ])
    expect(groups[0]?.instrument_name).toBe('Hartslag')
  })
})

describe('hasErrorCode', () => {
  it('matches the carried code', () => {
    expect(hasErrorCode({ code: 'x.y' }, 'x.y')).toBe(true)
  })

  it('is false for non-objects or mismatches', () => {
    expect(hasErrorCode(null, 'x')).toBe(false)
    expect(hasErrorCode({ code: 'a' }, 'b')).toBe(false)
  })
})
