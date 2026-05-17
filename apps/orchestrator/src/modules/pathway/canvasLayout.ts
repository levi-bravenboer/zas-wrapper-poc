import type { PathwayBlock, PathwayLane, PathwayPhase } from './types'

export const CANVAS_LEFT_PAD = 96
export const PHASE_COL_WIDTH = 380
export const PHASE_COL_MIN_WIDTH = 240
export const PHASE_HEADER_HEIGHT = 36
export const LANE_TOP_PAD = PHASE_HEADER_HEIGHT + 12
export const LANE_ROW_HEIGHT = 180
export const LANE_ROW_MIN_HEIGHT = 110
export const LANE_INSET = 58
export const BLOCK_WIDTH = 240
export const BLOCK_HEIGHT = 64
export const BLOCK_DEFAULT_X = 70
export const BLOCK_DEFAULT_Y = LANE_INSET - BLOCK_HEIGHT / 2

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

export type CanvasGeometry = {
  phaseX: (phaseId: string) => number
  phaseW: (phaseId: string) => number
  laneY: (laneId: string) => number
  laneH: (laneId: string) => number
  phaseIndex: (phaseId: string) => number
  laneIndex: (laneId: string) => number
  phaseAt: (flowX: number) => string | null
  laneAt: (flowY: number) => string | null
  flowWidth: number
  flowHeight: number
}

export function buildCanvasGeometry(
  phases: PathwayPhase[],
  lanes: PathwayLane[],
  phaseSizes: ReadonlyMap<string, number>,
  laneSizes: ReadonlyMap<string, number>,
): CanvasGeometry {
  const phaseEntries: Array<{ id: string; x: number; w: number; idx: number }> = []
  const phasesByOrd = [...phases].sort((a, b) => a.ord - b.ord)
  let cursorX = CANVAS_LEFT_PAD
  phasesByOrd.forEach((p, i) => {
    const w = Math.max(PHASE_COL_MIN_WIDTH, phaseSizes.get(p.id) ?? PHASE_COL_WIDTH)
    phaseEntries.push({ id: p.id, x: cursorX, w, idx: i })
    cursorX += w
  })
  const flowWidth = Math.max(CANVAS_LEFT_PAD + PHASE_COL_WIDTH, cursorX)

  const laneEntries: Array<{ id: string; y: number; h: number; idx: number }> = []
  const lanesByOrd = [...lanes].sort((a, b) => a.ord - b.ord)
  let cursorY = LANE_TOP_PAD
  lanesByOrd.forEach((l, i) => {
    const h = Math.max(LANE_ROW_MIN_HEIGHT, laneSizes.get(l.id) ?? LANE_ROW_HEIGHT)
    laneEntries.push({ id: l.id, y: cursorY, h, idx: i })
    cursorY += h
  })
  const flowHeight = Math.max(LANE_TOP_PAD + LANE_ROW_HEIGHT, cursorY)

  const phaseMap = new Map(phaseEntries.map((e) => [e.id, e]))
  const laneMap = new Map(laneEntries.map((e) => [e.id, e]))

  return {
    phaseX: (id) => phaseMap.get(id)?.x ?? CANVAS_LEFT_PAD,
    phaseW: (id) => phaseMap.get(id)?.w ?? PHASE_COL_WIDTH,
    laneY: (id) => laneMap.get(id)?.y ?? LANE_TOP_PAD,
    laneH: (id) => laneMap.get(id)?.h ?? LANE_ROW_HEIGHT,
    phaseIndex: (id) => phaseMap.get(id)?.idx ?? 0,
    laneIndex: (id) => laneMap.get(id)?.idx ?? 0,
    phaseAt: (flowX) =>
      phaseEntries.find((e) => flowX < e.x + e.w)?.id ?? phaseEntries.at(-1)?.id ?? null,
    laneAt: (flowY) =>
      laneEntries.find((e) => flowY < e.y + e.h)?.id ?? laneEntries.at(-1)?.id ?? null,
    flowWidth,
    flowHeight,
  }
}

export function blockOrigin(
  block: Pick<PathwayBlock, 'phase_id' | 'lane_id' | 'x' | 'y'>,
  geometry: CanvasGeometry,
): { x: number; y: number } {
  return {
    x: geometry.phaseX(block.phase_id) + (block.x || BLOCK_DEFAULT_X),
    y: geometry.laneY(block.lane_id) + (block.y || BLOCK_DEFAULT_Y),
  }
}

export { laneAccent, phaseTint } from './constants/theme'
