import { describe, expect, it } from 'vitest'

import type { BlockExecution, BlockExecutionState } from '../types'

import { bucketExecutions, bucketFor } from './buckets'

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0)

const step = (state: BlockExecutionState, scheduled_at: string | null = null): BlockExecution =>
  ({ state, scheduled_at }) as BlockExecution

describe('bucketFor', () => {
  it('puts completed and skipped steps in finished', () => {
    expect(bucketFor(step('completed'), NOW)).toBe('finished')
    expect(bucketFor(step('skipped'), NOW)).toBe('finished')
  })

  it('puts active steps in next', () => {
    expect(bucketFor(step('active'), NOW)).toBe('next')
  })

  it('puts an eligible step with no schedule in next', () => {
    expect(bucketFor(step('eligible', null), NOW)).toBe('next')
  })

  it('puts an eligible step whose schedule has elapsed in next', () => {
    const past = new Date(NOW - 60_000).toISOString()
    expect(bucketFor(step('eligible', past), NOW)).toBe('next')
  })

  it('puts an eligible step scheduled in the future in upcoming', () => {
    const future = new Date(NOW + 60_000).toISOString()
    expect(bucketFor(step('eligible', future), NOW)).toBe('upcoming')
  })

  it('returns null for pending and failed (surfaced in no bucket)', () => {
    expect(bucketFor(step('pending'), NOW)).toBeNull()
    expect(bucketFor(step('failed'), NOW)).toBeNull()
  })
})

describe('bucketExecutions', () => {
  it('groups a mixed list into the three buckets and drops null buckets', () => {
    const future = new Date(NOW + 60_000).toISOString()
    const result = bucketExecutions(
      [step('completed'), step('active'), step('eligible', future), step('pending')],
      NOW,
    )
    expect(result.finished).toHaveLength(1)
    expect(result.next).toHaveLength(1)
    expect(result.upcoming).toHaveLength(1)
  })

  it('returns empty buckets for an empty input', () => {
    expect(bucketExecutions([], NOW)).toEqual({ upcoming: [], next: [], finished: [] })
  })
})
