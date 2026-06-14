import { useMemo } from 'react'

import { indexById } from '@/lib/utils/indexBy'

import { type CanvasGeometry } from '../../canvasLayout'
import type { BlockPosition } from '../../layout/computeBlockLayout'
import {
  legacyBlockType,
  type PathwayBlock,
  type PathwayBlockType,
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
  geometry: CanvasGeometry
  // Pathway-completion § C3: computed per-cell positions from the
  // auto-layout pass. Authored block.x / block.y override these.
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
  geometry,
  layout,
  selection,
  onRequestDelete,
}: Params): BlockFlowNode[] {
  const lanesById = useMemo(() => indexById(lanes), [lanes])
  const typesByCode = useMemo(() => new Map(blockTypes.map((t) => [t.type, t])), [blockTypes])
  const timingById = useMemo(() => indexById(timingValues), [timingValues])

  return useMemo(
    () =>
      blocks.map((block) => {
        const blockType = typesByCode.get(legacyBlockType(block)) ?? null
        const dimensions = getBlockDimensions(block, blockType)
        // Sentinel (0, 0) = auto-layout owns this block; any other
        // value = author placed it explicitly and the round-trip
        // must keep that position stable.
        const hasManualPosition = block.x !== 0 || block.y !== 0
        const cellPos = hasManualPosition
          ? { x: block.x, y: block.y }
          : (layout.get(block.id) ?? { x: 0, y: 0 })
        const phaseLeft = geometry.phaseX(block.phase_id)
        const phaseW = geometry.phaseW(block.phase_id)
        const laneTop = geometry.laneY(block.lane_id)
        const laneH = geometry.laneH(block.lane_id)
        return {
          id: block.id,
          type: 'block',
          position: {
            x: phaseLeft + cellPos.x,
            y: laneTop + cellPos.y,
          },
          // Per-node drag extent: clamp the block inside its
          // (phase, lane) cell so the author can re-align without
          // ever escaping the lane or phase.
          extent: [
            [phaseLeft, laneTop],
            [
              Math.max(phaseLeft, phaseLeft + phaseW - dimensions.width),
              Math.max(laneTop, laneTop + laneH - dimensions.height),
            ],
          ] as [[number, number], [number, number]],
          data: {
            block,
            blockType,
            lane: lanesById.get(block.lane_id) ?? null,
            duration: block.duration_value_id
              ? (timingById.get(block.duration_value_id) ?? null)
              : null,
            onRequestDelete,
          },
          selected: selection.kind === 'block' && selection.blockId === block.id,
          width: dimensions.width,
          height: dimensions.height,
        }
      }),
    [blocks, geometry, layout, lanesById, typesByCode, timingById, selection, onRequestDelete],
  )
}
