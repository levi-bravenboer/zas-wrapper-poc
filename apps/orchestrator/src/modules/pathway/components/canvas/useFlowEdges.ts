import { type Edge } from '@xyflow/react'
import { useMemo } from 'react'

import { indexById } from '@/lib/utils/indexBy'

import { EDGE_SHAPE, HANDLE_IDS } from '../../constants/edge'
import {
  legacyBlockType,
  type DerivedEdge,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayTimingValue,
} from '../../types'
import type { SmoothstepEdgeData } from './edges/SmoothstepEdge'

type Params = {
  edges: DerivedEdge[]
  blocks: PathwayBlock[]
  blockTypes: PathwayBlockType[]
  timingValues: PathwayTimingValue[]
}

// Chain slot #2 §3.3 — edges arrive as `DerivedEdge` projections
// computed server-side from each block's `input_logic`. The xyflow
// connector shape stays unchanged; per-predicate labels (delay
// duration, marker offset) are deferred until slot #4 lands
// `TimingPolicy` authoring.
export function useFlowEdges({
  edges,
  blocks,
  blockTypes,
}: Params): Edge<SmoothstepEdgeData>[] {
  const typesByCode = useMemo(() => new Map(blockTypes.map((t) => [t.type, t])), [blockTypes])
  const blocksById = useMemo(() => indexById(blocks), [blocks])

  return useMemo(
    () =>
      edges.map((edge) => {
        const source = edge.source_block_id
        const sourceBlock = source ? (blocksById.get(source) ?? null) : null
        const sourceType = sourceBlock ? typesByCode.get(legacyBlockType(sourceBlock)) : undefined
        const isBranch = !!sourceType?.supports_branches
        const isDecisionOutput = edge.predicate === 'decision_output'
        const shape = EDGE_SHAPE[isDecisionOutput ? 'branch' : isBranch ? 'fallback' : 'plain']
        const id = `${source ?? 'marker'}->${edge.target_block_id}:${edge.predicate}`
        return {
          id,
          source: source ?? '',
          target: edge.target_block_id,
          sourceHandle: shape.sourceHandle,
          targetHandle: HANDLE_IDS.target,
          type: 'smoothstep',
          data: {
            variant: shape.variant,
            label: null,
          },
          selected: false,
          selectable: false,
        }
      }),
    [edges, typesByCode, blocksById],
  )
}
