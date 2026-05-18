import type { components } from '@/lib/api/schema'

export type PathwaySummary = components['schemas']['PathwaySummary']
export type PathwayBare = components['schemas']['PathwayBare']
export type PathwayWithVersion = components['schemas']['PathwayWithVersionResponse']
export type PathwayVersionDefinition = components['schemas']['PathwayVersionDefinition']
export type PathwayVersionSummary = components['schemas']['PathwayVersionSummary']
export type PathwayPublishRequest = components['schemas']['PathwayPublishRequest']
export type PathwayCreate = components['schemas']['PathwayCreate']
export type PathwayDefinitionReplace = components['schemas']['PathwayDefinitionReplace']
export type PathwayBlockType = components['schemas']['PathwayBlockType']
export type PathwayPhaseTemplate = components['schemas']['PathwayPhaseTemplate']
export type PathwayEdgeTimingKind = components['schemas']['PathwayEdgeTimingKind']
export type PathwayEdgeOffsetDirection = components['schemas']['PathwayEdgeOffsetDirection']
export type BlockSemantics = PathwayBlockType['semantics']
export type EdgeTimingKindCode = PathwayEdgeTimingKind['kind']
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

export type EdgeTiming =
  | { kind: 'completion'; delay_value_id: string }
  | {
      kind: 'marker'
      time_marker_id: string
      offset_value_id: string
      offset_direction_code: string
    }
  | { kind: 'immediate' }
  | { kind: 'branch'; source_branch_id: string }

export function readEdgeTiming(edge: PathwayEdge): EdgeTiming {
  if (edge.time_marker_id && edge.offset_value_id && edge.offset_direction_code) {
    return {
      kind: 'marker',
      time_marker_id: edge.time_marker_id,
      offset_value_id: edge.offset_value_id,
      offset_direction_code: edge.offset_direction_code,
    }
  }
  if (edge.source_branch_id) return { kind: 'branch', source_branch_id: edge.source_branch_id }
  if (edge.delay_value_id) return { kind: 'completion', delay_value_id: edge.delay_value_id }
  return { kind: 'immediate' }
}
