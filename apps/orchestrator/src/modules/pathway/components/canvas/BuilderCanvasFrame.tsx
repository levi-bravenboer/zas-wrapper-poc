import { applyNodeChanges, Background, BackgroundVariant, ReactFlow, ViewportPortal, type NodeChange, type Node } from '@xyflow/react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  buildCanvasGeometry,
  type CanvasGeometry,
  type BlockFitInput,
} from '../../canvasLayout'
import { CANVAS_VIEWPORT } from '../../constants/canvas'
import { inkAlpha } from '../../constants/theme'
import { useCanvasHandlers } from '../../hooks/useCanvasHandlers'
import { computeBlockLayout, visibleLanes } from '../../layout/computeBlockLayout'
import {
  LAYOUT_CELL_X_PAD,
  LAYOUT_CELL_Y_PAD,
  LAYOUT_COLUMN_GUTTER,
  LAYOUT_ROW_GUTTER,
} from '../../layout/constants'
import {
  legacyBlockType,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayEdge,
  type PathwayLane,
  type PathwayPhase,
  type PathwayTimingValue,
} from '../../types'
import type { BuilderAction, BuilderSelection } from '../../useBuilderState'
import { getBlockDimensions } from '../../utils/blockDimensions'

import { BackgroundLayers } from './BackgroundLayers'
import { SmoothstepEdge } from './edges/SmoothstepEdge'
import { EmptyCanvasCTA } from './EmptyCanvasCTA'
import { type LaneDropState } from './LaneRow'
import { NavigatorPanel } from './NavigatorPanel'
import { type BlockFlowNode } from './nodes/BlockNode'
import { BlockNodeRouter } from './nodes/BlockNodeRouter'
import { useFlowEdges } from './useFlowEdges'
import { useFlowNodes } from './useFlowNodes'

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
  onRequestDeleteBlock: (blockId: string) => void
}

// One xyflow node type, ever. The router dispatches on `data.block.type`
// (bare vs dotted) to the per-provider component. Future providers register
// inside `BlockNodeRouter`, not here — see
// `openspec/changes/external-block-integrations/design.md` §"One xyflow
// node type, dispatcher inside".
const NODE_TYPES = { block: BlockNodeRouter } as const
const EDGE_TYPES = { smoothstep: SmoothstepEdge } as const

