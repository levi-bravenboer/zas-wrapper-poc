import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type NodeChange,
  ReactFlow,
  ViewportPortal,
} from '@xyflow/react'
import { type ReactElement, useCallback, useState } from 'react'

import { CANVAS_VIEWPORT } from '@/modules/pathway/constants/canvas'
import { inkAlpha } from '@/modules/pathway/constants/theme'
import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayEdge,
  PathwayPhase,
  PathwayTimingValue,
} from '@/modules/pathway/types'

import { RuntimeBlockNode, type RuntimeFlowNode } from './RuntimeBlockNode'
import { RuntimeNavigator } from './RuntimeNavigator'
import { RuntimePhaseBands } from './RuntimePhaseBands'
import { RuntimePlayhead } from './RuntimePlayhead'
import { RUNTIME_STATE_COLOR, type RuntimeBlockStatus } from './runtimeState'
import { useRuntimeGraph } from './useRuntimeGraph'

function miniMapNodeColor(node: RuntimeFlowNode): string {
  const state = node.data?.status?.state
  return state ? RUNTIME_STATE_COLOR[state] : 'var(--color-border)'
}

import '@xyflow/react/dist/style.css'

const NODE_TYPES = { runtime: RuntimeBlockNode } as const

export interface RuntimeCanvasProps {
  blocks: PathwayBlock[]
  phases: PathwayPhase[]
  edges: PathwayEdge[]
  timingValues: PathwayTimingValue[]
  blockTypes: PathwayBlockType[]
  statusByBlockId: Map<string, RuntimeBlockStatus>
  showSkipped: boolean
}

// Read-only runtime view of a published pathway version. Layout is auto-
// computed from the flow graph (business logic), not builder coordinates: no
// swimlanes, sequential chains in one line, step edges.
export function RuntimeCanvas(props: RuntimeCanvasProps): ReactElement {
  const { nodes: derivedNodes, edges, phaseBands, height, nowX } = useRuntimeGraph(props)

  // Local node state so ReactFlow can store measured dimensions (needed for
  // `fitView`); re-seed whenever the derived graph changes (status updates).
  const [nodes, setNodes] = useState<RuntimeFlowNode[]>(derivedNodes)
  const [lastDerived, setLastDerived] = useState(derivedNodes)
  if (lastDerived !== derivedNodes) {
    setLastDerived(derivedNodes)
    setNodes(derivedNodes)
  }
  const onNodesChange = useCallback(
    (changes: NodeChange<RuntimeFlowNode>[]) => setNodes((cur) => applyNodeChanges(changes, cur)),
    [],
  )

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-lg border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: CANVAS_VIEWPORT.fitPadding }}
        onInit={(instance) => {
          requestAnimationFrame(() => instance.fitView({ padding: CANVAS_VIEWPORT.fitPadding }))
        }}
        minZoom={CANVAS_VIEWPORT.minZoom}
        maxZoom={CANVAS_VIEWPORT.maxZoom}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={inkAlpha(0.06)} />
        <RuntimeNavigator nodeColor={miniMapNodeColor} />
        <ViewportPortal>
          <RuntimePhaseBands bands={phaseBands} height={height} />
          {nowX !== null ? <RuntimePlayhead x={nowX} height={height} /> : null}
        </ViewportPortal>
      </ReactFlow>
    </div>
  )
}
