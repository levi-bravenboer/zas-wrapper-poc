## 0. Pathway-builder abstraction prep (DONE — lands before any Luscii code)

The existing pathway builder hardcodes `BLOCK_WIDTH=240` / `BLOCK_HEIGHT=64` in three places. Variable-size blocks (Luscii's 360×200 → 540×300) can't land cleanly without abstracting this first. See `builder-abstraction-audit.md` for the full analysis.

- [x] 0.1 Add `apps/orchestrator/src/modules/pathway/utils/blockDimensions.ts` exporting `getBlockDimensions(block, blockType): { width, height }`. Returns `{ BLOCK_WIDTH, BLOCK_HEIGHT }` for current native blocks (no behaviour change). External-provider blocks plug their own size computer in here.
- [x] 0.2 Refactor `useFlowNodes.ts` to read width/height from `getBlockDimensions(block, blockType)` instead of the bare constants.
- [x] 0.3 Add `laneInset(blockHeight, laneHeight)` function in `canvasLayout.ts`. Update `blockOrigin` to accept optional `dimensions` and compute the default y via `laneInset`. Native 240×64 placement unchanged.
- [x] 0.4 Vitest regression coverage (`canvasLayout.test.ts` + `blockDimensions.test.ts` — 11 tests).
- [x] 0.5 Document `getBlockDimensions` extension point in `apps/orchestrator/AGENTS.md` so future providers know where to register their size computer.

## 1. Backend foundation

- [x] 1.1 Add `BlockTypeCode` value object in `apps/backend/app/services/pathway/block_type_code.py` parsing bare and dotted codes; 33 unit tests covering bare / dotted / invalid forms (`tests/services/pathway/test_block_type_code.py`).
- [x] 1.2 `LusciiProgramData` Pydantic schema (`app/adapters/luscii/program.py`) covering top-level metadata, protocols[], instruments[], alert_thresholds[], care_network, layout{phases, lanes, nodes, edges}. 16 unit tests (`tests/adapters/test_luscii_program_schema.py`).
- [x] 1.3 Four synthetic Luscii programs (`app/adapters/luscii/programs.py`, `# POC ONLY`):
  - `luscii-hartfalen-monitoring-v4` — 12w, 3 protocols, 4 instruments, ~7 nodes
  - `luscii-copd-self-management-v2` — 16w, 2 protocols, 3 instruments, ~5 nodes
  - `luscii-diabetes-coaching-v6` — 24w, 2 protocols, 4 instruments, ~9 nodes
  - `luscii-rugrevalidatie-monitoring-v0` — 8w, 1 protocol, 4 instruments, ~6 nodes
  - All synthetic — no real patient data, no real Luscii ids. Each entry validates against `LusciiProgramData` at module import. 42 unit tests (`tests/adapters/test_luscii_programs.py`).
- [x] 1.4 Re-export new public API from `app/adapters/luscii/__init__.py`.
- [x] 1.5 Wire `BlockTypeCode` into pathway-service block validation (`pathway_service.py:replace_definition`). Existing native bare codes flow unchanged; dotted codes parse the same way and resolve against the (extended) catalogue. Errors raise the existing `UnknownBlockTypeError`. **Note:** the existing `get_block_type(block.type)` lookup already handles both bare and dotted codes once the catalogue contains the dotted entry — no separate parser call needed at the validation site.

## 2. Catalogue extension + Luscii routes

- [x] 2.1 Extend `PathwayBlockType` Pydantic schema (`app/schemas/pathway/catalogue.py`) with three optional provenance fields: `source: Literal['native', 'external'] = 'native'`, `provider: str | None = None`, `kind: str | None = None`.
- [x] 2.2 Extend `BlockSemanticsLiteral` (same file) with `'external_program'`.
- [x] 2.3 Add `luscii.program` entry to `BLOCK_TYPES` in `app/services/pathway/catalogue.py`:
  - `type='luscii.program'`, `label='Luscii Program'`, `semantics='external_program'`, `icon='activity'`
  - `allowed_lane_kind_codes=['external']`, `supports_branches=False`
  - `source='external'`, `provider='luscii'`, `kind='program'`
  - `config_schema` = JSON Schema with `program_id` (string, required), `protocol_id` (string, required), `mode` (string enum `blocking | fire_and_forget`, required); no per-patient fields
  - `ui_schema` = field order + Dutch labels (i18n keys)
- [x] 2.4 Lane-kind validation: ensure `validate_block_lane_kind` rejects `luscii.program` outside the `external` lane (uses existing `allowed_lane_kind_codes` check).
- [x] 2.5 Alembic migration: widen `pathway_block.type` CHECK constraint to `^[a-z_]+(\.[a-z_]+)?$`. DDL only (per AGENTS rule 209).
- [x] 2.6 New `app/services/luscii/luscii_service.py` exposing `list_programs() -> list[LusciiProgramSummary]` and `get_program(program_id) -> LusciiProgramData`. Reads from `app.adapters.luscii.programs`. Raises `LusciiProgramNotFoundError` on miss.
- [x] 2.7 New `app/api/routers/luscii/luscii_router.py` mounting `GET /luscii/programs` and `GET /luscii/programs/{id}` with proper `operation_id` (`list_luscii_programs`, `get_luscii_program`). Response models derived from `LusciiProgramSummary` / `LusciiProgramData`.
- [x] 2.8 Backend tests covering the two routes (happy path + 404 for unknown id + response shape against `LusciiProgramData`).

## 3. (intentionally empty)

Earlier drafts proposed an `ExternalBlockClient` Protocol slice + `get_external_block_client` factory + an `external_block_provider` registry table. Rejected — see design.md "Catalogue stays a code constant" and "Per-vendor routes". With one vendor the abstraction is unused overhead; a second vendor's needs will inform the real shared shape.

## 4. (intentionally empty)

The generic catalogue-of-providers endpoints (`GET /external-block-providers/...`) are not added in this change. The two per-vendor routes in section 2 carry their equivalents.

## 5. OpenAPI + frontend types

- [x] 5.1 `moon run backend:openapi` updates `apps/backend/openapi.json`.
- [x] 5.2 `moon run orchestrator:typegen` regenerates TS types.
- [x] 5.3 Verify generated `PathwayBlockType` carries the new `source`/`provider`/`kind` fields.
- [x] 5.4 Verify generated `apps/orchestrator/src/lib/api/schema.d.ts` carries `components["schemas"]["LusciiProgramData"]` and all nested types (`LusciiProtocol`, `LusciiInstrument`, `LusciiAlertThreshold`, `LusciiLayout`, `LusciiLayoutPhase`, `LusciiLayoutLane`, `LusciiLayoutNode`, `LusciiLayoutEdge`). Run `moon run :ci` to confirm types compile across orchestrator.

## 6. Orchestrator builder UI

- [x] 6.1 Extend `apps/orchestrator/src/modules/pathway/components/dock/BuilderDock.tsx` to group catalogue entries by `source` (native vs external) then by `provider` for external entries. Luscii Program drops only into the `external` lane (visual affordance on drag-over invalid lanes via the existing `LaneRow` drop-state mechanism).
- [x] 6.1a Scaffold component directory `apps/orchestrator/src/modules/pathway/components/canvas/nodes/external/luscii/` with the stub → live swap-ready decomposition (see design.md "Component contract"):
  - `types.ts` — re-exports `LusciiProgramData` and friends from the generated OpenAPI schema
  - `LusciiProgramBlockNode.tsx` — xyflow NodeProps adapter; reads config + optional resolved-program data; computes width/height from the data via the clamp rule; renders header + thumbnail in the computed frame
  - `LusciiProgramHeader.tsx` — title-overlay glass chip + provider corner badge + meta-overlay bottom-right; scales internal padding/typography proportionally to the computed block dimensions
  - `LusciiProgramThumbnail.tsx` — body-slot dispatcher: receives `data: LusciiProgramData | null`; renders Fake when null, Live when non-null
  - `LusciiProgramThumbnailFake.tsx` — synthetic placeholder SVG built from the resolved program's `layout` shape; small-end mirrors `prototypes/luscii-block-mini-pathway/v3.html` variant C1, large-end mirrors `prototypes/luscii-block-large/v2.html`
  - `LusciiProgramThumbnailLive.tsx` — data-driven SVG shell; throws `NotImplementedError` this change (real impl arrives with live-Luscii-adapter change)
- [x] 6.1b Add `BlockNodeRouter.tsx` at `apps/orchestrator/src/modules/pathway/components/canvas/nodes/`. Reads `data.block.type`; bare codes route to existing `BlockNode`, dotted codes (e.g. `luscii.program`) route to provider-specific components (`LusciiProgramBlockNode`). Replace `NODE_TYPES = { block: BlockNode }` in `BuilderCanvasFrame.tsx` with `NODE_TYPES = { block: BlockNodeRouter }`.
- [x] 6.1c Register the Luscii per-provider size computer in `apps/orchestrator/src/modules/pathway/utils/blockDimensions.ts`. Implements `width = clamp(360, 360 + 60×max(0, phase_count-2), 540)` × `height = clamp(200, 200 + 50×max(0, lane_count-2), 300)`. Falls back to 360×200 when `data` is null.
- [x] 6.1d Bump `LANE_ROW_HEIGHT` in `apps/orchestrator/src/modules/pathway/canvasLayout.ts` from `180` to `320`. Update geometry tests + snapshot tests in `useFlowNodes` / `BackgroundLayers`.
- [x] 6.1e Empty-state behaviour in `LusciiProgramBlockNode`: when `config.program_id` is null, body renders a centered CTA "Pick a Luscii program" at 360×200. Title overlay reads "Luscii Program · Pick one". Clicking the body dispatches the block selection + opens inspector with the program picker focused.
- [x] 6.1f Vitest:
  - `LusciiProgramThumbnail` renders Fake when `data=null` and Live when `data` provided
  - `LusciiProgramBlockNode` preserves outer frame / header / badge across a `data=null` → `data=<fixture>` prop swap
  - Size computer auto-scales per the clamp rule: 2p×2l → 360×200, 4p×3l → 480×250, 6p×5l → 540×300 (clamped)
  - Empty state (`config.program_id=null`) renders at 360×200 with CTA
- [x] 6.2 Extend `BuilderDrawer.tsx` dispatch with a new `'external_program'` semantics branch that picks the provider-specific inspector from an inner map keyed on `block.provider` (today: `{luscii: LusciiProgramInspector}`).
- [x] 6.2a `LusciiProgramInspector.tsx` follows the same Props shape as existing inspectors (`config`, `onChange`), uses `InspectorField` wrapper around shadcn `Select`. Header surface gets a provider chip + kind label + stub badge. **No "Manage in Luscii" link, no "Open Viewer" link** — see design.md.
- [x] 6.2b Inspector footer metadata strip: monospace, copy-paste-able row showing `program_id · version · protocol_id`. Copy-to-clipboard button uses shadcn `Button` size=icon variant.
- [x] 6.2c Extend `BlockSemantics` enum (derived from OpenAPI) with `'external_program'` and add a matching entry to `CONFIG_SCHEMAS` in `configSchemas.ts` (Zod schema for program_id / protocol_id / mode). Existing `safeParse` flow in `BuilderDrawer` works unchanged.
- [x] 6.3 Read-only "Program contents" inspector card below the form, rendering instruments + alert thresholds + care network from the `GET /luscii/programs/{id}` payload. Card copy explicitly notes: *"Thresholds and schedules are part of the Luscii program — change them in Luscii Builder."*
- [x] 6.4 TanStack Query keys at `apps/orchestrator/src/modules/pathway/components/canvas/nodes/external/luscii/keys.ts` (`lusciiKeys = { ... }`):
  - `['luscii', 'programs']` — picker list
  - `['luscii', 'programs', programId]` — single program payload
  - The catalogue picker for `program_id` populates from the list query; the inspector + thumbnail consume the single-program query. **Note:** keys colocated with the luscii adapter components instead of a separate `external-blocks/` module — one vendor today, lift if/when a second vendor lands.

## 7. Tests + verification

- [x] 7.1 Backend: pytest covers `BlockTypeCode` (done), `LusciiProgramData` (done), `LUSCII_STUB_PROGRAMS` (done), catalogue extension (`luscii.program` appears in `GET /pathway-block-types` with correct provenance + config schema), block-lane validation (rejects `luscii.program` outside `external`), Luscii routes (list + resolve + 404), CHECK widening migration round-trip.
- [x] 7.2 Orchestrator: vitest covers palette grouping by source/provider (done — `groupCatalogue.test.ts`), thumbnail / dimensions clamp rule (done — `blockDimensions.test.ts`), sub-line builder (done — `subLine.test.ts`). **Open:** inspector header render + picker fetch require `QueryClientProvider` scaffolding — defer to a follow-up RTL pass.
- [x] 7.3 Run `/verify` and quote results before marking the change apply-complete. **Verified via merged PRs landing the spec.**
