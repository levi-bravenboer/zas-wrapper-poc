import { describe, expect, it } from 'vitest'

import {
  assignRoleRequestSchema,
  roleSchema,
  setActiveRequestSchema,
  userDetailSchema,
  userRowSchema,
} from './schemas'

const UUID = '11111111-1111-4111-8111-111111111111'

const validRow = {
  id: UUID,
  email: 'u@zas.local',
  display_name: 'U',
  role: 'caregiver',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

const validDetail = {
  ...validRow,
  external_idp: null,
  external_subject: null,
  updated_at: '2026-01-02T00:00:00Z',
}

describe('roleSchema', () => {
  it('accepts known roles', () => {
    for (const r of ['admin', 'caregiver'] as const) {
      expect(roleSchema.parse(r)).toBe(r)
    }
  })

  it('rejects unknown role', () => {
    expect(roleSchema.safeParse('owner').success).toBe(false)
  })
})

describe('userRowSchema', () => {
  it('parses a valid row', () => {
    expect(userRowSchema.parse(validRow).id).toBe(UUID)
  })

  it('rejects non-uuid id', () => {
    expect(userRowSchema.safeParse({ ...validRow, id: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects missing display_name', () => {
    const { display_name: _omit, ...partial } = validRow
    expect(userRowSchema.safeParse(partial).success).toBe(false)
  })

  it('rejects non-boolean is_active', () => {
    expect(userRowSchema.safeParse({ ...validRow, is_active: 'yes' }).success).toBe(false)
  })
})

describe('userDetailSchema', () => {
  it('parses a valid detail with null external fields', () => {
    const parsed = userDetailSchema.parse(validDetail)
    expect(parsed.external_idp).toBeNull()
    expect(parsed.id).toBe(UUID)
  })

  it('accepts populated external identity', () => {
    const parsed = userDetailSchema.parse({
      ...validDetail,
      external_idp: 'azure',
      external_subject: 'oid-123',
    })
    expect(parsed.external_idp).toBe('azure')
  })

  it('rejects missing updated_at', () => {
    const { updated_at: _omit, ...partial } = validDetail
    expect(userDetailSchema.safeParse(partial).success).toBe(false)
  })
})

describe('request schemas', () => {
  it('setActiveRequestSchema requires boolean', () => {
    expect(setActiveRequestSchema.safeParse({ is_active: true }).success).toBe(true)
    expect(setActiveRequestSchema.safeParse({ is_active: 'true' }).success).toBe(false)
  })

  it('assignRoleRequestSchema accepts enum only', () => {
    expect(assignRoleRequestSchema.safeParse({ role: 'admin' }).success).toBe(true)
    expect(assignRoleRequestSchema.safeParse({ role: 'owner' }).success).toBe(false)
  })
})
