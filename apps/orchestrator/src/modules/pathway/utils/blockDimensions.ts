import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import { LUSCII_PROGRAM_KIND, LUSCII_PROVIDER } from '../components/canvas/nodes/external/luscii'
import type {
  LusciiLayout,
  LusciiProgramData,
} from '../components/canvas/nodes/external/luscii/types'
import type { PathwayBlock, PathwayBlockType } from '../types'

export type BlockDimensions = { width: number; height: number }

const NATIVE_DIMENSIONS: BlockDimensions = { width: BLOCK_WIDTH, height: BLOCK_HEIGHT }

// Start blocks render as a circle (no subtitle, no entry handle). The
// smaller footprint keeps the visual marker compact at the head of a
// pathway — the layout pass keeps the next column at BLOCK_WIDTH +
// gutter away, so downstream blocks line up unchanged.
const START_DIMENSIONS: BlockDimensions = { width: BLOCK_HEIGHT, height: BLOCK_HEIGHT }

// EndPathway blocks mirror Start: a compact circular marker for the
// pathway's terminal node(s).
const END_DIMENSIONS: BlockDimensions = { width: BLOCK_HEIGHT, height: BLOCK_HEIGHT }

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

// Worst-case footprint used when the geometry hook needs to reserve space
// for a Luscii block *before* its program payload resolves. Sizing the lane
// for the maximum (rather than the minimum) guarantees the rendered block
// never overflows its lane during the fetch → render → resize window.
const LUSCII_MAX_DIMENSIONS: BlockDimensions = {
  width: LUSCII_MAX_WIDTH,
  height: LUSCII_MAX_HEIGHT,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Pure clamp-rule from phase + lane counts. Extracted so tests can drive the
 * sizing math without constructing full `LusciiProgramData` fixtures.
 *
 * - `width = clamp(360, 360 + 60×max(0, p-2), 540)`
 * - `height = clamp(200, 200 + 50×max(0, l-2), 300)`
 */
export function computeLusciiProgramDimensionsFromCounts(
  phaseCount: number,
  laneCount: number,
): BlockDimensions {
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
 * Compute the Luscii block dimensions for a resolved-program payload.
 * Returns the minimum 360×200 when no program is resolved (empty state).
 *
 * Production sites pass a typed `LusciiProgramData` (or any subset carrying
 * `layout`). Tests should prefer
 * {@link computeLusciiProgramDimensionsFromCounts} for synthetic fixtures.
 */
export function computeLusciiProgramDimensions(
  resolved: LusciiProgramData | { layout?: LusciiLayout | null } | null | undefined,
): BlockDimensions {
  const layout = resolved?.layout
  if (!layout) return DEFAULT_LUSCII_DIMENSIONS
  return computeLusciiProgramDimensionsFromCounts(layout.phases.length, layout.lanes.length)
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
  if (block.kind === 'start') return START_DIMENSIONS
  if (block.kind === 'end_pathway') return END_DIMENSIONS
  if (
    blockType?.source === 'external' &&
    blockType.provider === LUSCII_PROVIDER &&
    blockType.kind === LUSCII_PROGRAM_KIND
  ) {
    // Reserve the maximum (540×300) for layout reservations since the
    // resolved program is fetched asynchronously inside the node. The node
    // itself overrides xyflow's width/height to the actual program-driven
    // size via `computeLusciiProgramDimensions`; this larger estimate just
    // keeps lane/phase auto-grow from under-allocating space pre-fetch.
    void block
    return LUSCII_MAX_DIMENSIONS
  }
  return NATIVE_DIMENSIONS
}
