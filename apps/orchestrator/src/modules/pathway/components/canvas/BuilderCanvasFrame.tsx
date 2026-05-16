import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { useCallback, useMemo, type ReactElement } from 'react'

import { BLOCK_HEIGHT, BLOCK_WIDTH, laneRowY, phaseColumnX } from '../../canvasLayout'
import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayEdge,
  PathwayLane,
  PathwayPhase,
  PathwayTimingValue,
} from '../../types'
import type { BuilderAction, BuilderSelection } from '../../useBuilderState'

import { BackgroundLayers } from './BackgroundLayers'
import { SmoothstepEdge, type SmoothstepEdgeData } from './edges/SmoothstepEdge'
import { EmptyCanvasCTA } from './EmptyCanvasCTA'
import { BlockNode, type BlockNodeData } from './nodes/BlockNode'

import '@xyflow/react/dist/style.css'

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  edges: PathwayEdge[]
  timingValues: PathwayTimingValue[]
  blockTypes: PathwayBlockType[]
  selection: BuilderSelection
  dispatch: (action: BuilderAction) => void
  onDropBlockType: (typeCode: string, position: { x: number; y: number }) => void
}

const NODE_TYPES = { block: BlockNode } as const
const EDGE_TYPES = { smoothstep: SmoothstepEdge } as const

export function BuilderCanvasFrame({
  phases,
  lanes,
  blocks,
  edges,
  timingValues,
  blockTypes,
  selection,
  dispatch,
  onDropBlockType,
}: Props): ReactElement {
  const phaseIndex = useMemo(() => {
    const m = new Map<string, number>()
    ;[...phases].sort((a, b) => a.ord - b.ord).forEach((p, i) => m.set(p.id, i))
    return m
  }, [phases])
  const laneIndex = useMemo(() => {
    const m = new Map<string, number>()
    ;[...lanes].sort((a, b) => a.ord - b.ord).forEach((l, i) => m.set(l.id, i))
    return m
  }, [lanes])
  const lanesById = useMemo(() => new Map(lanes.map((l) => [l.id, l])), [lanes])
  const typesByCode = useMemo(() => new Map(blockTypes.map((t) => [t.type, t])), [blockTypes])
  const timingById = useMemo(() => new Map(timingValues.map((v) => [v.id, v])), [timingValues])
  const incomingByTarget = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of edges) m.set(e.target_block_id, (m.get(e.target_block_id) ?? 0) + 1)
    return m
  }, [edges])

  const nodes: Node<BlockNodeData>[] = useMemo(
    () =>
      blocks.map((block) => {
        const phaseIdx = phaseIndex.get(block.phase_id) ?? 0
        const laneIdx = laneIndex.get(block.lane_id) ?? 0
        const baseX = phaseColumnX(phaseIdx)
        const baseY = laneRowY(laneIdx)
        return {
          id: block.id,
          type: 'block',
          position: {
            x: baseX + (block.x || 70),
            y: baseY + (block.y || LANE_INSET - BLOCK_HEIGHT / 2),
          },
          data: {
            block,
            blockType: typesByCode.get(block.type) ?? null,
            lane: lanesById.get(block.lane_id) ?? null,
            duration: block.duration_value_id
              ? (timingById.get(block.duration_value_id) ?? null)
              : null,
            isEntry: (incomingByTarget.get(block.id) ?? 0) === 0,
          },
          selected: selection.kind === 'block' && selection.blockId === block.id,
          width: BLOCK_WIDTH,
          height: BLOCK_HEIGHT,
        }
      }),
    [
      blocks,
      phaseIndex,
      laneIndex,
      lanesById,
      typesByCode,
      timingById,
      incomingByTarget,
      selection,
    ],
  )

  const flowEdges: Edge<SmoothstepEdgeData>[] = useMemo(
    () =>
      edges.map((edge) => {
        const sourceType = typesByCode.get(
          blocks.find((b) => b.id === edge.source_block_id)?.type ?? '',
        )
        const isBranch = Boolean(sourceType?.supports_branches)
        return {
          id: edge.id,
          source: edge.source_block_id,
          target: edge.target_block_id,
          sourceHandle: edge.source_branch_id ? 'yes' : isBranch ? 'no' : 'out',
          targetHandle: 'in',
          type: 'smoothstep',
          data: {
            variant: edge.source_branch_id ? 'primary' : isBranch ? 'dashed' : 'default',
            label: edge.delay_value_id
              ? formatDelay(timingById.get(edge.delay_value_id) ?? null)
              : null,
          },
          selected: selection.kind === 'edge' && selection.edgeId === edge.id,
        }
      }),
    [edges, typesByCode, blocks, timingById, selection],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position && !c.dragging) {
          const block = blocks.find((b) => b.id === c.id)
          if (!block) continue
          const phaseIdx = phaseIndex.get(block.phase_id) ?? 0
          const laneIdx = laneIndex.get(block.lane_id) ?? 0
          const baseX = phaseColumnX(phaseIdx)
          const baseY = laneRowY(laneIdx)
          dispatch({
            type: 'move-block',
            blockId: c.id,
            x: c.position.x - baseX,
            y: c.position.y - baseY,
          })
        }
        if (c.type === 'select') {
          if (c.selected) dispatch({ type: 'select', selection: { kind: 'block', blockId: c.id } })
        }
        if (c.type === 'remove') dispatch({ type: 'delete-block', blockId: c.id })
      }
    },
    [blocks, phaseIndex, laneIndex, dispatch],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) {
        if (c.type === 'select' && c.selected)
          dispatch({ type: 'select', selection: { kind: 'edge', edgeId: c.id } })
        if (c.type === 'remove') dispatch({ type: 'delete-edge', edgeId: c.id })
      }
    },
    [dispatch],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return
      const edge: PathwayEdge = {
        id: crypto.randomUUID(),
        source_block_id: c.source,
        target_block_id: c.target,
        source_branch_id: null,
        delay_value_id: null,
      }
      dispatch({ type: 'add-edge', edge })
    },
    [dispatch],
  )

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const code = event.dataTransfer.getData('application/x-pathway-block-type')
      if (!code) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const position = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      onDropBlockType(code, position)
    },
    [onDropBlockType],
  )

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onPaneClick = useCallback(() => {
    dispatch({ type: 'select', selection: { kind: 'none' } })
  }, [dispatch])

  return (
    <div
      role="application"
      aria-label="Zorgpad-canvas"
      className="absolute inset-0 overflow-hidden"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        fitView
        minZoom={0.4}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(11,26,23,0.06)"
        />
        <CanvasUnderlay phases={phases} lanes={lanes} blocks={blocks} />
        {blocks.length === 0 && (
          <EmptyCanvasCTA scaffoldPresent={phases.length > 0 && lanes.length > 0} />
        )}
      </ReactFlow>
    </div>
  )
}

function CanvasUnderlay({
  phases,
  lanes,
  blocks,
}: {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
}): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <BackgroundLayers phases={phases} lanes={lanes} blocks={blocks} />
    </div>
  )
}

function formatDelay(value: PathwayTimingValue | null): string | null {
  if (!value) return null
  if (value.kind === 'enrollment') return '+0d'
  const d = value.fixed_days
  if (d === null || d === undefined || d === 0) return null
  return d > 0 ? `+${d}d` : `${d}d`
}

const LANE_INSET = 58
