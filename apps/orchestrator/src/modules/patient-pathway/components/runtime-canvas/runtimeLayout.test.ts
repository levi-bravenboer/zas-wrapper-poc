import { describe, expect, it } from 'vitest'

import { computeRuntimeLayout, type LayoutEdge, type LayoutInput } from './runtimeLayout'

const node = (id: string, width = 100, height = 40): LayoutInput => ({ id, width, height })
const edge = (source: string, target: string): LayoutEdge => ({ source, target })

describe('computeRuntimeLayout', () => {
  it('returns an empty layout for no nodes', () => {
    expect(computeRuntimeLayout([], [])).toEqual({ positions: new Map(), width: 0, height: 0 })
  })

  it('places a single node at the origin sized to itself', () => {
    const { positions, width, height } = computeRuntimeLayout([node('a', 120, 50)], [])
    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(width).toBe(120)
    expect(height).toBe(50)
  })

  it('lays a sequential chain out as one straight horizontal line', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('a', 'b'), edge('b', 'c')]
    const { positions } = computeRuntimeLayout(nodes, edges)

    const a = positions.get('a')!
    const b = positions.get('b')!
    const c = positions.get('c')!
    // Same vertical centre → a straight line.
    expect(a.y).toBe(b.y)
    expect(b.y).toBe(c.y)
    // Columns advance left → right by width + gap.
    expect(a.x).toBeLessThan(b.x)
    expect(b.x).toBeLessThan(c.x)
    expect(b.x - a.x).toBe(c.x - b.x)
  })

  it('stacks branch siblings in the same column without overlap', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('a', 'b'), edge('a', 'c')]
    const { positions, height } = computeRuntimeLayout(nodes, edges)

    const b = positions.get('b')!
    const c = positions.get('c')!
    // Siblings share the column (same x) but separate vertically.
    expect(b.x).toBe(c.x)
    expect(b.y).not.toBe(c.y)
    // No overlap: separation is at least the node height.
    expect(Math.abs(b.y - c.y)).toBeGreaterThanOrEqual(40)
    expect(height).toBeGreaterThanOrEqual(80)
  })

  it('normalises so the topmost node sits at y = 0', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('a', 'b'), edge('a', 'c')]
    const { positions } = computeRuntimeLayout(nodes, edges)
    const minY = Math.min(...[...positions.values()].map((p) => p.y))
    expect(minY).toBe(0)
  })
})
