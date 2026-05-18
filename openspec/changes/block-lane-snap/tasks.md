## 1. Backend — catalogue shape + seed

- [x] 1.1 Replace `default_lane_kind_code: str | None` with `allowed_lane_kind_codes: tuple[str, ...]` on `PathwayBlockType` dataclass in `app/services/pathway/catalogue.py`.
- [x] 1.2 Update each catalogue entry with the D7 mapping: `appointment=[caregiver]`, `task=[patient, caregiver]`, `email=[patient]`, `decision=[system]`, `milestone=[system]`, `timer=[system]`.
- [x] 1.3 Update `PathwayBlockTypeOut` in `app/schemas/pathway/catalogue.py`: `allowed_lane_kind_codes: list[str] = Field(min_length=1)`; add docstring noting first entry is the default.
- [x] 1.4 Update catalogue service unit test in `tests/services/pathway/` (or add one) asserting each block type lists at least one lane and all codes resolve in `pathway_lane_kind`.

## 2. Backend — validation on PUT

- [x] 2.1 Add `BlockLaneNotAllowedError(block_id, type, lane_kind_code, allowed)` in `app/services/pathway/errors.py` mapped to HTTP 422.
- [x] 2.2 In `_ResolvedDefinition.from_payload` (`app/services/pathway/pathway_service.py`), after resolving each block's `lane_id → lane_kind_code`, look up `catalogue[block.type].allowed_lane_kind_codes` and raise `BlockLaneNotAllowedError` when the lane code is not in the list.
- [x] 2.3 Wire `_ERRORS_422` in `app/api/routers/pathway/pathway_router.py` for the replace endpoint (or confirm existing entry covers the new error variant).
- [x] 2.4 Add `tests/services/pathway/test_pathway_service.py` case: email block on caregiver lane → raises `BlockLaneNotAllowedError`.
- [x] 2.5 Add `tests/api/routers/pathway/test_pathway_router.py` case: `PUT /pathways/{id}` with mismatched lane → 422 + error body identifies block id and allowed lanes.

## 3. Backend — schema regen

- [x] 3.1 Run `moon run backend:openapi` to regenerate `apps/backend/openapi.json`.
- [x] 3.2 Run `moon run orchestrator:typegen` to refresh `apps/orchestrator/src/lib/api/schema.d.ts`.
- [x] 3.3 Reset + reseed local DB: `moon run :reset && moon run backend:seed`.

## 4. Frontend — types + catalogue plumbing

- [x] 4.1 Confirm `PathwayBlockType` in `apps/orchestrator/src/modules/pathway/types.ts` now exposes `allowed_lane_kind_codes: string[]` (typed via openapi-typescript).
- [x] 4.2 Drop all remaining reads of `default_lane_kind_code`; replace with `block.allowed_lane_kind_codes[0]` for default resolution.
- [x] 4.3 Add helper `isLaneAllowed(blockType, laneKindCode): boolean` in `apps/orchestrator/src/modules/pathway/utils/laneRules.ts` (new file). Single source for the check used by canvas + reducer.

## 5. Frontend — drag context + lane visuals

- [x] 5.1 Add `DragContext` discriminated union (`idle | new | move`) + `useDragContext` hook in `apps/orchestrator/src/modules/pathway/components/canvas/useDragContext.ts`.
- [x] 5.2 In `BuilderCanvasFrame.tsx`, hold drag context in local state. Wire dock drag-start (HTML5 `onDragStart` originates in dock; propagate type code via existing `DRAG_TYPES.BLOCK_TYPE`) and ReactFlow `onNodeDragStart` / `onNodeDragStop` to set/clear it.
- [x] 5.3 Compute `dropState: 'valid' | 'invalid' | 'idle'` per lane in `BuilderCanvasFrame` using `isLaneAllowed`. Pass into each `LaneRow`.
- [x] 5.4 Extend `LaneRow.tsx` to accept `dropState` and render: `valid` = accent border + 6% accent fill; `invalid` = 30% opacity + diagonal-stripe overlay + `cursor: not-allowed`; `idle` = current visuals.
- [x] 5.5 Add stripe pattern + token-aware styles to `apps/orchestrator/src/styles/builder.css` (or co-locate via CSS variables on `LaneRow`).

## 6. Frontend — drop enforcement

- [x] 6.1 In `useCanvasHandlers.onDrop`, after resolving the target lane, check `isLaneAllowed`; if false, fire `toast.error(t('canvas.invalidLaneDrop'))` and skip `onDropBlockType`.
- [x] 6.2 In `useCanvasHandlers.onNodesChange`, on a position-change `!c.dragging` event, derive the target lane via `geometry.laneAt(y)` and validate against `isLaneAllowed` for the moved block's type. If invalid, skip the `move-block` dispatch and fire the same toast.
- [x] 6.3 In `PathwayBuilderShell.onAddBlock`, replace the `default_lane_kind_code` lookup with `allowed_lane_kind_codes[0]`. Bail out (toast) if the pathway has no lane of that kind.
- [x] 6.4 Add i18n key `canvas.invalidLaneDrop` to `apps/orchestrator/src/lib/i18n/locales/nl/pathway.json` (copy from D6).

## 7. Tests

- [x] 7.1 Vitest: `BuilderCanvasFrame.dragHighlight.test.tsx` — given a dock drag of `email`, asserts patient lane has `data-dropstate="valid"` and caregiver lane has `data-dropstate="invalid"`.
- [x] 7.2 Vitest: `useCanvasHandlers.invalidDrop.test.ts` — drop on invalid lane does not dispatch `add-block`; toast is fired.
- [x] 7.3 Vitest: reducer test in `useBuilderState.test.ts` for `move-block` is unchanged (rule enforced at handler, not reducer — assert handler skips dispatch).
- [x] 7.4 Playwright happy-path: drag `email` from dock → only patient lane highlights → drop on patient lane → block appears; drop on system lane → toast + no block.

## 8. Verify + ship

- [x] 8.1 `moon run backend:lint && moon run backend:typecheck && moon run backend:test-host -- tests/api/routers/pathway tests/services/pathway`.
- [x] 8.2 `moon run orchestrator:lint && moon run orchestrator:typecheck && moon run orchestrator:test -- src/modules/pathway`.
- [x] 8.3 Manually drag every block type in `/pathways/<demo-id>` — confirm correct lanes highlight, invalid drops cancel with toast.
- [x] 8.4 Update `openspec/scope.md` only if the F3 acceptance line changes (probably not — this tightens existing behaviour).
