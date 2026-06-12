import { applyNodeChanges, Background, BackgroundVariant, ReactFlow, ViewportPortal, type NodeChange } from '@xyflow/react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { buildCanvasGeometry, type CanvasGeometry, type BlockFitInput } from '../../canvasLayout'
import { CANVAS_VIEWPORT } from '../../constants/canvas'
import { inkAlpha } from '../../constants/theme'
import { useCanvasHandlers } from '../../hooks/useCanvasHandlers'
import { computeBlockLayout, visibleLanes } from '../../layout/computeBlockLayout'
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

// Pathway-completion § C2.2: the canvas is a read-only render of the
// derived layout. No block dragging, no edge dragging, no drop targets —
// authoring happens in the block dialog; placement comes from
// `computeBlockLayout`; edges derive from `input_logic` server-side.
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
      const pos = layout.get(b.id) ?? { x: 0, y: 0 }
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
    edges,
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

  const flowEdges = useFlowEdges({ edges, blocks, blockTypes, timingValues, selection })

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
        nodesDraggable={false}
        nodesConnectable={false}
        selectNodesOnDrag={false}
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
