import { type Edge, MarkerType } from '@xyflow/react'
import { useMemo } from 'react'

import type { SmoothstepEdgeData } from '@/modules/pathway/components/canvas/edges/SmoothstepEdge'
import { useFlowEdges } from '@/modules/pathway/components/canvas/useFlowEdges'
import { phaseTint } from '@/modules/pathway/constants/theme'
import {
  legacyBlockType,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayEdge,
  type PathwayPhase,
  type PathwayTimingValue,
} from '@/modules/pathway/types'
import { getBlockDimensions } from '@/modules/pathway/utils/blockDimensions'

import type { RuntimeFlowNode } from './RuntimeBlockNode'
import { computeRuntimeLayout } from './runtimeLayout'
import type { RuntimeBlockStatus } from './runtimeState'

export interface UseRuntimeGraphParams {
  blocks: PathwayBlock[]
  phases: PathwayPhase[]
  edges: PathwayEdge[]
  timingValues: PathwayTimingValue[]
  blockTypes: PathwayBlockType[]
  statusByBlockId: Map<string, RuntimeBlockStatus>
  // When false, blocks skipped by a past branch are hidden (the pathway took
  // another direction, so they're irrelevant to non-privileged viewers).
  showSkipped: boolean
}

// A coloured phase band spanning the x-extent of its blocks in the auto-layout.
export interface PhaseBand {
  id: string
  label: string
  x: number
  width: number
  soft: string
  ink: string
}

export interface RuntimeGraph {
  nodes: RuntimeFlowNode[]
  edges: Edge<SmoothstepEdgeData>[]
  phaseBands: PhaseBand[]
  // Total laid-out height, for the playhead + bands.
  height: number
  // Flow-x of the current position (centre of the furthest active block), for
  // the timeline playhead. Null when nothing is active.
  nowX: number | null
}

// Human label for a branch/condition edge — what makes the runtime walk this
// edge vs. another. `decision_output` is the named branch; value predicates
// show their comparison.
function edgeConditionLabel(edge: PathwayEdge): string | null {
  const args = (edge.args ?? {}) as Record<string, unknown>
  switch (edge.predicate) {
    case 'decision_output':
      return typeof args.output_key === 'string' ? args.output_key : null
    case 'value_equals':
      return args.expected != null ? `= ${String(args.expected)}` : null
    case 'value_gt':
      return args.value != null ? `> ${String(args.value)}` : null
    default:
      return null
  }
}

