import { describe, expect, it } from 'vitest'

import type { PathwayBlock, PathwayBlockType, PathwayPhase } from '@/modules/pathway/types'

import { deriveSummary, type SummaryStep, windowAround } from './summary'
import type { BlockExecution } from './types'

const NOW = new Date('2026-06-17T12:00:00Z').getTime()
const DAY = 86_400_000

function block(id: string, name: string, phaseId: string): PathwayBlock {
  return { id, name, phase_id: phaseId, kind: 'task' } as unknown as PathwayBlock
}
function phase(id: string, label: string, ord: number): PathwayPhase {
  return { id, label, ord } as unknown as PathwayPhase
}
const BLOCK_TYPES = [{ type: 'task', icon: 'list-checks' }] as unknown as PathwayBlockType[]

function ex(id: string, opts: Partial<BlockExecution>): BlockExecution {
  return { id, block_template_id: id, state: 'pending', ...opts } as BlockExecution
}

describe('deriveSummary', () => {
  const blocks = [
    block('a', 'Scan', 'p1'),
    block('b', 'Beoordeel', 'p1'),
    block('c', 'MDO', 'p2'),
    block('d', 'Bespreken', 'p2'),
  ]
  const phases = [phase('p1', 'Scans', 0), phase('p2', 'Besluit', 1)]

  it('counts done/total, orders finished→active→upcoming, and locates NOW', () => {
    const executions = [
      ex('d', { state: 'eligible', scheduled_at: new Date(NOW + DAY).toISOString() }), // upcoming
      ex('a', { state: 'completed', completed_at: new Date(NOW - 3 * DAY).toISOString() }),
      ex('c', { state: 'active' }), // NOW
      ex('b', { state: 'completed', completed_at: new Date(NOW - 2 * DAY).toISOString() }),
    ]
    const s = deriveSummary({ executions, blocks, phases, blockTypes: BLOCK_TYPES, now: NOW })

    expect(s.done).toBe(2)
    expect(s.total).toBe(4)
    expect(s.steps.map((x) => x.state)).toEqual(['finished', 'finished', 'active', 'upcoming'])
    expect(s.steps.map((x) => x.name)).toEqual(['Scan', 'Beoordeel', 'MDO', 'Bespreken'])
    expect(s.nowIndex).toBe(2)
    expect(s.phaseName).toBe('Besluit') // phase of the active step
    expect(s.steps[0]?.icon).toBe('list-checks')
  })

  it('flags an overdue active step (due_at in the past) and not a future one', () => {
    const overdue = deriveSummary({
      executions: [ex('c', { state: 'active', due_at: new Date(NOW - 2 * DAY).toISOString() })],
      blocks,
      phases,
      blockTypes: BLOCK_TYPES,
      now: NOW,
    })
    expect(overdue.steps[0]?.overdue).toBe(true)

    const onTime = deriveSummary({
      executions: [ex('c', { state: 'active', due_at: new Date(NOW + 2 * DAY).toISOString() })],
      blocks,
      phases,
      blockTypes: BLOCK_TYPES,
      now: NOW,
    })
    expect(onTime.steps[0]?.overdue).toBe(false)
  })

  it('excludes skipped and pending executions', () => {
    const s = deriveSummary({
      executions: [
        ex('a', { state: 'completed', completed_at: new Date(NOW - DAY).toISOString() }),
        ex('b', { state: 'skipped' }),
        ex('c', { state: 'pending' }),
      ],
      blocks,
      phases,
      blockTypes: BLOCK_TYPES,
      now: NOW,
    })
    expect(s.total).toBe(1)
    expect(s.steps.map((x) => x.name)).toEqual(['Scan'])
  })
})

describe('windowAround', () => {
  const steps = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}` }) as unknown as SummaryStep)

  it('bounds a long pathway to the window and collapses the rest into pills', () => {
    const w = windowAround(steps, 4, 2)
    expect(w.cells.map((c) => c.index)).toEqual([2, 3, 4, 5, 6])
    expect(w.beforeHidden).toBe(2)
    expect(w.afterHidden).toBe(2)
  })

  it('shows a short pathway entirely with no overflow', () => {
    const w = windowAround(steps.slice(0, 3), 1, 2)
    expect(w.cells.map((c) => c.index)).toEqual([0, 1, 2])
    expect(w.beforeHidden).toBe(0)
    expect(w.afterHidden).toBe(0)
  })

  it('centers on the start when nothing is active', () => {
    const w = windowAround(steps, -1, 2)
    expect(w.cells.map((c) => c.index)).toEqual([0, 1, 2])
    expect(w.beforeHidden).toBe(0)
    expect(w.afterHidden).toBe(6)
  })
})
