import { type Edge, MarkerType } from '@xyflow/react'
import { useMemo } from 'react'

import {
  type BlockFitInput,
  buildCanvasGeometry,
  type CanvasGeometry,
} from '@/modules/pathway/canvasLayout'
import type { SmoothstepEdgeData } from '@/modules/pathway/components/canvas/edges/SmoothstepEdge'
import { useFlowEdges } from '@/modules/pathway/components/canvas/useFlowEdges'
import { computeBlockLayout, visibleLanes } from '@/modules/pathway/layout/computeBlockLayout'
import {
  legacyBlockType,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayEdge,
  type PathwayLane,
  type PathwayPhase,
  type PathwayTimingValue,
} from '@/modules/pathway/types'
import { getBlockDimensions } from '@/modules/pathway/utils/blockDimensions'

import type { RuntimeFlowNode } from './RuntimeBlockNode'
import type { RuntimeBlockStatus } from './runtimeState'

export interface UseRuntimeGraphParams {
  blocks: PathwayBlock[]
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  edges: PathwayEdge[]
  timingValues: PathwayTimingValue[]
  blockTypes: PathwayBlockType[]
  statusByBlockId: Map<string, RuntimeBlockStatus>
  // When false, blocks skipped by a past branch are hidden (the pathway took
  // another direction, so they're irrelevant to non-privileged viewers).
  showSkipped: boolean
}

export interface RuntimeGraph {
  nodes: RuntimeFlowNode[]
  edges: Edge<SmoothstepEdgeData>[]
  geometry: CanvasGeometry
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
// ReactFlow graph. Reuses the builder's pure layout/geometry math and edge
// derivation; the node + backdrop presentation is runtime-owned.
export function useRuntimeGraph({
  blocks,
  phases,
  lanes,
  edges,
  timingValues,
  blockTypes,
  statusByBlockId,
  showSkipped,
}: UseRuntimeGraphParams): RuntimeGraph {
  const layout = useMemo(() => computeBlockLayout(blocks), [blocks])
  const lanesOnCanvas = useMemo(() => visibleLanes(lanes, blocks), [lanes, blocks])
  const typesByCode = useMemo(() => new Map(blockTypes.map((bt) => [bt.type, bt])), [blockTypes])

  // Dead-branch (skipped) blocks hidden unless the viewer may see them.
  // Geometry/layout stay computed from all blocks so positions don't shift.
  const hiddenIds = useMemo(() => {
    const set = new Set<string>()
    if (!showSkipped) {
      for (const b of blocks) {
        if (statusByBlockId.get(b.id)?.state === 'skipped') set.add(b.id)
      }
    }
    return set
  }, [blocks, statusByBlockId, showSkipped])

  const fitInputs = useMemo<BlockFitInput[]>(
    () =>
      blocks.map((b) => {
        const dims = getBlockDimensions(b, typesByCode.get(legacyBlockType(b)) ?? null)
        const hasManualPosition = b.x !== 0 || b.y !== 0
        const pos = hasManualPosition ? { x: b.x, y: b.y } : (layout.get(b.id) ?? { x: 0, y: 0 })
        return { phase_id: b.phase_id, lane_id: b.lane_id, x: pos.x, y: pos.y, ...dims }
      }),
    [blocks, typesByCode, layout],
  )

  const geometry = useMemo(
    () => buildCanvasGeometry(phases, lanesOnCanvas, fitInputs),
    [phases, lanesOnCanvas, fitInputs],
  )

  const nodes = useMemo<RuntimeFlowNode[]>(
    () =>
      blocks
        .filter((block) => !hiddenIds.has(block.id))
        .map((block) => {
          const blockType = typesByCode.get(legacyBlockType(block)) ?? null
          const dims = getBlockDimensions(block, blockType)
          const hasManualPosition = block.x !== 0 || block.y !== 0
          const cell = hasManualPosition
            ? { x: block.x, y: block.y }
            : (layout.get(block.id) ?? { x: 0, y: 0 })
          return {
            id: block.id,
            type: 'runtime',
            position: {
              x: geometry.phaseX(block.phase_id) + cell.x,
              y: geometry.laneY(block.lane_id) + cell.y,
            },
            data: {
              block,
              blockType,
              status: statusByBlockId.get(block.id),
            },
            width: dims.width,
            height: dims.height,
            // xyflow sizes the wrapper from `style`; `width`/`height` above are
            // layout hints. Mirrors the builder's inline-style sizing.
            style: { width: dims.width, height: dims.height },
            draggable: false,
            selectable: false,
          }
        }),
    [blocks, hiddenIds, typesByCode, layout, geometry, statusByBlockId],
  )

  const derivedEdges = useFlowEdges({ edges, blocks, blockTypes, timingValues })

  // Branch metadata keyed by the same id `useFlowEdges` builds, so we can label
  // decision splits + colour their edges.
  const edgeMetaById = useMemo(() => {
    const map = new Map<string, { label: string | null; isBranch: boolean }>()
    for (const e of edges) {
      const id = `${e.source_block_id ?? 'marker'}->${e.target_block_id}:${e.predicate}`
      map.set(id, { label: edgeConditionLabel(e), isBranch: e.predicate === 'decision_output' })
    }
    return map
  }, [edges])

  // Clean orthogonal edges, arrowheads for direction, branch labels + accent
  // so a split reads as "walk this edge when <condition>". Drop edges touching
  // a hidden (skipped) block.
  const flowEdges = useMemo(
    () =>
      derivedEdges
        .filter((edge) => !hiddenIds.has(edge.source) && !hiddenIds.has(edge.target))
        .map((edge) => {
          const meta = edgeMetaById.get(edge.id)
          return {
            ...edge,
            type: 'step',
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

  return { nodes, edges: flowEdges, geometry, nowX }
}
