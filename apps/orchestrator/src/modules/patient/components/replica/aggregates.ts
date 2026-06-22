import { collectSparkPoints, formatNumber } from '../charts/instrumentSummary'
import type { LusciiMeasurementSeries } from '../charts/types'

export interface ReplicaStats {
  average: string
  minimum: string
  maximum: string
  latest: string
  unit: string | null
}

/**
 * Gemiddeld / Minimum / Maximum / Nieuwste over an instrument's numeric +
 * ordinal points, matching Luscii's stat row. Returns null when the
 * instrument has no numeric/ordinal points (e.g. a purely categorical or
 * free-text instrument), so the card can omit the row.
 *
 * Display-only: this is descriptive summary statistics over values the
 * patient submitted (mean/min/max/latest) — the same numbers Luscii shows.
 * No thresholds, scoring, or clinical interpretation.
 */
export function computeStats(series: LusciiMeasurementSeries[]): ReplicaStats | null {
  const points = collectSparkPoints(series)
  if (points.length === 0) return null
  const values = points.map((p) => p.value)
  const sum = values.reduce((acc, v) => acc + v, 0)
  const average = sum / values.length
  const unit = series.find((s) => s.unit)?.unit ?? null
  return {
    average: formatNumber(Math.round(average * 10) / 10),
    minimum: formatNumber(Math.min(...values)),
    maximum: formatNumber(Math.max(...values)),
    latest: formatNumber(points[points.length - 1].value),
    unit,
  }
}
