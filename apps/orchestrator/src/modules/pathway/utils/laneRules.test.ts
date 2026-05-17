import { describe, expect, it } from 'vitest'

import { defaultLaneKindCode, isLaneAllowed } from './laneRules'

describe('isLaneAllowed', () => {
  it('allows a lane whose kind code is in the block type allowed list', () => {
    expect(
      isLaneAllowed({ allowed_lane_kind_codes: ['patient', 'caregiver'] }, 'patient'),
    ).toBe(true)
  })

  it('rejects a lane whose kind code is not in the allowed list', () => {
    expect(isLaneAllowed({ allowed_lane_kind_codes: ['patient'] }, 'caregiver')).toBe(false)
  })

  it('returns false when block type is null', () => {
    expect(isLaneAllowed(null, 'patient')).toBe(false)
  })

  it('returns false when lane code is null', () => {
    expect(isLaneAllowed({ allowed_lane_kind_codes: ['patient'] }, null)).toBe(false)
  })
})

describe('defaultLaneKindCode', () => {
  it('returns the first entry as the default placement', () => {
    expect(defaultLaneKindCode({ allowed_lane_kind_codes: ['patient', 'caregiver'] })).toBe(
      'patient',
    )
  })
})
