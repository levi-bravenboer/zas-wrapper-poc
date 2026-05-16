import '@xyflow/react/dist/style.css'

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import { type ReactElement, useMemo } from 'react'

import type { PathwayBlock, PathwayDefinition, PathwayEdge } from '../types'

type Props = {
  pathway: PathwayDefinition
}

type SpikeNodeData = {
  label: string
  type: string
}

function toNodes(blocks: PathwayBlock[]): Node<SpikeNodeData>[] {
  return blocks.map((block, index) => ({
    id: block.id,
    position: {
      x: block.x || index * 220,
      y: block.y || 0,
    },
    data: {
      label: block.label ?? block.type,
      type: block.type,
    },
  }))
}

function toEdges(edges: PathwayEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source_block_id,
    target: edge.target_block_id,
  }))
}

export function PathwayCanvasSpike({ pathway }: Props): ReactElement {
  const nodes = useMemo(() => toNodes(pathway.blocks ?? []), [pathway.blocks])
  const edges = useMemo(() => toEdges(pathway.edges ?? []), [pathway.edges])

  return (
    <ReactFlowProvider>
      <div className="h-[calc(100vh-12rem)] w-full">
        <ReactFlow
          defaultNodes={nodes}
          defaultEdges={edges}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}
