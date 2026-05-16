import { isLaneKindCode, type LaneKindCode, type PathwayLane } from '../types'

export const LANE_KIND_COLORS = {
  patient: 'var(--lane-patient)',
  caregiver: 'var(--lane-caregiver)',
  system: 'var(--lane-system)',
  external: 'var(--lane-external)',
} as const satisfies Record<LaneKindCode, string>

export function laneAccent(lane: Pick<PathwayLane, 'lane_kind_code'>): string {
  return isLaneKindCode(lane.lane_kind_code)
    ? LANE_KIND_COLORS[lane.lane_kind_code]
    : 'var(--color-primary)'
}

export const PHASE_TINT_VARS = [
  { soft: 'var(--ph-1-soft)', ink: 'var(--ph-1-ink)' },
  { soft: 'var(--ph-2-soft)', ink: 'var(--ph-2-ink)' },
  { soft: 'var(--ph-3-soft)', ink: 'var(--ph-3-ink)' },
  { soft: 'var(--ph-4-soft)', ink: 'var(--ph-4-ink)' },
] as const satisfies ReadonlyArray<{ soft: string; ink: string }>

type PhaseTint = (typeof PHASE_TINT_VARS)[number]

export function phaseTint(index: number): PhaseTint {
  return PHASE_TINT_VARS[index % PHASE_TINT_VARS.length] ?? PHASE_TINT_VARS[0]
}
