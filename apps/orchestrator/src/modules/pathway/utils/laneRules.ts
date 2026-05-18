import type { PathwayBlockType } from '../types'

export function isLaneAllowed(
  blockType: Pick<PathwayBlockType, 'allowed_lane_kind_codes'> | null | undefined,
  laneKindCode: string | null | undefined,
): boolean {
  if (!blockType || !laneKindCode) return false
  return blockType.allowed_lane_kind_codes.includes(laneKindCode)
}

export function defaultLaneKindCode(
  blockType: Pick<PathwayBlockType, 'allowed_lane_kind_codes'>,
): string | undefined {
  return blockType.allowed_lane_kind_codes[0]
}
