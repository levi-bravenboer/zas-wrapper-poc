import { useMemo } from 'react'

import { indexById } from '@/lib/utils/indexBy'

import { type CanvasGeometry } from '../../canvasLayout'
import type { BlockPosition } from '../../layout/computeBlockLayout'
import {
  legacyBlockType,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayEdge,
  type PathwayLane,
  type PathwayTimingValue,
} from '../../types'
import type { BuilderSelection } from '../../useBuilderState'
import { getBlockDimensions } from '../../utils/blockDimensions'

import type { BlockFlowNode } from './nodes/BlockNode'

type Params = {
  blocks: PathwayBlock[]
  lanes: PathwayLane[]
  blockTypes: PathwayBlockType[]
  timingValues: PathwayTimingValue[]
  edges: PathwayEdge[]
  geometry: CanvasGeometry
  // Pathway-completion § C3: computed per-cell positions from the
  // auto-layout pass. Authored block.x / block.y are ignored.
  layout: Map<string, BlockPosition>
  selection: BuilderSelection
  // § C2.5: hover-X delete affordance → confirm dialog in the shell.
  onRequestDelete: (blockId: string) => void
}

export function useFlowNodes({
  blocks,
  lanes,
  blockTypes,
  timingValues,
  edges,
  geometry,
  layout,
  selection,
  onRequestDelete,
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
      blocks.map((block) => {
        const blockType = typesByCode.get(legacyBlockType(block)) ?? null
        const dimensions = getBlockDimensions(block, blockType)
        const cellPos = layout.get(block.id) ?? { x: 0, y: 0 }
        return {
          id: block.id,
          type: 'block',
          position: {
            x: geometry.phaseX(block.phase_id) + cellPos.x,
            y: geometry.laneY(block.lane_id) + cellPos.y,
          },
          data: {
            block,
            blockType,
            lane: lanesById.get(block.lane_id) ?? null,
            duration: block.duration_value_id
              ? (timingById.get(block.duration_value_id) ?? null)
              : null,
            isEntry: (incomingByTarget.get(block.id) ?? 0) === 0,
            onRequestDelete,
          },
          selected: selection.kind === 'block' && selection.blockId === block.id,
          width: dimensions.width,
          height: dimensions.height,
        }
      }),
    [
      blocks,
      geometry,
      layout,
      lanesById,
      typesByCode,
      timingById,
      incomingByTarget,
      selection,
      onRequestDelete,
    ],
  )
}
