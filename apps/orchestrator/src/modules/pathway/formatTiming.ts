import type { PathwayTimingValue } from './types'

type Input = PathwayTimingValue | null | undefined

export function formatTimingChip(value: Input): string | null {
  if (!value) return null
  if (value.kind === 'enrollment') return 'D0'
  const d = value.fixed_days
  if (d === null || d === undefined) return null
  if (d === 0) return 'D0'
  return d > 0 ? `D+${d}` : `D${d}`
}

export function formatTimingDelay(value: Input): string | null {
  if (!value) return null
  if (value.kind === 'enrollment') return '+0d'
  const d = value.fixed_days
  if (d === null || d === undefined || d === 0) return null
  return d > 0 ? `+${d}d` : `${d}d`
}
