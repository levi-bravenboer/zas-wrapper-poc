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

// Single xyflow node type; per-kind / per-provider routing lives
// inside `BlockNodeRouter`.
const NODE_TYPES = { block: BlockNodeRouter } as const
const EDGE_TYPES = { smoothstep: SmoothstepEdge } as const

// Pathway-completion §C2.2: blocks drag within their (phase, lane)
// cell via per-node `extent` clamping; edges stay derived.
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

  const layout = useMemo(() => computeBlockLayout(blocks), [blocks])
  // Hide empty lanes on canvas render; dialog picker still sees all.
  const lanesOnCanvas = useMemo(() => visibleLanes(lanes, blocks), [lanes, blocks])

  const fitInputs = useMemo<BlockFitInput[]>(() => {
    const byCode = new Map(blockTypes.map((bt) => [bt.type, bt]))
    return blocks.map((b) => {
      const dims = getBlockDimensions(b, byCode.get(legacyBlockType(b)) ?? null)
      // Use the rendered position (manual drag wins) so phase / lane
      // grow to fit it.
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

  const onNodesChange = useCallback(
    (changes: NodeChange<BlockFlowNode>[]) => {
      setNodes((cur) => applyNodeChanges(changes, cur))
      dispatchNodesChange(changes)
    },
    [dispatchNodesChange],
  )

  // Snap drop to the (col, row) grid; bump the row if the slot is
  // already taken so manual drags never overlap.
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