// Pathway-completion § C2.2: the canvas renders the derived layout.
// Blocks may be re-aligned within their (phase, lane) cell — xyflow
// clamps each node to a per-node `extent` so the author can never
// drag a block out of its lane or phase. Edges derive from
// `input_logic` server-side and never change on drag. Authoring
// (kind, config, input_logic, timing_policy) still happens in the
// block dialog; auto-layout owns placement until the author drags.
export function BuilderCanvasFrame({
  phases,
  lanes,
  blocks,
  edges,
  timingValues,
  blockTypes,
  selection,
  dispatch,
  onRequestDeleteBlock,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')

  // § C3: computed positions per (phase, lane) cell. Authored x/y ignored.
  const layout = useMemo(() => computeBlockLayout(blocks), [blocks])

  // § C3.3: hide lanes without blocks — canvas render only; the block
  // dialog's lane picker keeps consuming the full lane list.
  const lanesOnCanvas = useMemo(() => visibleLanes(lanes, blocks), [lanes, blocks])

  const fitInputs = useMemo<BlockFitInput[]>(() => {
    const byCode = new Map(blockTypes.map((bt) => [bt.type, bt]))
    return blocks.map((b) => {
      const dims = getBlockDimensions(b, byCode.get(legacyBlockType(b)) ?? null)
      // Match the position used by `useFlowNodes`: a manual drag wins
      // over auto-layout, so the phase column / lane row must grow to
      // contain the authored position too.
      const hasManualPosition = b.x !== 0 || b.y !== 0
      const pos = hasManualPosition ? { x: b.x, y: b.y } : (layout.get(b.id) ?? { x: 0, y: 0 })
      return {
        phase_id: b.phase_id,
        lane_id: b.lane_id,
        x: pos.x,
        y: pos.y,
        width: dims.width,
        height: dims.height,
      }
    })
  }, [blocks, blockTypes, layout])
  const geometry: CanvasGeometry = useMemo(
    () => buildCanvasGeometry(phases, lanesOnCanvas, fitInputs),
    [phases, lanesOnCanvas, fitInputs],
  )

  const derivedNodes = useFlowNodes({
    blocks,
    lanes: lanesOnCanvas,
    blockTypes,
    timingValues,
    geometry,
    layout,
    selection,
    onRequestDelete: onRequestDeleteBlock,
  })

  const [nodes, setNodes] = useState<BlockFlowNode[]>(derivedNodes)
  const [lastDerived, setLastDerived] = useState(derivedNodes)
  if (lastDerived !== derivedNodes) {
    setLastDerived(derivedNodes)
    setNodes(derivedNodes)
  }

  const flowEdges = useFlowEdges({ edges, blocks, blockTypes, timingValues })

  const { onNodesChange: dispatchNodesChange, onEdgesChange, onPaneClick } = useCanvasHandlers({
    dispatch,
  })

  const laneDropStates = useMemo<Record<string, LaneDropState>>(() => {
    const out: Record<string, LaneDropState> = {}
    for (const lane of lanesOnCanvas) out[lane.id] = 'idle'
    return out
  }, [lanesOnCanvas])

  const onNodesChange = useCallback(
    (changes: NodeChange<BlockFlowNode>[]) => {
      setNodes((cur) => applyNodeChanges(changes, cur))
      dispatchNodesChange(changes)
    },
    [dispatchNodesChange],
  )

  // Re-align within the (phase, lane) cell. xyflow clamps drag via
  // the per-node `extent` set in useFlowNodes; on drop we snap to the
  // closest (col, row) grid slot inside the cell and bump the row if
  // another block already occupies that slot — so manual drags never
  // overlap each other (auto-layout already lays out without
  // overlap). The snapped position is persisted relative to the cell
  // origin so authored x/y survives the round-trip.
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node<BlockFlowNode['data']>) => {
      const block = node.data.block
      const phaseLeft = geometry.phaseX(block.phase_id)
      const laneTop = geometry.laneY(block.lane_id)
      const cellX = node.position.x - phaseLeft
      const cellY = node.position.y - laneTop
      const colStep = BLOCK_WIDTH + LAYOUT_COLUMN_GUTTER
      const rowStep = BLOCK_HEIGHT + LAYOUT_ROW_GUTTER
      const dropCol = Math.max(0, Math.round((cellX - LAYOUT_CELL_X_PAD) / colStep))
      const dropRow = Math.max(0, Math.round((cellY - LAYOUT_CELL_Y_PAD) / rowStep))
      // Build occupancy map from the *effective* (col, row) of every
      // other block in this (phase, lane) cell — same rule
      // `useFlowNodes` uses to pick the rendered position.
      const occupied = new Set<string>()
      for (const other of blocks) {
        if (other.id === block.id) continue
        if (other.phase_id !== block.phase_id || other.lane_id !== block.lane_id) continue
        const hasManual = other.x !== 0 || other.y !== 0
        const pos = hasManual ? { x: other.x, y: other.y } : layout.get(other.id) ?? { x: 0, y: 0 }
        const c = Math.max(0, Math.round((pos.x - LAYOUT_CELL_X_PAD) / colStep))
        const r = Math.max(0, Math.round((pos.y - LAYOUT_CELL_Y_PAD) / rowStep))
        occupied.add(`${c}::${r}`)
      }
      let finalRow = dropRow
      while (occupied.has(`${dropCol}::${finalRow}`)) finalRow += 1
      const x = LAYOUT_CELL_X_PAD + dropCol * colStep
      const y = LAYOUT_CELL_Y_PAD + finalRow * rowStep
      if (x === block.x && y === block.y) return
      dispatch({ type: 'move-block', blockId: block.id, x, y })
    },
    [blocks, dispatch, geometry, layout],
  )

  const scaffoldPresent = !!phases.length && !!lanes.length

  return (
    <div role="application" aria-label={t('canvas.label')} className="absolute inset-0 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={onPaneClick}
        defaultViewport={CANVAS_VIEWPORT.initial}
        onInit={(instance) => {
          if (blocks.length) instance.fitView({ padding: CANVAS_VIEWPORT.fitPadding })
        }}
        minZoom={CANVAS_VIEWPORT.minZoom}
        maxZoom={CANVAS_VIEWPORT.maxZoom}
        panOnDrag={scaffoldPresent}
        panOnScroll={scaffoldPresent}
        zoomOnScroll={scaffoldPresent}
        zoomOnPinch={scaffoldPresent}
        zoomOnDoubleClick={scaffoldPresent}
        nodesDraggable={true}
        nodesConnectable={false}
        selectNodesOnDrag={false}
        onNodeDragStop={onNodeDragStop}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={inkAlpha(0.06)} />
        <ViewportPortal>
          <BackgroundLayers
            phases={phases}
            lanes={lanesOnCanvas}
            blocks={blocks}
            geometry={geometry}
            laneDropStates={laneDropStates}
            onResizePhase={(phaseId, width) => dispatch({ type: 'resize-phase', phaseId, width })}
            onResizeLane={(laneId, height) => dispatch({ type: 'resize-lane', laneId, height })}
          />
        </ViewportPortal>
        {!blocks.length && <EmptyCanvasCTA scaffoldPresent={scaffoldPresent} />}
        {scaffoldPresent && (
          <NavigatorPanel
            phases={phases}
            lanes={lanesOnCanvas}
            blocks={blocks}
            edges={edges}
            geometry={geometry}
          />
        )}
      </ReactFlow>
    </div>
  )
}
