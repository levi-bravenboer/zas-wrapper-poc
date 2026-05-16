import type { PathwayTimingValue } from './types'

export function formatTimingValue(value: PathwayTimingValue | null | undefined): string | null {
  if (!value) return null
  if (value.kind === 'enrollment') return 'D0'
  const d = value.fixed_days
  if (d === null || d === undefined) return null
  if (d === 0) return 'D0'
  return d > 0 ? `D+${d}` : `D${d}`
}
