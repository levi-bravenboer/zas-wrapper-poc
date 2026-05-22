# Builder abstraction audit — what's clean, what leaks

Quick scan of the existing pathway builder to confirm Luscii blocks can land without forcing parallel infrastructure. Cross-checked against the worktree as of design lock.

## Verdict

**Mostly cleanly abstracted.** Catalogue + config flow is already provider-agnostic — adding `external_program` semantics is a one-line registry change in three places. Drag/drop, lane-rules, default-config, realtime publishing, block validation, type generation: all generic.

**One real leak: hardcoded native-block dimensions.** Three constants assume every block is 240×64. Adding a 360×200 → 540×300 block forces an abstraction. Fixable cleanly with a per-block size helper.

## Clean — works for Luscii with zero structural change

| Surface | Why it's clean |
|---|---|
| `CONFIG_SCHEMAS` (configSchemas.ts) | Discriminated map keyed by `BlockSemantics`. Adding `external_program: ExternalProgramConfig` is a one-line entry. `parseBlockConfig` + `defaultConfig` generic. |
| `createBlock` (utils/createBlock.ts) | Fully generic — builds default config by walking the JSON Schema from the catalogue entry. Luscii's config_schema flows through unchanged. No per-type branches. |
| `isLaneAllowed` (utils/laneRules.ts) | Generic — reads `allowed_lane_kind_codes` from catalogue. Luscii's `['external']` works without code change. |
| `BlockTypeIcon` + `resolveLucideIcon` (blockCatalogue.tsx + utils) | Backend `icon: string` resolved via `LUCIDE_BY_NAME` map. Adding `activity` icon is one entry in the lookup. |
| `LANE_KIND_ICONS` | Already includes `external` lane kind. Reuse as-is. |
| `LANE_KIND_CODES` + `isLaneKindCode` | `external` already in the enum. |
| Catalogue API → frontend types (`PathwayBlockType`) | Derived from OpenAPI schema. Adding `source` / `provider` / `kind` fields flows through automatically. |
| Edge persistence + rendering | `pathway_link` already establishes a target/mode pattern; edge rendering is type-agnostic. |
| `useBuilderState` / dispatch reducer | Block creation / update / delete is generic — operates on `PathwayBlock` shape, no per-type code. |
| Drag/drop wiring (`useCanvasHandlers`, `BuilderDock`, `DockItem`) | Generic over `PathwayBlockType`. Drops the right `block.type` string + creates via `createBlock`. |
| Autosave + flush hook (`useAutosavePathway`) | Generic JSON Schema validation server-side. New schemas land via migration. |
| Realtime event envelope (`RealtimeEvent`) | Single shape, generic. New table → new resource name → free invalidation. |

## Small touches needed (not leakage, just extension)

| Surface | Touch |
|---|---|
| `BlockSemantics` enum (backend Pydantic + frontend OpenAPI) | Add `'external_program'`. Auto-flows to FE via `/openapi-sync`. |
| `CONFIG_SCHEMAS` map | Add `external_program: ExternalProgramConfig` entry. |
| `LUCIDE_BY_NAME` (blockCatalogue.utils.ts) | Add `activity: Activity` (Luscii icon). |
| `blockSemanticsSummary` switch (blockCatalogue.utils.ts:55-74) | Add `case 'external_program'` returning a short summary (e.g. protocol id or program name). |
| `PATHWAY_LINK_MODES` constant | **Reusable** — Luscii's `mode` field uses the same `blocking | fire_and_forget` enum. Don't duplicate, import the existing constant. |
| `BuilderDrawer` inspector dispatch | Add `external_program` branch → new `LusciiProgramInspector`. |
| `BuilderDock` palette | Group by `source` / `provider`. |

All small. None require restructuring.

## Real leak — hardcoded block dimensions

Three places in the renderer assume every block is `240×64`:

### Leak 1 — `useFlowNodes.ts` (line 61-62)

```ts
width: BLOCK_WIDTH,    // 240, hardcoded for every block
height: BLOCK_HEIGHT,  // 64,  hardcoded for every block
```

xyflow uses these for collision / drag bounds. Luscii blocks (360×200 → 540×300) need their actual dimensions or xyflow misreports their footprint.

### Leak 2 — `canvasLayout.ts` (line 13-14)

```ts
export const BLOCK_DEFAULT_X = 70
export const BLOCK_DEFAULT_Y = LANE_INSET - BLOCK_HEIGHT / 2  // 58 - 32 = 26
```

