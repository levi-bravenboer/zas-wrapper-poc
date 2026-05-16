import type { PathwayLane } from './types'

export const CANVAS_LEFT_PAD = 96
export const PHASE_COL_WIDTH = 380
export const PHASE_HEADER_HEIGHT = 36
export const LANE_TOP_PAD = PHASE_HEADER_HEIGHT + 12
export const LANE_ROW_HEIGHT = 180
export const BLOCK_WIDTH = 240
export const BLOCK_HEIGHT = 64

export function phaseColumnX(index: number): number {
  return CANVAS_LEFT_PAD + index * PHASE_COL_WIDTH
}

export function laneRowY(index: number): number {
  return LANE_TOP_PAD + index * LANE_ROW_HEIGHT
}

export function canvasInnerWidth(phaseCount: number): number {
  return CANVAS_LEFT_PAD + Math.max(phaseCount, 1) * PHASE_COL_WIDTH
}

export function canvasInnerHeight(laneCount: number): number {
  return LANE_TOP_PAD + Math.max(laneCount, 1) * LANE_ROW_HEIGHT
}

const LANE_KIND_TO_ACCENT: Record<string, string> = {
  patient: 'var(--lane-patient)',
  caregiver: 'var(--lane-caregiver)',
  system: 'var(--lane-system)',
  external: 'var(--lane-external)',
}

export function laneAccent(lane: Pick<PathwayLane, 'lane_kind_code'>): string {
  return LANE_KIND_TO_ACCENT[lane.lane_kind_code] ?? 'var(--color-primary)'
}

const PHASE_TINT_VARS = [
  { soft: 'var(--ph-1-soft)', ink: 'var(--ph-1-ink)' },
  { soft: 'var(--ph-2-soft)', ink: 'var(--ph-2-ink)' },
  { soft: 'var(--ph-3-soft)', ink: 'var(--ph-3-ink)' },
  { soft: 'var(--ph-4-soft)', ink: 'var(--ph-4-ink)' },
] as const

const PHASE_TINT_FALLBACK: { soft: string; ink: string } = PHASE_TINT_VARS[0]

export function phaseTint(index: number): { soft: string; ink: string } {
  return PHASE_TINT_VARS[index % PHASE_TINT_VARS.length] ?? PHASE_TINT_FALLBACK
}
