import type { PathwayBlock } from '../types'

type CreateBlockInput = {
  typeCode: string
  phaseId: string
  laneId: string
  x: number
  y: number
}

export function createBlock({ typeCode, phaseId, laneId, x, y }: CreateBlockInput): PathwayBlock {
  return {
    id: crypto.randomUUID(),
    phase_id: phaseId,
    lane_id: laneId,
    type: typeCode,
    label: null,
    duration_value_id: null,
    config: {},
    x: Math.round(x),
    y: Math.round(y),
  }
}
