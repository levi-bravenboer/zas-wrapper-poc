import type { BlockExecution } from '../types'

export type StepBucket = 'upcoming' | 'next' | 'finished'

function scheduleElapsed(execution: BlockExecution, now: number): boolean {
  if (!execution.scheduled_at) return true
  return new Date(execution.scheduled_at).getTime() <= now
}

/**
 * Maps a runtime execution to its Zorgpad bucket (patient-pathway-tab spec):
 * Finished = completed/skipped, Next = active or eligible-and-elapsed,
 * Upcoming = eligible-but-not-elapsed. `pending` (upstream unmet) and
 * `failed` executions surface in no bucket in this read-only version.
 */
export function bucketFor(execution: BlockExecution, now: number): StepBucket | null {
  switch (execution.state) {
    case 'completed':
    case 'skipped':
      return 'finished'
    case 'active':
      return 'next'
    case 'eligible':
      return scheduleElapsed(execution, now) ? 'next' : 'upcoming'
    default:
      return null
  }
}

export type BucketedSteps = Record<StepBucket, BlockExecution[]>

export function bucketExecutions(executions: BlockExecution[], now: number): BucketedSteps {
  const buckets: BucketedSteps = { upcoming: [], next: [], finished: [] }
  for (const execution of executions) {
    const bucket = bucketFor(execution, now)
    if (bucket) buckets[bucket].push(execution)
  }
  return buckets
}
