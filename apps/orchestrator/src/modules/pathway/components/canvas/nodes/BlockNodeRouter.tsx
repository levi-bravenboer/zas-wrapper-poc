import { type NodeProps } from '@xyflow/react'
import { memo, type ReactElement } from 'react'

import { BlockNode, type BlockFlowNode } from './BlockNode'
import { EndBlockNode, type EndFlowNode } from './EndBlockNode'
import { LusciiProgramBlockNode } from './external/luscii'
import type { LusciiProgramFlowNode } from './external/luscii/LusciiProgramBlockNode'
import { NestedPathwayBlockNode } from './internal/nestedPathway'
import type { NestedPathwayFlowNode } from './internal/nestedPathway/NestedPathwayBlockNode'
import { StartBlockNode, type StartFlowNode } from './StartBlockNode'

/**
 * xyflow node-type dispatcher.
 *
 * `NODE_TYPES = { block: BlockNodeRouter }` is the only registration we ever
 * add to xyflow. Per-provider components plug in here via the inner switch
 * on `data.block.type` prefix; xyflow stays unaware of providers.
 *
 * Native bare codes (`appointment`, `task`, …) route to the existing
 * `BlockNode`. Dotted codes (`<provider>.<kind>`) route to provider-specific
 * components — today: `luscii.program` → `LusciiProgramBlockNode`.
 *
 * Future providers register here, not at xyflow level.
 */
export const BlockNodeRouter = memo(BlockNodeRouterImpl)

function BlockNodeRouterImpl(props: NodeProps<BlockFlowNode>): ReactElement {
  // Dispatch on the typed `kind` discriminator from
  // `pathway-model-foundations` §4.1. The legacy `type` column is
  // Slot #2 §6 retired the legacy `type` envelope field; dispatch
  // solely on the typed `kind` discriminator.
  const kind = props.data.block.kind
  if (kind === 'start') {
    return <StartBlockNode {...(props as NodeProps<StartFlowNode>)} />
  }
  if (kind === 'end_pathway') {
    return <EndBlockNode {...(props as NodeProps<EndFlowNode>)} />
  }
  if (kind === 'external_program') {
    // reason: variance erasure between two heterogeneous xyflow node-data
    // shapes that share the same xyflow type key. `LusciiProgramBlockNodeData`
    // extends `BlockNodeData` with an optional `resolvedProgram` field that
    // the generic `useFlowNodes` mapper does not populate today (the picker
    // integration change writes it in). The Luscii component treats a
    // missing field as `null` (empty state).
    return <LusciiProgramBlockNode {...(props as NodeProps<LusciiProgramFlowNode>)} />
  }
  if (kind === 'pathway_link') {
    // Internal-source dispatch — `pathway.link` follows the same per-kind
    // pattern as external providers so future internal kinds (e.g.
    // `pathway.fork`) land alongside it without touching the generic
    // node component.
    return <NestedPathwayBlockNode {...(props as NodeProps<NestedPathwayFlowNode>)} />
  }
  return <BlockNode {...props} />
}
