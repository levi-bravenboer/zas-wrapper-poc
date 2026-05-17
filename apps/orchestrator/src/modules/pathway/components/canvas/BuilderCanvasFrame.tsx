import { Background, BackgroundVariant, ReactFlow, ViewportPortal } from '@xyflow/react'
import { useMemo, type ReactElement } from 'react'

import { buildCanvasGeometry, type CanvasGeometry } from '../../canvasLayout'
import { useCanvasHandlers } from '../../hooks/useCanvasHandlers'
import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayEdge,
  PathwayLane,
  PathwayPhase,
  PathwayTimingValue,
} from '../../types'
import type { BuilderAction, BuilderSelection, DimensionMap } from '../../useBuilderState'

import { BackgroundLayers } from './BackgroundLayers'
import { SmoothstepEdge } from './edges/SmoothstepEdge'
import { EmptyCanvasCTA } from './EmptyCanvasCTA'
import { NavigatorPanel } from './NavigatorPanel'
import { BlockNode } from './nodes/BlockNode'
import { useFlowEdges } from './useFlowEdges'
import { useFlowNodes } from './useFlowNodes'

import '@xyflow/react/dist/style.css'

export type CanvasDropTarget = {
  phaseId: string
  laneId: string
  x: number
  y: number
}

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  edges: PathwayEdge[]
  timingValues: PathwayTimingValue[]
  blockTypes: PathwayBlockType[]
  selection: BuilderSelection
  dispatch: (action: BuilderAction) => void
  onDropBlockType: (typeCode: string, target: CanvasDropTarget | null) => void
  phaseSizes: DimensionMap
  laneSizes: DimensionMap
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
  phaseSizes,
  laneSizes,
}: Props): ReactElement {
  const geometry: CanvasGeometry = useMemo(
    () => buildCanvasGeometry(phases, lanes, phaseSizes, laneSizes),
    [phases, lanes, phaseSizes, laneSizes],
  )

  const nodes = useFlowNodes({
    blocks,
    lanes,
    blockTypes,
    timingValues,
    edges,
    geometry,
    selection,
  })

  const flowEdges = useFlowEdges({ edges, blocks, blockTypes, timingValues, selection })

  const { onNodesChange, onEdgesChange, onConnect, onDrop, onDragOver, onPaneClick } =
    useCanvasHandlers({ blocks, geometry, dispatch, onDropBlockType })

  const scaffoldPresent = !!phases.length && !!lanes.length

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
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        onInit={(instance) => {
          if (blocks.length) instance.fitView({ padding: 0.18 })
        }}
        minZoom={0.4}
        maxZoom={2}
        panOnDrag={scaffoldPresent}
        panOnScroll={scaffoldPresent}
        zoomOnScroll={scaffoldPresent}
        zoomOnPinch={scaffoldPresent}
        zoomOnDoubleClick={scaffoldPresent}
        nodesDraggable={scaffoldPresent}
        nodeDragThreshold={3}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(11,26,23,0.06)"
        />
        <ViewportPortal>
          <BackgroundLayers
            phases={phases}
            lanes={lanes}
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
            lanes={lanes}
            blocks={blocks}
            edges={edges}
            geometry={geometry}
          />
        )}
      </ReactFlow>
    </div>
  )
}
