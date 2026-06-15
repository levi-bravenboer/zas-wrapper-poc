import type { PathwayBlock, PathwayLane, PathwayPhase } from './types'

export const CANVAS_LEFT_PAD = 96
export const PHASE_COL_WIDTH = 380
// Min must keep a native 240px block fully inside its phase (no
// half-overlap into the neighbour). 240 + 2 × 32 cell-pad = 304.
export const PHASE_COL_MIN_WIDTH = 304
export const PHASE_HEADER_HEIGHT = 36
export const LANE_TOP_PAD = PHASE_HEADER_HEIGHT + 12
// Bumped from 180 → 320 to accommodate variable-size external-provider
// blocks (Luscii's program block can grow up to 540×300 — see
// `openspec/changes/external-block-integrations/design.md`). Native 240×64
// blocks are unaffected functionally; lanes simply carry more vertical
// breathing room. Author-resizable lane heights still apply on top.
export const LANE_ROW_HEIGHT = 320
// Min must keep a native 64px block fully inside its lane.
// 64 + 2 × 28 cell-pad = 120.
export const LANE_ROW_MIN_HEIGHT = 120
export const LANE_INSET = 58
export const BLOCK_WIDTH = 240
export const BLOCK_HEIGHT = 64
export const BLOCK_DEFAULT_X = 70

/**
 * Default y-offset (relative to lane top) for a block of `blockHeight` inside
 * a lane of `laneHeight`. Generalises the historic `LANE_INSET - BLOCK_HEIGHT/2`
 * formula so variable-size blocks (external-provider blocks like Luscii) place
 * sensibly without overflowing the lane top.
 *
 * Native 240×64 blocks in the 180-tall default lane return the historic 26 —
 * unchanged behaviour. Taller blocks clamp to `0` (lane top) so they never
 * float above the lane band.
 */
export function laneInset(blockHeight: number, laneHeight: number): number {
  const referenceOffset = LANE_INSET - blockHeight / 2
  const maxInset = Math.max(0, laneHeight - blockHeight)
  return Math.round(Math.max(0, Math.min(maxInset, referenceOffset)))
}

export type CanvasGeometry = {
  phaseX: (phaseId: string) => number
  phaseW: (phaseId: string) => number
  laneY: (laneId: string) => number
  laneH: (laneId: string) => number
  flowWidth: number
  flowHeight: number
}

/** Extra breathing room kept between a block's far edge and the cell border
 * when auto-growing a phase column or lane row to contain its contents. */
export const CELL_FIT_PADDING = 28

export type BlockFitInput = Pick<PathwayBlock, 'phase_id' | 'lane_id' | 'x' | 'y'> & {
  width: number
  height: number
}

/** Compute the max (x + width) per phase + max (y + height) per lane. Callers
 * supply per-block dimensions (variable-size blocks like Luscii) so the
 * fit-grow is correct for every block type. */
function aggregateBlockFits(blocks: BlockFitInput[]): {
  perPhase: Map<string, number>
  perLane: Map<string, number>
} {
  const perPhase = new Map<string, number>()
  const perLane = new Map<string, number>()
  for (const b of blocks) {
    const needW = b.x + b.width + CELL_FIT_PADDING
    const needH = b.y + b.height + CELL_FIT_PADDING
    if (needW > (perPhase.get(b.phase_id) ?? 0)) perPhase.set(b.phase_id, needW)
    if (needH > (perLane.get(b.lane_id) ?? 0)) perLane.set(b.lane_id, needH)
  }
  return { perPhase, perLane }
}

export function buildCanvasGeometry(
  phases: PathwayPhase[],
  lanes: PathwayLane[],
  blocks: BlockFitInput[] = [],
): CanvasGeometry {
  const { perPhase, perLane } = aggregateBlockFits(blocks)
  const phaseEntries: Array<{ id: string; x: number; w: number }> = []
  const phasesByOrd = phases.toSorted((a, b) => a.ord - b.ord)
  let cursorX = CANVAS_LEFT_PAD
  for (const p of phasesByOrd) {
    const declared = Math.max(PHASE_COL_MIN_WIDTH, p.width_px ?? PHASE_COL_WIDTH)
    const w = Math.max(declared, perPhase.get(p.id) ?? 0)
    phaseEntries.push({ id: p.id, x: cursorX, w })
    cursorX += w
  }
  const flowWidth = Math.max(CANVAS_LEFT_PAD + PHASE_COL_WIDTH, cursorX)

  const laneEntries: Array<{ id: string; y: number; h: number }> = []
  const lanesByOrd = lanes.toSorted((a, b) => a.ord - b.ord)
  let cursorY = LANE_TOP_PAD
  for (const l of lanesByOrd) {
    const declared = Math.max(LANE_ROW_MIN_HEIGHT, l.height_px ?? LANE_ROW_HEIGHT)
    const h = Math.max(declared, perLane.get(l.id) ?? 0)
    laneEntries.push({ id: l.id, y: cursorY, h })
    cursorY += h
  }
  const flowHeight = Math.max(LANE_TOP_PAD + LANE_ROW_HEIGHT, cursorY)

  const phaseMap = new Map(phaseEntries.map((e) => [e.id, e]))
  const laneMap = new Map(laneEntries.map((e) => [e.id, e]))

  return {
    phaseX: (id) => phaseMap.get(id)?.x ?? CANVAS_LEFT_PAD,
    phaseW: (id) => phaseMap.get(id)?.w ?? PHASE_COL_WIDTH,
    laneY: (id) => laneMap.get(id)?.y ?? LANE_TOP_PAD,
    laneH: (id) => laneMap.get(id)?.h ?? LANE_ROW_HEIGHT,
    flowWidth,
    flowHeight,
  }
}

export function blockOrigin(
  block: Pick<PathwayBlock, 'phase_id' | 'lane_id' | 'x' | 'y'>,
  geometry: CanvasGeometry,
  dimensions?: { width: number; height: number },
): { x: number; y: number } {
  const blockHeight = dimensions?.height ?? BLOCK_HEIGHT
  const defaultY = laneInset(blockHeight, geometry.laneH(block.lane_id))
  return {
    x: geometry.phaseX(block.phase_id) + (block.x || BLOCK_DEFAULT_X),
    y: geometry.laneY(block.lane_id) + (block.y || defaultY),
  }
}

export { laneAccent, phaseTint } from './constants/theme'
