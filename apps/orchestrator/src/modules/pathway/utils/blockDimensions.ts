import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import type { PathwayBlock, PathwayBlockType } from '../types'

export type BlockDimensions = { width: number; height: number }

const NATIVE_DIMENSIONS: BlockDimensions = { width: BLOCK_WIDTH, height: BLOCK_HEIGHT }

/**
 * Forward-looking shape for catalogue entries once the external-block
 * provenance fields (`source` / `provider` / `kind`) land in the backend
 * schema (`external-block-integrations` change). Until that schema widens,
 * the fields are absent — narrow via a defensive read.
 */
type ExternalProvenance = {
  source?: 'native' | 'external' | null
  provider?: string | null
  kind?: string | null
}

function readProvenance(blockType: PathwayBlockType | null): ExternalProvenance {
  // reason: PathwayBlockType is regenerated from openapi; the provenance
  // fields are added by the external-block-integrations change. Read them
  // optimistically so this helper is the extension point on day one, then
  // becomes type-safe automatically when the schema widens.
  return (blockType ?? {}) as ExternalProvenance
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
  const provenance = readProvenance(blockType)
  if (provenance.source === 'external' && provenance.provider && provenance.kind) {
    // Future: register per-provider/kind size computers here. For now no
    // external provider has shipped a real renderer — return native dims so
    // xyflow has consistent geometry until the provider's own renderer + size
    // computer lands (see external-block-integrations change).
    void block
    return NATIVE_DIMENSIONS
  }
  return NATIVE_DIMENSIONS
}
