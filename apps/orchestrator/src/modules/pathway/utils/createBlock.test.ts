import { describe, expect, it } from 'vitest'

import { isLaneAllowed } from './laneRules'
import { createBlock } from './createBlock'

describe('createBlock', () => {
  it.each([
    'form',
    'wait',
    'pathway_link',
  ])('creates %s block with empty config (backend supplies defaults)', (typeCode) => {
    const block = createBlock({
      typeCode,
      phaseId: 'p1',
      laneId: 'l1',
      x: 10,
      y: 20,
    })
    expect(block.type).toBe(typeCode)
    expect(block.config).toEqual({})
    expect(block.label).toBeNull()
  })

  it('rounds non-integer coordinates', () => {
    const block = createBlock({ typeCode: 'task', phaseId: 'p', laneId: 'l', x: 4.6, y: 9.4 })
    expect(block.x).toBe(5)
    expect(block.y).toBe(9)
  })
})

describe('new block types — lane allowance', () => {
  const cases: Array<{ type: string; allowed: string[]; ok: string; bad: string }> = [
    { type: 'form', allowed: ['patient'], ok: 'patient', bad: 'system' },
    { type: 'wait', allowed: ['system'], ok: 'system', bad: 'patient' },
    { type: 'pathway_link', allowed: ['system'], ok: 'system', bad: 'caregiver' },
  ]

  it.each(cases)('$type allows $ok and rejects $bad', ({ allowed, ok, bad }) => {
    expect(isLaneAllowed({ allowed_lane_kind_codes: allowed }, ok)).toBe(true)
    expect(isLaneAllowed({ allowed_lane_kind_codes: allowed }, bad)).toBe(false)
  })
})
