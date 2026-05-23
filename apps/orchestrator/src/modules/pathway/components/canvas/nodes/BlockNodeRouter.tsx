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
    // The Luscii node augments `data` with a `resolvedProgram` field that
    // the generic `useFlowNodes` mapper does not populate today. The picker
    // integration change writes it in; until then the Luscii component
    // treats a missing field as `null` (empty state). We cast the props
    // here rather than mutate them — xyflow re-renders with stable identity.
    return <LusciiProgramBlockNode {...(props as unknown as NodeProps<LusciiProgramFlowNode>)} />
  }
  return <BlockNode {...props} />
}
