import type { components } from '@/lib/api/schema'

export type PathwaySummary = components['schemas']['PathwaySummary']
export type PathwayChildSummary = components['schemas']['PathwayChildSummary']
export type PathwayParentReference = components['schemas']['PathwayParentReference']
export type PathwayBare = components['schemas']['PathwayBare']
export type PathwayWithVersion = components['schemas']['PathwayWithVersionResponse']
export type PathwayVersionDefinition = components['schemas']['PathwayVersionDefinition']
export type PathwayVersionSummary = components['schemas']['PathwayVersionSummary']
export type PathwayPublishRequest = components['schemas']['PathwayPublishRequest']
export type PathwayCreate = components['schemas']['PathwayCreate']
export type PathwayDefinitionReplace = components['schemas']['PathwayDefinitionReplace']
export type PathwayDuplicateRequest = components['schemas']['PathwayDuplicateRequest']
export type PathwayBlockType = components['schemas']['PathwayBlockType']
export type PathwayPhaseTemplate = components['schemas']['PathwayPhaseTemplate']
export type PathwayEdgeTimingKind = components['schemas']['PathwayEdgeTimingKind']
export type PathwayEdgeOffsetDirection = components['schemas']['PathwayEdgeOffsetDirection']
export type BlockSemantics = PathwayBlockType['semantics']
export type EdgeTimingKindCode = PathwayEdgeTimingKind['kind']
export type PathwayTimingValue = components['schemas']['PathwayTimingValueOut']
// `PathwayVersionDefinition.blocks` carries the typed discriminated
// union from `pathway-model-foundations` §4.1. Each member exposes the
// chain-slot-#1 envelope compat fields (`type`, `label`, `config`) so
// existing builder UI keeps reading them while migrating onto the typed
// per-kind fields.
export type PathwayBlock = NonNullable<PathwayVersionDefinition['blocks']>[number]
export type PathwayBlockKind = PathwayBlock['kind']

// `timing_policy` discriminated union; `null` when the kind forbids
// timing or no policy is picked yet.
export type TimingPolicyValue = PathwayBlock['timing_policy'] | null

export type BlockDialogMode = 'add' | 'edit'

// Legacy `pathway_block.type` discriminator code, derived from the
// typed `kind` discriminator. Matches the backend resolver's
// `_LEGACY_TYPE_ALIASES` mapping in reverse — the only kind whose
// legacy string differs is `external_program` (was `luscii.program`
// on the wire).
export function legacyBlockType(block: PathwayBlock): string {
  return block.kind === 'external_program' ? 'luscii.program' : block.kind
}

// Read the display label off the typed envelope. Slot #2 §6 stored
// `BaseBlock.name` directly on the wire — the slot-#1 `label`
// compat field is retired.
export function blockLabel(block: PathwayBlock): string {
  return block.name
}

// Per-kind config bag synthesised from the typed envelope so existing
// inspectors keep working without rewiring against the typed fields.
// The returned object excludes the row-level identity / placement
// fields + the `kind` discriminator; inspectors edit it just as they
// did the slot-#1 `config` JSONB.
const _ENVELOPE_KEYS = new Set([
  'id',
  'phase_id',
  'lane_id',
  'duration_value_id',
  'x',
  'y',
  'kind',
  'name',
  'lane_kind',
  'input_logic',
  'timing_policy',
])

export function legacyBlockConfig(block: PathwayBlock): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(block)) {
    if (_ENVELOPE_KEYS.has(key)) continue
    out[key] = value
  }
  return out
}
// Chain slot #2 §3 replaces the authored `pathway_edge` table with
// `input_logic` rules per block; the canvas reads the connector layer
// off the `DerivedEdge` projection the server computes on read. The
// `PathwayEdge` alias keeps its name so existing import sites land on
// the new shape without churning every file in this commit.
export type PathwayEdge = components['schemas']['DerivedEdge']
export type DerivedEdge = components['schemas']['DerivedEdge']
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

// `BlockConfig` is the slot #1 wire compat bag — `Record<string, unknown>`
// is wider than the typed per-kind shape, but inspectors continue to
// edit it through Zod schemas until slot #2 swaps them onto the typed
// envelope fields directly.
export type BlockConfig = Record<string, unknown>
export type BlockConfigSchema = NonNullable<PathwayBlockType['config_schema']>

// `EdgeTiming` and `readEdgeTiming` were retired alongside the
// `pathway_edge` table in chain slot #2 §3. Edge timing
// (delay / marker / branch) is now expressed as `input_logic`
// rule args on the target block; the canvas reads the predicate
// directly off `DerivedEdge.predicate` + `args` and lets the rule
// inspector author the typed shape. Slot #4 lifts ISO-duration
// authoring (`TimingPolicy`) onto the block itself.
