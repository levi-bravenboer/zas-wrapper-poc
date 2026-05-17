import { describe, expect, it } from 'vitest'

import type { OrganisationRead } from '../../schemas'
import { flattenTree } from '../flattenTree'

const org = (id: string, parent: string | null, name: string, sort = 0): OrganisationRead => ({
  id,
  parent_organisation_id: parent,
  name,
  type_code: 'prov',
  type_system: null,
  type_display: null,
  sort_index: sort,
})

describe('flattenTree', () => {
  it('emits a depth-first flat list ordered by sort_index then name', () => {
    const flat = flattenTree([
      org('b', null, 'B', 1),
      org('a', null, 'A', 0),
      org('a1', 'a', 'A1', 0),
      org('a2', 'a', 'A2', 1),
    ])
    expect(flat.map((i) => i.id)).toEqual(['a', 'a1', 'a2', 'b'])
    expect(flat.map((i) => i.depth)).toEqual([0, 1, 1, 0])
  })

  it('omits children of collapsed parents', () => {
    const flat = flattenTree(
      [org('a', null, 'A'), org('a1', 'a', 'A1'), org('b', null, 'B')],
      new Set(['a']),
    )
    expect(flat.map((i) => i.id)).toEqual(['a', 'b'])
    expect(flat[0]?.collapsed).toBe(true)
    expect(flat[0]?.hasChildren).toBe(true)
  })
})
