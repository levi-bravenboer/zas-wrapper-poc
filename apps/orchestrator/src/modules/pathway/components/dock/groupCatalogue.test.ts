import { describe, expect, it } from 'vitest'

import type { PathwayBlockType } from '../../types'

import { groupCatalogueBySource } from './groupCatalogue'

function entry(overrides: Partial<PathwayBlockType>): PathwayBlockType {
  return {
    type: 'appointment',
    label: 'X',
    semantics: 'appointment',
    icon: 'calendar',
    allowed_lane_kind_codes: ['caregiver'],
    supports_branches: false,
    config_schema: {},
    ui_schema: {},
    source: 'native',
    ...overrides,
  } as unknown as PathwayBlockType
}

describe('groupCatalogueBySource', () => {
  it('returns a single native group when no external entries are present', () => {
    const groups = groupCatalogueBySource([entry({ type: 'appointment' }), entry({ type: 'task' })])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ source: 'native' })
    expect(groups[0]?.items.map((e) => e.type)).toEqual(['appointment', 'task'])
  })

  it('buckets external entries per provider after the native group', () => {
    const groups = groupCatalogueBySource([
      entry({ type: 'appointment' }),
      entry({ type: 'luscii.program', source: 'external', provider: 'luscii', kind: 'program' }),
      entry({ type: 'hix.task', source: 'external', provider: 'hix', kind: 'task' }),
      entry({ type: 'luscii.intake', source: 'external', provider: 'luscii', kind: 'intake' }),
    ])
    expect(groups).toHaveLength(3)
    expect(groups[0]).toMatchObject({ source: 'native' })
    expect(groups[1]).toMatchObject({ source: 'external', provider: 'luscii' })
    expect(groups[1]?.items.map((e) => e.type)).toEqual(['luscii.program', 'luscii.intake'])
    expect(groups[2]).toMatchObject({ source: 'external', provider: 'hix' })
  })

  it('omits the native group when only external entries are supplied', () => {
    const groups = groupCatalogueBySource([
      entry({ type: 'luscii.program', source: 'external', provider: 'luscii', kind: 'program' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ source: 'external', provider: 'luscii' })
  })

  it('falls back to the literal "unknown" provider when external metadata is missing', () => {
    const groups = groupCatalogueBySource([
      entry({ type: 'broken', source: 'external' } as Partial<PathwayBlockType>),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ source: 'external', provider: 'unknown' })
  })
})