// Shapes a published pathway version + runtime status into a read-only
// ReactFlow graph. Positions are auto-computed from the flow graph (business
// logic), not the builder's block coordinates.
export function useRuntimeGraph({
  blocks,
  phases,
  edges,
  timingValues,
  blockTypes,
  statusByBlockId,
  showSkipped,
}: UseRuntimeGraphParams): RuntimeGraph {
  const typesByCode = useMemo(() => new Map(blockTypes.map((bt) => [bt.type, bt])), [blockTypes])

  // Dead-branch (skipped) blocks hidden unless the viewer may see them.
  const hiddenIds = useMemo(() => {
    const set = new Set<string>()
    if (!showSkipped) {
      for (const b of blocks) {
        if (statusByBlockId.get(b.id)?.state === 'skipped') set.add(b.id)
      }
    }
    return set
  }, [blocks, statusByBlockId, showSkipped])

  const visibleBlocks = useMemo(
    () => blocks.filter((b) => !hiddenIds.has(b.id)),
    [blocks, hiddenIds],
  )

  const layout = useMemo(() => {
    const inputs = visibleBlocks.map((b) => {
      const dims = getBlockDimensions(b, typesByCode.get(legacyBlockType(b)) ?? null)
      return { id: b.id, width: dims.width, height: dims.height }
    })
    const layoutEdges = edges
      .filter(
        (e) =>
          e.source_block_id != null &&
          !hiddenIds.has(e.source_block_id) &&
          !hiddenIds.has(e.target_block_id),
      )
      .map((e) => ({ source: e.source_block_id as string, target: e.target_block_id }))
    return computeRuntimeLayout(inputs, layoutEdges)
  }, [visibleBlocks, edges, hiddenIds, typesByCode])

  const nodes = useMemo<RuntimeFlowNode[]>(
    () =>
      visibleBlocks.map((block) => {
        const blockType = typesByCode.get(legacyBlockType(block)) ?? null
        const dims = getBlockDimensions(block, blockType)
        const pos = layout.positions.get(block.id) ?? { x: 0, y: 0 }
        return {
          id: block.id,
          type: 'runtime',
          position: pos,
          data: { block, blockType, status: statusByBlockId.get(block.id) },
          width: dims.width,
          height: dims.height,
          style: { width: dims.width, height: dims.height },
          draggable: false,
          selectable: false,
        }
      }),
    [visibleBlocks, typesByCode, layout, statusByBlockId],
  )

  // Phase bands: x-extent of each phase's blocks in the auto-layout. Phases may
  // stretch (and overlap) to fit their content.
  const phaseBands = useMemo<PhaseBand[]>(() => {
    const extent = new Map<string, { minX: number; maxX: number }>()
    for (const b of visibleBlocks) {
      const pos = layout.positions.get(b.id)
      if (!pos) continue
      const dims = getBlockDimensions(b, typesByCode.get(legacyBlockType(b)) ?? null)
      const e = extent.get(b.phase_id)
      if (e) {
        e.minX = Math.min(e.minX, pos.x)
        e.maxX = Math.max(e.maxX, pos.x + dims.width)
      } else {
        extent.set(b.phase_id, { minX: pos.x, maxX: pos.x + dims.width })
      }
    }
    const labelById = new Map(phases.map((p) => [p.id, p.label]))
    const ordered = [...extent.entries()].sort((a, b) => a[1].minX - b[1].minX)
    return ordered.map(([id, e], i) => {
      const tint = phaseTint(i)
      return { id, label: labelById.get(id) ?? '', x: e.minX, width: e.maxX - e.minX, ...tint }
    })
  }, [visibleBlocks, layout, phases, typesByCode])

  const derivedEdges = useFlowEdges({ edges, blocks, blockTypes, timingValues })

  const edgeMetaById = useMemo(() => {
    const map = new Map<string, { label: string | null; isBranch: boolean }>()
    for (const e of edges) {
      const id = `${e.source_block_id ?? 'marker'}->${e.target_block_id}:${e.predicate}`
      map.set(id, { label: edgeConditionLabel(e), isBranch: e.predicate === 'decision_output' })
    }
    return map
  }, [edges])

  // Clean orthogonal edges, arrowheads, branch labels + accent. Drop edges
  // touching a hidden (skipped) block.
  const flowEdges = useMemo(
    () =>
      derivedEdges
        .filter((edge) => !hiddenIds.has(edge.source) && !hiddenIds.has(edge.target))
        .map((edge) => {
          const meta = edgeMetaById.get(edge.id)
          return {
            ...edge,
            // Straight (angled) lines: chains stay horizontal, splits fan out
            // diagonally toward each target.
            type: 'straight',
            label: meta?.label ?? undefined,
            labelBgPadding: [6, 2] as [number, number],
            labelBgBorderRadius: 6,
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            style: meta?.isBranch
              ? { stroke: 'var(--color-primary)', strokeWidth: 1.75 }
              : { stroke: 'var(--color-border-strong)', strokeWidth: 1.5 },
          }
        }),
    [derivedEdges, edgeMetaById, hiddenIds],
  )

  const nowX = useMemo(() => {
    let x: number | null = null
    for (const node of nodes) {
      if (node.data.status?.state !== 'active') continue
      const centre = node.position.x + (node.width ?? 0) / 2
      x = x === null ? centre : Math.max(x, centre)
    }
    return x
  }, [nodes])

  return { nodes, edges: flowEdges, phaseBands, height: layout.height, nowX }
}
