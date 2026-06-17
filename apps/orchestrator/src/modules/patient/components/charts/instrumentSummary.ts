import type { LusciiMeasurementSeries, LusciiNumericPoint, LusciiOrdinalPoint } from './types'

export type SparkPoint = LusciiNumericPoint | LusciiOrdinalPoint

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1).replace('.', ',')
}

export function formatPoint(
  s: LusciiMeasurementSeries,
  point: NonNullable<LusciiMeasurementSeries['points']>[number],
): string {
  switch (point.archetype) {
    case 'numeric':
    case 'ordinal': {
      const unit = s.unit ? ` ${s.unit}` : ''
      return `${formatNumber(point.value)}${unit}`
    }
    case 'categorical':
      return point.responses?.join(', ') ?? '—'
    case 'free_text':
      return point.text
    case 'unknown':
      return point.raw ?? '—'
    default:
      return '—'
  }
}

/** Latest formatted value across an instrument's series (by observed_at). */
export function pickLatest(series: LusciiMeasurementSeries[]): string | null {
  let latestAt = ''
  let latestText = ''
  for (const s of series) {
    const last = s.points?.at(-1)
    if (!last) continue
    if (last.observed_at > latestAt) {
      latestAt = last.observed_at
      latestText = formatPoint(s, last)
    }
  }
  return latestText || null
}

/** Chronological numeric/ordinal points across an instrument — for sparkline + trend. */
export function collectSparkPoints(series: LusciiMeasurementSeries[]): SparkPoint[] {
  const points: SparkPoint[] = []
  for (const s of series) {
    if (s.archetype !== 'numeric' && s.archetype !== 'ordinal') continue
    for (const point of s.points ?? []) {
      if (point.archetype === 'numeric' || point.archetype === 'ordinal') points.push(point)
    }
  }
  return points.toSorted((a, b) =>
    a.observed_at < b.observed_at ? -1 : a.observed_at > b.observed_at ? 1 : 0,
  )
}

export interface Trend {
  delta: number
  dir: 'up' | 'down' | 'flat'
}

/** Direction + magnitude of the last step (latest vs previous numeric point). */
export function pickTrend(points: SparkPoint[]): Trend | null {
  const prev = points.at(-2)
  const last = points.at(-1)
  if (!prev || !last) return null
  const delta = last.value - prev.value
  return { delta, dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' }
}

/** True when every series is numeric — render as one multi-line chart. */
export function isAllNumeric(series: LusciiMeasurementSeries[]): boolean {
  return series.length > 0 && series.every((s) => s.archetype === 'numeric')
}