`BLOCK_DEFAULT_Y` centers a 64-tall block in the lane. For Luscii's 200-tall block: `58 - 100 = -42` → block top sits above lane. Wrong.

### Leak 3 — `useBlockNodeStyles.ts` + `BlockNode.tsx`

Hardcoded `width: BLOCK_WIDTH, height: BLOCK_HEIGHT` in the inline container style for every native block. Luscii component avoids this (renders its own size), but the constants leak into the shared geometry helpers.

### Fix — introduce `getBlockDimensions(block, blockType)` helper

A small abstraction:

```ts
// apps/orchestrator/src/modules/pathway/utils/blockDimensions.ts
import { BLOCK_WIDTH, BLOCK_HEIGHT } from '../canvasLayout'

export function getBlockDimensions(
  block: PathwayBlock,
  blockType: PathwayBlockType | null,
): { width: number; height: number } {
  // External provider blocks may auto-size from their config.
  if (blockType?.source === 'external' && blockType.provider === 'luscii' && blockType.kind === 'program') {
    return computeLusciiProgramSize(block)  // 360×200 → 540×300 clamp rule
  }
  // Native default.
  return { width: BLOCK_WIDTH, height: BLOCK_HEIGHT }
}
```

Then:

- `useFlowNodes` calls `getBlockDimensions(block, type)` instead of constants.
- `blockOrigin` (in `canvasLayout.ts`) accepts a `dimensions` arg to center properly, or `BLOCK_DEFAULT_Y` becomes a function of block height.
- `useBlockNodeStyles` keeps using `BLOCK_WIDTH/HEIGHT` since it only renders native blocks (Luscii has its own component, ignores this hook).

Generic seam, no provider-specific code in the layout layer. Future external providers register their own size computer.

## Sub-leak — `LANE_INSET` assumes single block height

`LANE_INSET = 58` is the y-offset where blocks start inside their lane (assumes 64-tall block centered in 180-tall lane → 180/2 - 64/2 - margin ≈ 58). With variable block height + bigger lane (250+), this constant is no longer geometric truth.

**Fix:** replace `LANE_INSET` constant with a function `laneInset(blockHeight, laneHeight)` that centers the block in the lane. One-line change in `blockOrigin` consumers.

## Cleanup opportunities (nice-to-have, can defer)

- `LUCIDE_BY_NAME` map (blockCatalogue.utils.ts) hand-maintains the icon allow-list. As block types grow, this map grows. Could shift to dynamic `lucide-react/dynamic` import or a code-generated map. Not blocking Luscii work; flag for a follow-up `pathway-cleanup` change.
- `blockSemanticsSummary` is a long switch. Could decompose into per-semantics modules. Not blocking; same follow-up.
- `BuilderDrawer.tsx` imports every inspector statically. Same pattern: works fine until ~15 inspectors, then split. Today's 8 + Luscii = 9; no rush.

## Touch-summary for the Luscii change

To land Luscii without leaving behind a parallel system:

**Mandatory abstraction fix (one-time, benefits all future variable-size blocks):**

1. Add `getBlockDimensions(block, blockType)` helper.
2. Refactor `useFlowNodes` to use the helper.
3. Refactor `blockOrigin` to take dimensions (or replace `LANE_INSET` constant with a function).

**One-line extensions (not abstraction work, just new entries):**

4. Add `'external_program'` to `BlockSemantics` (backend enum).
5. Add `external_program: …` entry to `CONFIG_SCHEMAS`.
6. Add `activity: Activity` to `LUCIDE_BY_NAME`.
7. Add `case 'external_program':` to `blockSemanticsSummary`.
8. Add `case 'external_program':` branch to `BuilderDrawer` dispatch.
9. Group `BuilderDock` by `source` then `provider`.

That's it. No new module structure inside `pathway/` is required for Luscii. The new `external-blocks/` module is for cross-vendor concerns (keys, registry types, provider components), not a parallel pathway-engine.

## What this means for the change scope

Add to `tasks.md`:

- A "0. Pathway-builder abstraction prep" section with the `getBlockDimensions` + `LANE_INSET` work, done **first**, so the Luscii work plugs in cleanly.

Without this prep, Luscii work either hacks around the constants (fast but parallel) or pushes the abstraction in mid-implementation (slow + harder review). Best to land the abstraction as a single small commit before any Luscii code.
