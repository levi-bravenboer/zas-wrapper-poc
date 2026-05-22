## 0. Pathway-builder abstraction prep (lands BEFORE any Luscii code)

The existing pathway builder hardcodes `BLOCK_WIDTH=240` / `BLOCK_HEIGHT=64` in three places (`useFlowNodes.ts`, `canvasLayout.ts` `BLOCK_DEFAULT_Y` / `LANE_INSET`, `useBlockNodeStyles.ts`). Variable-size blocks (Luscii's 360×200 → 540×300) can't land cleanly without abstracting this first. Land the abstraction as its own small commit so the Luscii work plugs in without parallel constants. See `builder-abstraction-audit.md` for the full analysis.

- [x] 0.1 Add `apps/orchestrator/src/modules/pathway/utils/blockDimensions.ts` exporting `getBlockDimensions(block, blockType): { width, height }`. Returns `{ BLOCK_WIDTH, BLOCK_HEIGHT }` for all current native blocks (no behaviour change). External-provider blocks (later — Luscii) plug their own size computer in here.
- [x] 0.2 Refactor `useFlowNodes.ts` (lines 61-62) to read width/height from `getBlockDimensions(block, blockType)` instead of the bare `BLOCK_WIDTH`/`BLOCK_HEIGHT` constants. Existing snapshot tests continue passing (size unchanged for native blocks).
- [x] 0.3 Add `laneInset(blockHeight, laneHeight)` function in `canvasLayout.ts` that returns the y-offset for a block of given height inside a lane. Update `blockOrigin` to accept optional `dimensions` and compute the default y via `laneInset`. Native 240×64 placement unchanged (still y=26 in 180-tall lane).
- [x] 0.4 Vitest: regression coverage that for a native 240×64 block, `blockOrigin` returns the same y as today (`canvasLayout.test.ts`, `blockDimensions.test.ts` — 11 tests passing).
- [ ] 0.5 Document `getBlockDimensions` extension point in `apps/orchestrator/AGENTS.md` §canvas (or similar) so the next provider knows where to register their size computer.

## 1. Backend foundation

- [ ] 1.1 Add `BlockTypeCode` value object in `apps/backend/app/pathways/block_type_code.py` parsing bare and dotted codes; unit tests covering bare/dotted/invalid forms
- [ ] 1.2 Replace ad-hoc string handling of `pathway_block.type` across pathway services/routes with `BlockTypeCode`
- [ ] 1.3 Alembic migration: create `external_block_provider` table (code PK, label, status, capabilities_json, timestamps), widen `pathway_block.type` CHECK to `^[a-z_]+(\.[a-z_]+)?$`
- [ ] 1.4 Alembic migration: seed `luscii` provider row with a single `program` capability — `semantics`, `icon='activity'`, `ui_schema`, `allowed_lane_kind_codes=['external']`, and **author-time** `config_schema` (program_id, protocol_id, mode). No per-patient fields, no patient_identifier_system (org-level), no version_pin (implicit in program_id).
- [ ] 1.5 Alembic migration: create `luscii_program` table (`id TEXT PRIMARY KEY`, `data JSONB NOT NULL`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`). No other columns — single jsonb payload per program.
- [ ] 1.6 SQLAlchemy model + Pydantic `LusciiProgramData` schema in `apps/backend/app/adapters/luscii/program.py` mirroring the shape in design.md (top-level metadata, protocols[], instruments[], alert_thresholds[], care_network, layout{phases, lanes, nodes, edges}).
- [ ] 1.7 Alembic data migration (or moon seed extension): insert 4 synthetic programs into `luscii_program`:
  - `luscii-hartfalen-monitoring-v4` — Hartfalen thuismonitoring, 12w, 3 protocols, 4 instruments, ~7 nodes
  - `luscii-copd-self-management-v2` — COPD self-management, 16w, 2 protocols, 3 instruments, ~5 nodes
  - `luscii-diabetes-coaching-v6` — Diabetes type 2 coaching, 24w, 2 protocols, 4 instruments, ~9 nodes
  - `luscii-rugrevalidatie-monitoring-v0` — Rugrevalidatie monitoring (pilot), 8w, 1 protocol, 4 instruments, ~6 nodes
  - All synthetic — no real patient data, no real Luscii ids. Each row's `data` validates against `LusciiProgramData`.
- [ ] 1.8 Add `moon run backend:seed-luscii` task in `apps/backend/moon.yml` that re-runs the Luscii seed idempotently (`INSERT … ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`).

## 2. Registry + catalogue API

- [ ] 2.1 SQLAlchemy model + Pydantic schema for `ExternalBlockProvider`
- [ ] 2.2 `app/pathways/external_blocks/registry.py`: load enabled providers + capabilities, in-memory cache invalidated via realtime topic `external_block_provider`
- [ ] 2.2a Publish realtime invalidation on topic `external_block_provider` whenever a row is INSERT/UPDATE/DELETE in `external_block_provider`. Use the existing realtime channel pattern.
- [ ] 2.2b Publish realtime invalidation on topic `luscii_program` whenever a row is INSERT/UPDATE/DELETE in `luscii_program` (covers both the migration seed re-run via `moon run backend:seed-luscii` and future live-adapter upserts).
- [ ] 2.3 Registry startup check: reject providers whose `config_schema` declares fields matching per-patient patterns (`patient_*`, `target_*`, `dose*`, `*_per_patient`). Raises `ProviderConfigSchemaScopeError` and excludes the provider from the served list.
- [ ] 2.4 Route `GET /external-block-providers` returns the registry rows
- [ ] 2.5 Extend `GET /pathway-block-types` to merge native + enabled external entries; add `source`, `provider`, `kind` to the response schema
- [ ] 2.6 Validation: `(provider, kind)` lookup against registry when persisting blocks; `BlockLaneNotAllowedError` for kinds with mismatched lane (e.g. `luscii.program` outside `external` lane)

## 3. External block adapter Protocol

- [ ] 3.1 Define `ExternalBlockClient` Protocol + `ExternalBlockOption` / `ExternalBlockResolution` dataclasses in `app/adapters/external_blocks.py`. Docstring asserts `get_block_schema` returns author-time fields only.
- [ ] 3.2 Factory `get_external_block_client(provider_code, settings)` dispatching by code; raise `ExternalProviderNotRegisteredError` on miss. **Internally calls `get_luscii_client(...)` from `app/adapters/deps.py` for the `luscii` provider** — do not duplicate the client construction.
- [ ] 3.3 Extend the existing `LusciiStubClient` class in `apps/backend/app/adapters/luscii/stub.py` to implement `ExternalBlockClient` (alongside `LusciiClient`'s `ping()`). New methods query the `luscii_program` table. Supports only `kind='program'`; other kinds raise `UnknownLusciiKindError`. **Do NOT create a parallel "Luscii block client" class** — one client per vendor, multiple capability slices.
- [ ] 3.3a Extend the existing `LusciiClient` Protocol at `apps/backend/app/adapters/luscii/protocol.py` to also include the block-shaped methods (or have a single Luscii class implement both Protocols). Same constraint: one Protocol surface per vendor.
- [ ] 3.4 Live mode: factory raises `NotImplementedError` naming the future live-client change

## 4. Instance schema + options endpoints

- [ ] 4.1 Route `GET /external-block-providers/{provider}/kinds/{kind}/schema` delegates to `client.get_block_schema`
- [ ] 4.2 Route `GET /external-block-providers/{provider}/kinds/{kind}/options` delegates to `client.list_blocks`
- [ ] 4.3 Route-level tests: schema returns author-time JSON Schema (no per-patient fields), options return fixture programs in stub mode, unknown provider/kind returns 404

## 5. OpenAPI + frontend types

- [ ] 5.1 `moon run backend:openapi` updates `apps/backend/openapi.json`
- [ ] 5.2 `moon run orchestrator:typegen` regenerates TS types
- [ ] 5.3 Verify generated `PathwayBlockType` carries the new `source`/`provider`/`kind` fields
- [ ] 5.4 Expose `LusciiProgramData` as the response model of the `resolve_block` endpoint (`GET /external-block-providers/luscii/kinds/program/resolve/{ref}` or wrap inside the existing `ExternalBlockResolution.summary` field) so it appears in `apps/backend/openapi.json` as a named schema component.
- [ ] 5.5 Verify generated `apps/orchestrator/src/lib/api/schema.d.ts` carries `components["schemas"]["LusciiProgramData"]` (and all nested types: `LusciiProtocol`, `LusciiInstrument`, `LusciiAlertThreshold`, `LusciiLayout`, `LusciiLayoutPhase`, `LusciiLayoutLane`, `LusciiLayoutNode`, `LusciiLayoutEdge`). Run `moon run :ci` to confirm types compile across orchestrator.
- [ ] 5.6 Update `/openapi-sync` skill / slash command notes if needed so the Luscii types are documented as part of the externally-typed surface.

## 6. Orchestrator builder UI

- [ ] 6.1 Extend `apps/orchestrator/src/modules/pathway/components/dock/BuilderDock.tsx` to group catalogue entries by `source` (native vs external) then by `provider` for external entries. **Do not write a new dock component** — extend the existing one. Luscii Program drops only into the `external` lane (visual affordance on drag-over invalid lanes via the existing `LaneRow` drop-state mechanism).
- [ ] 6.1a Scaffold component directory `apps/orchestrator/src/modules/pathway/components/canvas/nodes/external/luscii/` with the **stub → live swap-ready decomposition** (see design.md "Component contract"):
  - `types.ts` — local re-exports of `LusciiProgramData` and friends from the generated OpenAPI schema
  - `LusciiProgramBlockNode.tsx` — xyflow NodeProps adapter; reads config + optional resolved-program data; computes its own width/height from the data via the clamp rule (no `size` prop); renders header + thumbnail in the computed frame
  - `LusciiProgramHeader.tsx` — title-overlay glass chip + provider corner badge + meta-overlay bottom-right; scales internal padding/typography proportionally to the computed block dimensions
  - `LusciiProgramThumbnail.tsx` — body-slot dispatcher: receives `data: LusciiProgramData | null`; renders Fake when null, Live when non-null
  - `LusciiProgramThumbnailFake.tsx` — synthetic placeholder SVG. Silhouette + labeled rendering interpolated by the computed size; small-end mirrors `prototypes/luscii-block-mini-pathway/v3.html` variant C1, large-end mirrors `prototypes/luscii-block-large/v2.html`. One component, viewport derived from data density.
  - `LusciiProgramThumbnailLive.tsx` — data-driven SVG shell; throws `NotImplementedError` this change (real impl arrives with live-Luscii-adapter change)
- [ ] 6.1b Add `BlockNodeRouter.tsx` at `apps/orchestrator/src/modules/pathway/components/canvas/nodes/`. Reads `data.block.type`; bare codes route to existing `BlockNode`, dotted codes (e.g. `luscii.program`) route to provider-specific components (`LusciiProgramBlockNode`). Replace `NODE_TYPES = { block: BlockNode }` in `BuilderCanvasFrame.tsx` with `NODE_TYPES = { block: BlockNodeRouter }`. **One xyflow type key, ever** — future providers register inside the router, not at xyflow level.
- [ ] 6.1c Register the Luscii per-provider size computer in `apps/orchestrator/src/modules/pathway/utils/blockDimensions.ts`. Implements the locked clamp rule: `width = clamp(360, 360 + 60×max(0, phase_count-2), 540)` × `height = clamp(200, 200 + 50×max(0, lane_count-2), 300)`. Falls back to 360×200 when `data` is null. No selected-state size toggle.
- [ ] 6.1d Bump `LANE_ROW_HEIGHT` in `apps/orchestrator/src/modules/pathway/canvasLayout.ts` from `180` to `320` so the maximum 540×300 Luscii block fits in any lane with margin. Update geometry tests + snapshot tests in `useFlowNodes` / `BackgroundLayers`. Author-resizable lane heights still apply on top.
- [ ] 6.1e Empty-state behaviour in `LusciiProgramBlockNode`: when `config.program_id` is null, body renders a centered CTA "Pick a Luscii program" at 360×200 (no fake nodes / edges / lane bands inside the SVG). Title overlay reads "Luscii Program · Pick one". Clicking the body dispatches the block selection + opens inspector with the program picker focused.
- [ ] 6.1f Vitest:
  - `LusciiProgramThumbnail` renders Fake when `data=null` and Live when `data` provided
  - `LusciiProgramBlockNode` preserves outer frame / header / badge across a `data=null` → `data=<fixture>` prop swap (regression guard for the stub→live transition)
  - Size computer auto-scales per the clamp rule: 2p×2l → 360×200, 4p×3l → 480×250, 6p×5l → 540×300 (clamped)
  - Empty state (`config.program_id=null`) renders at 360×200 with CTA
- [ ] 6.2 Extend `BuilderDrawer.tsx` dispatch (the per-semantics inspector switch around line 18-25 + 56-59) with a new `'external_program'` semantics branch that renders `LusciiProgramInspector.tsx`. **Do not write a new drawer component** — extend the existing one. Header chrome (icon-box, label, close button, accent) reuses what `BuilderDrawer` already provides.
- [ ] 6.2a `LusciiProgramInspector.tsx` follows the same Props shape as existing inspectors (`config`, `onChange`), uses `InspectorField` wrapper around shadcn `Select` / `Input`. Provider chip + kind label + stub badge live in the inspector header surface. **No "Manage in Luscii" link, no "Open Viewer" link** — authoring is CMD-only (irrelevant to our users) and Viewer is patient-runtime (wrong context for author inspector).
- [ ] 6.2b Inspector footer metadata strip: monospace, copy-paste-able row showing `program_id · version · protocol_id` (e.g. `luscii-hartfalen-monitoring-v4 · v4.2 · proto-std-12w`). Used for support tickets / cross-referencing with Luscii admins. Include a small copy-to-clipboard button (reuse shadcn `Button` size=icon variant).
- [ ] 6.2c Extend `BlockSemantics` enum in `apps/orchestrator/src/modules/pathway/types.ts` (or wherever the enum lives) with `'external_program'`. Extend `CONFIG_SCHEMAS` in `configSchemas.ts` with an `external_program` entry (Zod schema for program_id / protocol_id / mode). The existing `safeParse` flow in `BuilderDrawer` then works unchanged.
- [ ] 6.3 Reuse existing JSON-schema form renderer for the body — no provider-specific React component
- [ ] 6.4 Options dropdown for fields whose schema declares `x-external-options: { kind: 'program' }` fetches `/external-block-providers/{provider}/kinds/{kind}/options`
- [ ] 6.4a TanStack Query keys at `apps/orchestrator/src/modules/external-blocks/keys.ts` (`externalBlockKeys = { ... }`). **First element of every key matches the realtime resource name** so `RealtimeInvalidationProvider` auto-invalidates without custom subscription code:
  - `['external_block_provider']`, `['external_block_provider', providerCode]`
  - `['luscii_program']`, `['luscii_program', programId]`
  - No bespoke realtime listener for Luscii — the existing provider does the work via key matching.
- [ ] 6.5 Read-only "Program contents" inspector card below the form, rendering instruments + alert thresholds + care network from `resolve_block(...)` summary. Card copy explicitly notes: *"Thresholds and schedules are part of the Luscii program — change them in Luscii Builder."*

## 7. Tests + verification

- [ ] 7.1 Backend: pytest covers registry load, dotted-code validation happy/error paths, catalogue merge, adapter Protocol, instance endpoints, per-patient-field rejection at registry startup
- [ ] 7.2 Orchestrator: vitest covers palette grouping, lane-kind drop-blocking for Luscii Program (external-only), inspector header rendering, options dropdown fetch
- [ ] 7.3 Run `/verify` and quote results before marking the change apply-complete
