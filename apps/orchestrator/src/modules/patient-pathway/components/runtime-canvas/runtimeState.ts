import type { BlockExecution } from '../../types'
import { bucketExecutions } from '../../utils/buckets'

// Visual runtime state of a pathway block on the canvas.
export type RuntimeState = 'finished' | 'active' | 'upcoming' | 'pending' | 'skipped'

export interface RuntimeBlockStatus {
  state: RuntimeState
  completedAt: string | null
  completedByName: string | null
}

// Map each block (by template id) to its runtime status, derived from the
// enrollment's executions. Blocks with no execution stay absent → the node
// renders as `pending` (not yet reached).
export function deriveBlockStatus(
  executions: BlockExecution[],
  now: number,
): Map<string, RuntimeBlockStatus> {
  const buckets = bucketExecutions(executions, now)
  const map = new Map<string, RuntimeBlockStatus>()
  const set = (ex: BlockExecution, state: RuntimeState): void => {
    map.set(ex.block_template_id, {
      state,
      completedAt: ex.completed_at ?? null,
      completedByName: ex.completed_by_name ?? null,
    })
  }
  for (const ex of buckets.upcoming) set(ex, 'upcoming')
  // `bucketFor` lumps completed + skipped into `finished`; split them so the
  // dead-branch (skipped) steps can be styled / hidden separately.
  for (const ex of buckets.finished) set(ex, ex.state === 'skipped' ? 'skipped' : 'finished')
  for (const ex of buckets.next) set(ex, 'active')
  return map
}

export const RUNTIME_STATE_COLOR: Record<RuntimeState, string> = {
  finished: 'var(--color-success)',
  active: 'var(--color-primary)',
  upcoming: 'var(--color-border-strong)',
  pending: 'var(--color-border)',
  skipped: 'var(--color-border)',
}
