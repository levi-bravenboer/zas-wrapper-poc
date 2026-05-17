# pathway-config-forms

## Why

`pathway-block-redesign` shipped the data model for the eight runtime block semantics (`appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`) and the four edge timing kinds (`completion`, `marker`, `immediate`, `branch`). The builder UI lags the data model in two places:

1. **Block inspector forms** — `form`, `wait`, `pathway_link` blocks render a "Geen inspector beschikbaar" placeholder in `BuilderDrawer`. Authors can drag them onto the canvas but cannot configure them.
2. **Edge inspector** — selecting an edge has no UI at all. Edges persist `delay_value_id` / `time_marker_id` / `offset_value_id` / `offset_direction_code` / `source_branch_id`, but authors cannot pick a timing kind or any of its fields.

This change closes both gaps so a pathway author can actually configure the new block types and the new edge timing. It also folds in per-semantic Zod schemas for `PathwayBlock.config`, which kills the `asString` / `asArray` runtime-narrowing shims (`BL-064`) and turns silent config divergence into a parse error at the surface.

Tier: `[poc]` — F3 Carepath builder PoC scope. Same chain slot as `pathway-block-redesign`; this is the immediate follow-up.

## What Changes

- **Block inspector (`BuilderDrawer`)**
  - Bespoke inspector components per `BlockSemantics`: `FormBlockInspector`, `WaitBlockInspector`, `PathwayLinkBlockInspector`, plus thin wrappers reusing RJSF for the already-working `appointment` / `task` / `message` / `milestone` / `decision`.
  - Inspector reads parsed config (per-semantic Zod), emits typed patches; `BuilderDrawer` no longer shows the placeholder branch.
- **Edge inspector**
  - New `EdgeInspector` component rendered in the same drawer slot when `selection.kind === 'edge'`.
  - Timing-kind picker (`completion` / `marker` / `immediate` / `branch`); per-kind sub-form pulling from `version.timing_values`, `version.time_markers`, source block's `branches`.
  - New builder action `patch-edge`; reducer updates a single edge in place, applying the "exactly one timing union" invariant by clearing the columns of the non-selected kind.
- **Per-semantic Zod schemas** (`modules/pathway/configSchemas.ts`)
  - One Zod schema per `BlockSemantics`; `parseBlockConfig(block)` returns a discriminated union keyed on `block.semantics`. Replaces `asString` / `asArray` shims in `blockCatalogue.utils.ts`.
  - Closes backlog entry `BL-064`.
- **i18n**
  - Inspector copy lives under `pathway` namespace: `inspector.form.*`, `inspector.wait.*`, `inspector.pathwayLink.*`, `inspector.edge.*`. Dutch only (consistent with rest of orchestrator).
- **Tests**
  - Vitest for each inspector (renders fields, dispatches patches, validates input).
  - Vitest for `parseBlockConfig` round-trip per semantics.
  - Vitest for `patch-edge` reducer + timing-union invariant.

## Out of scope

- **Schema-driven generic renderer reading `ui_schema`** from the catalogue. Bespoke per-semantic forms cover PoC scope and are clearer to maintain. The `ui_schema` field stays in the catalogue payload for forward-compat with `[mvp]`/`[product]` schema-driven authoring tools, but PoC does not consume it.
- **Authoring new timing values / time markers from the edge inspector.** PoC seeds a fixed roster of `PathwayTimingValueOut` rows; authoring lives in a future change.
- **Pathway-picker autocomplete over all pathways** in the tenant — PoC uses a simple combobox over `GET /pathways` summaries. No cross-tenant or paginated picker.
- **Backend changes.** No new endpoints, no migrations. Consumes the catalogue + edge-timing endpoints shipped by `pathway-block-redesign`.

## Affected files (preview)

- `apps/orchestrator/src/modules/pathway/configSchemas.ts` (new)
- `apps/orchestrator/src/modules/pathway/blockCatalogue.utils.ts` (drop `asString`/`asArray`, read parsed config)
- `apps/orchestrator/src/modules/pathway/useBuilderState.ts` (add `patch-edge` action)
- `apps/orchestrator/src/modules/pathway/components/drawer/BuilderDrawer.tsx` (route to per-semantic inspector; drop placeholder)
- `apps/orchestrator/src/modules/pathway/components/drawer/EdgeInspector.tsx` (new)
- `apps/orchestrator/src/modules/pathway/components/drawer/inspectors/*` (new — per-semantic)
- `apps/orchestrator/src/modules/pathway/components/PathwayBuilderShell.tsx` (render `EdgeInspector` when selection is an edge)
- `apps/orchestrator/src/lib/i18n/locales/nl/pathway.json` (inspector copy)
- `openspec/backlog.md` (close BL-064)
- `openspec/scope.md` (drop "placeholders pending" caveat from F3 row)
