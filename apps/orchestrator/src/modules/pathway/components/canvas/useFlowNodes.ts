import { useMemo } from 'react'

import { indexById } from '@/lib/utils/indexBy'

import { BLOCK_HEIGHT, BLOCK_WIDTH, blockOrigin, type CanvasGeometry } from '../../canvasLayout'
import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayEdge,
  PathwayLane,
  PathwayTimingValue,
} from '../../types'
import type { BuilderSelection } from '../../useBuilderState'

import type { BlockFlowNode } from './nodes/BlockNode'

type Params = {
  blocks: PathwayBlock[]
  lanes: PathwayLane[]
  blockTypes: PathwayBlockType[]
  timingValues: PathwayTimingValue[]
  edges: PathwayEdge[]
  geometry: CanvasGeometry
  selection: BuilderSelection
}

export function useFlowNodes({
  blocks,
  lanes,
  blockTypes,
  timingValues,
  edges,
  geometry,
  selection,
}: Params): BlockFlowNode[] {
  const lanesById = useMemo(() => indexById(lanes), [lanes])
  const typesByCode = useMemo(() => new Map(blockTypes.map((t) => [t.type, t])), [blockTypes])
  const timingById = useMemo(() => indexById(timingValues), [timingValues])
  const incomingByTarget = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of edges) m.set(e.target_block_id, (m.get(e.target_block_id) ?? 0) + 1)
    return m
  }, [edges])

  return useMemo(
    () =>
      blocks.map((block) => ({
        id: block.id,
        type: 'block',
        position: blockOrigin(block, geometry),
        data: {
          block,
          blockType: typesByCode.get(block.type) ?? null,
          lane: lanesById.get(block.lane_id) ?? null,
          duration: block.duration_value_id
            ? (timingById.get(block.duration_value_id) ?? null)
            : null,
          isEntry: (incomingByTarget.get(block.id) ?? 0) === 0,
        },
        selected: selection.kind === 'block' && selection.blockId === block.id,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
      })),
    [blocks, geometry, lanesById, typesByCode, timingById, incomingByTarget, selection],
  )
}
