import { type NodeProps } from '@xyflow/react'
import { memo, type ReactElement } from 'react'

import { BlockNode, type BlockFlowNode } from './BlockNode'
import { LusciiProgramBlockNode } from './external/luscii'
import type { LusciiProgramFlowNode } from './external/luscii/LusciiProgramBlockNode'

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
  const blockType = props.data.block.type
  if (blockType === 'luscii.program') {
    // reason: variance erasure between two heterogeneous xyflow node-data
    // shapes that share the same xyflow type key. `LusciiProgramBlockNodeData`
    // extends `BlockNodeData` with an optional `resolvedProgram` field that
    // the generic `useFlowNodes` mapper does not populate today (the picker
    // integration change writes it in). The Luscii component treats a
    // missing field as `null` (empty state).
    return <LusciiProgramBlockNode {...(props as NodeProps<LusciiProgramFlowNode>)} />
  }
  return <BlockNode {...props} />
}
