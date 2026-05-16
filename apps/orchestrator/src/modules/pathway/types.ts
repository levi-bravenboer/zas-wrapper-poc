import type { components } from '@/lib/api/schema'

export type PathwaySummary = components['schemas']['PathwaySummary']
export type PathwayBare = components['schemas']['PathwayBare']
export type PathwayWithVersion = components['schemas']['PathwayWithVersionResponse']
export type PathwayVersionDefinition = components['schemas']['PathwayVersionDefinition']
export type PathwayVersionSummary = components['schemas']['PathwayVersionSummary']
export type PathwayCreate = components['schemas']['PathwayCreate']
export type PathwayDefinitionReplace = components['schemas']['PathwayDefinitionReplace']
export type PathwayBlockType = components['schemas']['PathwayBlockType']
export type PathwayPhaseTemplate = components['schemas']['PathwayPhaseTemplate']
export type PathwayTimingValue = components['schemas']['PathwayTimingValueOut']
export type PathwayBlock = components['schemas']['PathwayBlockOut']
export type PathwayEdge = components['schemas']['PathwayEdgeOut']
export type PathwayPhase = components['schemas']['PathwayPhaseOut']
export type PathwayLane = components['schemas']['PathwayLaneOut']
export type PathwayBlockBranch = components['schemas']['PathwayBlockBranchOut']
export type PathwayTimeMarker = components['schemas']['PathwayTimeMarkerOut']
export type PathwayBlockDeferredField = components['schemas']['PathwayBlockDeferredFieldOut']

export type LaneKindCode = 'patient' | 'caregiver' | 'system' | 'external'

export const LANE_KIND_CODES = ['patient', 'caregiver', 'system', 'external'] as const

export function isLaneKindCode(value: string): value is LaneKindCode {
  return (LANE_KIND_CODES as readonly string[]).includes(value)
}

export type BlockConfig = NonNullable<PathwayBlock['config']>
export type BlockConfigSchema = NonNullable<PathwayBlockType['config_schema']>
