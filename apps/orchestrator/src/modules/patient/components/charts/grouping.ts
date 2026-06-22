import type { LusciiMeasurementSeries } from './types'

export interface InstrumentGroup {
  instrument_id: string
  instrument_name: string | null
  series: LusciiMeasurementSeries[]
  /** Most-recent point timestamp across this instrument's series. */
  freshness: string
}

/**
 * Group a flat `series[]` into per-instrument buckets. With `sort: 'freshness'`
 * the freshest instrument comes first; with `'none'` (default) buckets keep the
 * order the backend returned them in (already freshness-sorted by
 * `project_series`, so callers wanting a static order layer their own).
 */
export function groupSeriesByInstrument(
  series: LusciiMeasurementSeries[],
  opts?: { sort?: 'freshness' | 'none' },
): InstrumentGroup[] {
  const map = new Map<string, InstrumentGroup>()
  for (const s of series) {
    const last = s.points?.at(-1)
    if (!last) continue
    const existing = map.get(s.instrument_id)
    if (existing) {
      existing.series.push(s)
      if (last.observed_at > existing.freshness) existing.freshness = last.observed_at
      if (!existing.instrument_name && s.instrument_name)
        existing.instrument_name = s.instrument_name
    } else {
      map.set(s.instrument_id, {
        instrument_id: s.instrument_id,
        instrument_name: s.instrument_name ?? null,
        series: [s],
        freshness: last.observed_at,
      })
    }
  }
  const groups = [...map.values()]
  if (opts?.sort === 'freshness') {
    groups.sort((a, b) => (a.freshness < b.freshness ? 1 : a.freshness > b.freshness ? -1 : 0))
  }
  return groups
}

/** True when `error` is an object carrying the given string `code`. */
export function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = (error as { code?: unknown }).code
  return typeof candidate === 'string' && candidate === code
}
