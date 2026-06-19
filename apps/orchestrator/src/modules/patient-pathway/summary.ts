import {
  legacyBlockType,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayPhase,
} from '@/modules/pathway/types'

import { deriveBlockStatus, type RuntimeState } from './components/runtime-canvas/runtimeState'
import type { BlockExecution } from './types'

// One step in the glance trail. Only finished / active / upcoming surface;
// `pending` (not reached) and `skipped` (dead branch) are excluded.
export type SummaryStepState = Extract<RuntimeState, 'finished' | 'active' | 'upcoming'>

export interface SummaryStep {
  id: string
  name: string
  state: SummaryStepState
  icon: string | null
  legacyType: string
  phaseId: string | null
  completedAt: string | null
  completedByName: string | null
  scheduledAt: string | null
  dueAt: string | null
  overdue: boolean
}

export interface PathwaySummary {
  phaseName: string | null
  done: number
  total: number
  steps: SummaryStep[]
  // Index of the active step within `steps`, or -1 when nothing is active.
  nowIndex: number
}

const ORDER: Record<SummaryStepState, number> = { finished: 0, active: 1, upcoming: 2 }

function timeOf(value: string | null): number {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Pure view-model for the patient pathway glance banner. Joins runtime
 * executions to the pinned template (by `block_template_id`) and reuses the
 * runtime canvas's `deriveBlockStatus`, so banner and detail tab always agree.
 * Shape-agnostic: works for any freely-built pathway (size, branches,
 * parallel fans) because it derives from buckets + counts, never a fixed shape.
 */
export function deriveSummary(params: {
  executions: BlockExecution[]
  blocks: PathwayBlock[]
  phases: PathwayPhase[]
  blockTypes: PathwayBlockType[]
  now: number
}): PathwaySummary {
  const { executions, blocks, phases, blockTypes, now } = params

  const blockById = new Map<string, PathwayBlock>()
  for (const block of blocks) blockById.set(block.id, block)
  const phaseNameById = new Map<string, string>()
  for (const phase of phases) phaseNameById.set(phase.id, phase.label)
  const iconByType = new Map<string, string | null>()
  for (const bt of blockTypes) iconByType.set(bt.type, bt.icon ?? null)

  const statusById = deriveBlockStatus(executions, now)

  const steps: SummaryStep[] = []
  let done = 0
  for (const execution of executions) {
    const status = statusById.get(execution.block_template_id)
    if (!status) continue
    if (status.state === 'finished') done += 1
    if (status.state !== 'finished' && status.state !== 'active' && status.state !== 'upcoming') {
      continue
    }
    const block = blockById.get(execution.block_template_id)
    const legacyType = block ? legacyBlockType(block) : 'unknown'
    const dueAt = execution.due_at ?? null
    steps.push({
      id: execution.id,
      name: block?.name?.trim() || legacyType,
      state: status.state,
      icon: iconByType.get(legacyType) ?? null,
      legacyType,
      phaseId: block?.phase_id ?? null,
      completedAt: status.completedAt,
      completedByName: status.completedByName,
      scheduledAt: execution.scheduled_at ?? null,
      dueAt,
      overdue: status.state === 'active' && !!dueAt && timeOf(dueAt) < now,
    })
  }

  steps.sort((a, b) => {
    if (ORDER[a.state] !== ORDER[b.state]) return ORDER[a.state] - ORDER[b.state]
    if (a.state === 'finished') return timeOf(a.completedAt) - timeOf(b.completedAt)
    if (a.state === 'upcoming') return timeOf(a.scheduledAt) - timeOf(b.scheduledAt)
    return 0
  })

  const nowIndex = steps.findIndex((s) => s.state === 'active')

  // Current phase = phase of the active step, else the next upcoming, else the
  // last finished (so a fully-done enrollment still names where it ended).
  const anchor =
    steps[nowIndex] ??
    steps.find((s) => s.state === 'upcoming') ??
    steps.findLast((s) => s.state === 'finished') ??
    null
  const phaseName = anchor?.phaseId ? (phaseNameById.get(anchor.phaseId) ?? null) : null

  return { phaseName, done, total: steps.length, steps, nowIndex }
}

export interface TrailCell {
  step: SummaryStep
  index: number
}

export interface TrailWindow {
  cells: TrailCell[]
  beforeHidden: number
  afterHidden: number
}

/**
 * Bounded window of `radius` steps on each side of the active step (or the
 * start when nothing is active). Steps outside collapse into the
 * before/after counts, so any pathway renders in a fixed footprint.
 */
export function windowAround(steps: SummaryStep[], nowIndex: number, radius: number): TrailWindow {
  if (steps.length === 0) return { cells: [], beforeHidden: 0, afterHidden: 0 }
  const center = nowIndex >= 0 ? nowIndex : 0
  const start = Math.max(0, center - radius)
  const end = Math.min(steps.length - 1, center + radius)
  const cells: TrailCell[] = []
  for (let i = start; i <= end; i++) cells.push({ step: steps[i]!, index: i })
  return { cells, beforeHidden: start, afterHidden: steps.length - 1 - end }
}
