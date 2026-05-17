import { describe, expect, it } from 'vitest'

import { projectDepth } from '../projectDepth'
import type { FlatItem } from '../types'

const item = (
  id: string,
  parentId: string | null,
  depth: number,
  hasChildren = false,
): FlatItem => ({
  id,
  parentId,
  depth,
  hasChildren,
  collapsed: false,
})

describe('projectDepth', () => {
  const items: readonly FlatItem[] = [
    item('a', null, 0, true),
    item('a1', 'a', 1, true),
    item('a1a', 'a1', 2),
    item('b', null, 0),
  ]

  it('drops at root depth when dragging up onto the first root', () => {
    const p = projectDepth(items, 'b', 'a', 0, 16)
    expect(p.depth).toBe(0)
    expect(p.parentId).toBe(null)
  })

  it('nests under the previous sibling when offsetLeft pushes deeper', () => {
    const p = projectDepth(items, 'a1', 'b', 16, 16)
    expect(p.depth).toBe(1)
    expect(p.parentId).toBe('b')
  })

  it('clamps so an item cannot be deeper than prev.depth + 1', () => {
    const p = projectDepth(items, 'a1', 'b', 9999, 16)
    expect(p.depth).toBeLessThanOrEqual(1)
  })
})
