import { describe, expect, it } from 'vitest'

import type { PathwayBlock, PathwayVersionDefinition } from './types'
import { cascadeDeleteBlock, dependentBlocks } from './useBuilderState'

function stubBlock(id: string, after: string[] = []): PathwayBlock {
  return {
    id,
    kind: 'task',
    name: `Block ${id}`,
    phase_id: 'phase-1',
    lane_id: 'lane-1',
    x: 0,
    y: 0,
    input_logic: {
      rules: after.map((up) => ({
        node: up,
        args: { predicate: 'if_done', after_block: up },
      })),
      aggregator: 'all_of',
    },
    timing_policy: null,
  } as unknown as PathwayBlock
}

function stubVersion(blocks: PathwayBlock[]): PathwayVersionDefinition {
  return {
    id: 'version-1',
    blocks,
    edges: [],
    branches: [],
    phases: [],
    lanes: [],
  } as unknown as PathwayVersionDefinition
}

describe('dependentBlocks', () => {
  it('finds blocks whose rules reference the target', () => {
    const blocks = [stubBlock('a'), stubBlock('b', ['a']), stubBlock('c', ['b'])]
    expect(dependentBlocks(blocks, 'a').map((b) => b.id)).toEqual(['b'])
  })

  it('returns empty when nothing references the target', () => {
    const blocks = [stubBlock('a'), stubBlock('b')]
    expect(dependentBlocks(blocks, 'a')).toEqual([])
  })

  it('does not list the target itself', () => {
    const blocks = [stubBlock('a', ['a'])]
    expect(dependentBlocks(blocks, 'a')).toEqual([])
  })
})

describe('cascadeDeleteBlock', () => {
  it('drops the block and strips dependent rules', () => {
    const version = stubVersion([
      stubBlock('a'),
      stubBlock('b', ['a']),
      stubBlock('c', ['a', 'b']),
    ])
    const next = cascadeDeleteBlock(version, 'a')
    const ids = (next.blocks ?? []).map((b) => b.id)
    expect(ids).toEqual(['b', 'c'])
    const b = (next.blocks ?? []).find((x) => x.id === 'b')
    const c = (next.blocks ?? []).find((x) => x.id === 'c')
    expect(b?.input_logic?.rules ?? []).toHaveLength(0)
    expect((c?.input_logic?.rules ?? []).map((r) => r.node)).toEqual(['b'])
  })

  it('leaves unrelated blocks untouched (same reference)', () => {
    const untouched = stubBlock('z', ['y'])
    const version = stubVersion([stubBlock('a'), stubBlock('y'), untouched])
    const next = cascadeDeleteBlock(version, 'a')
    expect((next.blocks ?? []).find((b) => b.id === 'z')).toBe(untouched)
  })

  it('drops branches owned by the deleted block', () => {
    const version = {
      ...stubVersion([stubBlock('decision'), stubBlock('after', ['decision'])]),
      branches: [
        { id: 'br-1', block_id: 'decision', label: 'goed', ord: 0 },
        { id: 'br-2', block_id: 'other', label: 'x', ord: 1 },
      ],
    } as unknown as PathwayVersionDefinition
    const next = cascadeDeleteBlock(version, 'decision')
    expect((next.branches ?? []).map((b) => b.id)).toEqual(['br-2'])
  })

  it('drops derived edges touching the deleted block', () => {
    const version = {
      ...stubVersion([stubBlock('a'), stubBlock('b', ['a'])]),
      edges: [
        { source_block_id: 'a', target_block_id: 'b', predicate: 'if_done', args: {} },
        { source_block_id: 'x', target_block_id: 'y', predicate: 'if_done', args: {} },
      ],
    } as unknown as PathwayVersionDefinition
    const next = cascadeDeleteBlock(version, 'a')
    expect(next.edges).toHaveLength(1)
    expect(next.edges?.[0]?.source_block_id).toBe('x')
  })
})
