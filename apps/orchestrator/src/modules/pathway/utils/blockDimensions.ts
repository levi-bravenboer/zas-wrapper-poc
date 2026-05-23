import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import type { PathwayBlock, PathwayBlockType } from '../types'

export type BlockDimensions = { width: number; height: number }

const NATIVE_DIMENSIONS: BlockDimensions = { width: BLOCK_WIDTH, height: BLOCK_HEIGHT }

// ---- Luscii Program size computer ----------------------------------------
// Auto-scales the Luscii block based on the resolved program's layout density
// (phases × lanes). Range 360×200 → 540×300. See
// `openspec/changes/external-block-integrations/design.md` §"Luscii block
// visualization: fake-now, data-driven-later".

const LUSCII_MIN_WIDTH = 360
const LUSCII_MAX_WIDTH = 540
const LUSCII_MIN_HEIGHT = 200
const LUSCII_MAX_HEIGHT = 300
const LUSCII_WIDTH_PER_EXTRA_PHASE = 60
const LUSCII_HEIGHT_PER_EXTRA_LANE = 50

const DEFAULT_LUSCII_DIMENSIONS: BlockDimensions = {
  width: LUSCII_MIN_WIDTH,
  height: LUSCII_MIN_HEIGHT,
}

type LusciiLayoutShape = {
  phases?: ReadonlyArray<unknown> | null
  lanes?: ReadonlyArray<unknown> | null
} | null

type LusciiResolvedShape = {
  layout?: LusciiLayoutShape
} | null | undefined

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function computeLusciiProgramDimensions(
  resolved: LusciiResolvedShape,
): BlockDimensions {
  // No resolved program yet (empty state) → minimum size with the
  // "Pick a Luscii program" CTA.
  const layout = resolved?.layout
  if (!layout) return DEFAULT_LUSCII_DIMENSIONS
  const phaseCount = layout.phases?.length ?? 0
  const laneCount = layout.lanes?.length ?? 0
  return {
    width: clamp(
      LUSCII_MIN_WIDTH + LUSCII_WIDTH_PER_EXTRA_PHASE * Math.max(0, phaseCount - 2),
      LUSCII_MIN_WIDTH,
      LUSCII_MAX_WIDTH,
    ),
    height: clamp(
      LUSCII_MIN_HEIGHT + LUSCII_HEIGHT_PER_EXTRA_LANE * Math.max(0, laneCount - 2),
      LUSCII_MIN_HEIGHT,
      LUSCII_MAX_HEIGHT,
    ),
  }
}

/**
 * Rendered footprint of a block on the builder canvas.
 *
 * Native blocks always use the shared {@link BLOCK_WIDTH} × {@link BLOCK_HEIGHT}
 * constants (240×64). External-provider blocks can override here when their
 * size differs (e.g. Luscii's program block auto-sizes from its resolved
 * layout density inside the 360×200 → 540×300 range).
 *
 * Consumed by:
 * - `useFlowNodes` — sets xyflow node `width` / `height` per block
 * - `blockOrigin` — vertically centers the block inside its lane via `laneInset`
 *
 * Keep this the single source of truth for per-block geometry. Do not read
 * {@link BLOCK_WIDTH} / {@link BLOCK_HEIGHT} directly from new sites — extend
 * this dispatcher instead so future providers (HiX, registries) plug in here.
 */
export function getBlockDimensions(
  block: PathwayBlock,
  blockType: PathwayBlockType | null,
): BlockDimensions {
  if (blockType?.source === 'external' && blockType.provider === 'luscii' && blockType.kind === 'program') {
    // Without a resolved program payload in this signature, fall back to
    // the minimum size. `LusciiProgramBlockNode` itself computes the real
    // dimensions from the resolved program data via
    // `computeLusciiProgramDimensions` and sets xyflow's node size override.
    void block
    return DEFAULT_LUSCII_DIMENSIONS
  }
  return NATIVE_DIMENSIONS
}
