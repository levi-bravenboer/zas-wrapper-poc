import { type Edge } from '@xyflow/react'
import { useMemo } from 'react'

import { indexById } from '@/lib/utils/indexBy'

import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayEdge,
  PathwayTimingValue,
} from '../../types'
import type { BuilderSelection } from '../../useBuilderState'

import type { SmoothstepEdgeData } from './edges/SmoothstepEdge'

type Params = {
  edges: PathwayEdge[]
  blocks: PathwayBlock[]
  blockTypes: PathwayBlockType[]
  timingValues: PathwayTimingValue[]
  selection: BuilderSelection
}

const EDGE_SHAPE = {
  branch: { sourceHandle: 'yes', variant: 'primary' },
  fallback: { sourceHandle: 'no', variant: 'dashed' },
  plain: { sourceHandle: 'out', variant: 'default' },
} as const

export function useFlowEdges({
  edges,
  blocks,
  blockTypes,
  timingValues,
  selection,
}: Params): Edge<SmoothstepEdgeData>[] {
  const typesByCode = useMemo(() => new Map(blockTypes.map((t) => [t.type, t])), [blockTypes])
  const blocksById = useMemo(() => indexById(blocks), [blocks])
  const timingById = useMemo(() => indexById(timingValues), [timingValues])

  return useMemo(
    () =>
      edges.map((edge) => {
        const sourceType = typesByCode.get(blocksById.get(edge.source_block_id)?.type ?? '')
        const isBranch = !!sourceType?.supports_branches
        const shape =
          EDGE_SHAPE[edge.source_branch_id ? 'branch' : isBranch ? 'fallback' : 'plain']
        return {
          id: edge.id,
          source: edge.source_block_id,
          target: edge.target_block_id,
          sourceHandle: shape.sourceHandle,
          targetHandle: 'in',
          type: 'smoothstep',
          data: {
            variant: shape.variant,
            label: edge.delay_value_id
              ? formatDelay(timingById.get(edge.delay_value_id) ?? null)
              : null,
          },
          selected: selection.kind === 'edge' && selection.edgeId === edge.id,
        }
      }),
    [edges, typesByCode, blocksById, timingById, selection],
  )
}

function formatDelay(value: PathwayTimingValue | null): string | null {
  if (!value) return null
  if (value.kind === 'enrollment') return '+0d'
  const d = value.fixed_days
  if (d === null || d === undefined || d === 0) return null
  return d > 0 ? `+${d}d` : `${d}d`
}
