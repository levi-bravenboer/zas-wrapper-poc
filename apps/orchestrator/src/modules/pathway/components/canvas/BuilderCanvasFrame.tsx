import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ReactFlow,
  ViewportPortal,
  type NodeChange,
} from '@xyflow/react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { buildCanvasGeometry, type CanvasGeometry } from '../../canvasLayout'
import { CANVAS_VIEWPORT } from '../../constants/canvas'
import { inkAlpha } from '../../constants/theme'
import { useCanvasHandlers } from '../../hooks/useCanvasHandlers'
import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayEdge,
  PathwayLane,
  PathwayPhase,
  PathwayTimingValue,
} from '../../types'
import type { BuilderAction, BuilderSelection } from '../../useBuilderState'
import { isLaneAllowed } from '../../utils/laneRules'

import { BackgroundLayers } from './BackgroundLayers'
import { SmoothstepEdge } from './edges/SmoothstepEdge'
import { EmptyCanvasCTA } from './EmptyCanvasCTA'
import { type LaneDropState } from './LaneRow'
import { NavigatorPanel } from './NavigatorPanel'
import { BlockNode, type BlockFlowNode } from './nodes/BlockNode'
import type { DragContextApi } from './useDragContext'
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
  dragApi: DragContextApi
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
  dragApi,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const geometry: CanvasGeometry = useMemo(
    () => buildCanvasGeometry(phases, lanes),
    [phases, lanes],
  )

  const derivedNodes = useFlowNodes({
    blocks,
    lanes,
    blockTypes,
    timingValues,
    edges,
    geometry,
    selection,
  })

  const [nodes, setNodes] = useState<BlockFlowNode[]>(derivedNodes)
  const [lastDerived, setLastDerived] = useState(derivedNodes)
  if (lastDerived !== derivedNodes) {
    setLastDerived(derivedNodes)
    setNodes(derivedNodes)
  }

  const flowEdges = useFlowEdges({ edges, blocks, blockTypes, timingValues, selection })

  const {
    onNodesChange: dispatchNodesChange,
    onEdgesChange,
    onConnect,
    onDrop,
    onDragOver,
    onPaneClick,
  } = useCanvasHandlers({
    blocks,
    blockTypes,
    lanes,
    geometry,
    dispatch,
    onDropBlockType,
    dragApi,
  })

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: BlockFlowNode) => {
      const block = blocks.find((b) => b.id === node.id)
      if (!block) return
      const bt = blockTypes.find((c) => c.type === block.type)
      if (!bt) return
      dragApi.startMoveDrag(block.id, bt.type, bt.allowed_lane_kind_codes)
    },
    [blocks, blockTypes, dragApi],
  )

  const onNodeDragStop = useCallback(() => {
    dragApi.endDrag()
  }, [dragApi])

  const laneDropStates = useMemo<Record<string, LaneDropState>>(() => {
    const out: Record<string, LaneDropState> = {}
    if (dragApi.drag.kind === 'idle') {
      for (const lane of lanes) out[lane.id] = 'idle'
      return out
    }
    const allowed = dragApi.drag.allowedLaneKindCodes
    for (const lane of lanes) {
      out[lane.id] = isLaneAllowed({ allowed_lane_kind_codes: [...allowed] }, lane.lane_kind_code)
        ? 'valid'
        : 'invalid'
    }
    return out
  }, [dragApi.drag, lanes])

  const onNodesChange = useCallback(
    (changes: NodeChange<BlockFlowNode>[]) => {
      setNodes((cur) => applyNodeChanges(changes, cur))
      dispatchNodesChange(changes)
    },
    [dispatchNodesChange],
  )

  const scaffoldPresent = !!phases.length && !!lanes.length

  return (
    <div
      role="application"
      aria-label={t('canvas.label')}
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
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
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
        nodesDraggable={scaffoldPresent}
        nodeDragThreshold={CANVAS_VIEWPORT.dragThreshold}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={inkAlpha(0.06)} />
        <ViewportPortal>
          <BackgroundLayers
            phases={phases}
            lanes={lanes}
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
