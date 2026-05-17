## 1. Backend — catalogue dataclass + enum

- [ ] 1.1 Add `BlockSemantics(str, enum.Enum)` to `app/services/pathway/catalogue.py` with the eight values (`appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`).
- [ ] 1.2 Extend `BlockTypeEntry` dataclass with `semantics: BlockSemantics`, `icon: str`, `ui_schema: dict[str, Any]`. Keep dataclass frozen.
- [ ] 1.3 Add `EventTypeEntry` dataclass + `EVENT_TYPES` tuple (`pathology_report`, `scan_report`, `lab_result`, `external_data`) with Dutch labels.
- [ ] 1.4 Add `EdgeTimingKindEntry` dataclass + `EDGE_TIMING_KINDS` tuple for the four kinds (`completion`, `marker`, `immediate`, `branch`); each entry exposes `kind`, `label`, `config_schema`, `ui_schema`.

## 2. Backend — block roster update

- [ ] 2.1 Remove the `timer` entry from `BLOCK_TYPES`.
- [ ] 2.2 Rename `email` → `message`; update `label="Bericht"`, `semantics=BlockSemantics.MESSAGE`, expand `config_schema` to include `channel` (enum `email|sms|push|in_app`, required), keep `subject`, `body`; add optional `cta_label`, `cta_target`.
- [ ] 2.3 Update each remaining existing entry (`appointment`, `task`, `decision`, `milestone`) with `semantics`, `icon` (lucide name string), and a starter `ui_schema` (at minimum `order`).
- [ ] 2.4 Add new `form` entry: `semantics=FORM`, `allowed_lane_kind_codes=(LANE_KIND_PATIENT,)`, `icon="clipboard-list"`, `config_schema` includes `title` (required), `intro`, `questions` (array, required, items with `id`, `type` enum `text|long_text|single_choice|multi_choice|scale|date|file`, `label`, `required`, optional `options`, `validation`), `submit_label`, `confirmation_message`. `ui_schema` declares `widgets.questions = "form-questions"`.
- [ ] 2.5 Add new `wait` entry: `semantics=WAIT`, `allowed_lane_kind_codes=(LANE_KIND_SYSTEM,)`, `icon="hourglass"`, `config_schema.event_type` is `enum=[c.code for c in EVENT_TYPES]` (required), `source_block_id` optional UUID, `timeout_days` optional int ≥ 0, `on_timeout` optional enum `continue|escalate`. `ui_schema.widgets.event_type = "event-type-picker"`.
- [ ] 2.6 Add new `pathway_link` entry: `semantics=PATHWAY_LINK`, `allowed_lane_kind_codes=(LANE_KIND_SYSTEM,)`, `icon="link-2"`, `config_schema.target_pathway_id` (required UUID), `mode` (required enum `blocking|fire_and_forget`), `context_mapping` optional object. `ui_schema.widgets.target_pathway_id = "pathway-picker"`.
- [ ] 2.7 Update `tests/services/pathway/test_catalogue.py` (or add) to assert: every entry has `semantics ∈ BlockSemantics`, `icon` non-empty, `ui_schema.order` (when present) contains only fields declared in `config_schema.properties`.

## 3. Backend — schemas + API surface

- [ ] 3.1 Extend `PathwayBlockTypeOut` in `app/schemas/pathway/catalogue.py`: `semantics: BlockSemantics` (use the same enum), `icon: str`, `ui_schema: dict[str, Any]`. Update field docstrings.
- [ ] 3.2 Add `PathwayEdgeTimingKindOut` schema (mirrors `EdgeTimingKindEntry`).
- [ ] 3.3 Add `PathwayEdgeOffsetDirectionOut` schema (`code`, `label`, `ord`).
- [ ] 3.4 Add `GET /pathway-edge-timing-kinds` router in `app/api/routers/pathway/`; returns `list[PathwayEdgeTimingKindOut]`.
- [ ] 3.5 Add `GET /pathway-edge-offset-directions` router; returns `list[PathwayEdgeOffsetDirectionOut]` ordered by `ord`.
- [ ] 3.6 Add integration tests for both new GET endpoints (response shape, ordering, presence of expected codes).

## 4. Backend — DB models + lookup table

- [ ] 4.1 Create `app/db/models/pathway/edge_offset_direction.py` modelled on `lane_kind.py`. Class `PathwayEdgeOffsetDirection` with `code` (PK String(16)), `label` (String(64)), `ord` (SmallInteger). Export from `app/db/models/pathway/__init__.py`.
- [ ] 4.2 Extend `PathwayEdge` in `app/db/models/pathway/edge.py` with `time_marker_id` (FK `pathway_time_marker.id`, ondelete CASCADE, nullable, indexed), `offset_value_id` (FK `pathway_timing_value.id`, ondelete CASCADE, nullable, indexed), `offset_direction_code` (FK `pathway_edge_offset_direction.code`, ondelete RESTRICT, nullable, indexed).
- [ ] 4.3 Express both CHECK constraints in `__table_args__` (`ck_pathway_edge_one_timing`, `ck_pathway_edge_offset_pair`) so the ORM is the source of truth alongside the migration.

## 5. Backend — Alembic migration

- [ ] 5.1 `moon run backend:make-migration "pathway block redesign and edge timing"`. Review autogen output via `/new-migration`.
- [ ] 5.2 Hand-edit the revision to add `create_table` for `pathway_edge_offset_direction`, `bulk_insert` seed rows (`before` ord 10, `after` ord 20).
- [ ] 5.3 Ensure autogen produced the three edge columns + indexes; rename/reorder ops if `make-migration` mis-ordered them.
- [ ] 5.4 Hand-add `op.create_check_constraint('ck_pathway_edge_one_timing', ..., 'num_nonnulls(delay_value_id, time_marker_id, source_branch_id) <= 1')` and `'ck_pathway_edge_offset_pair', ..., '((time_marker_id IS NULL) = (offset_value_id IS NULL)) AND ((time_marker_id IS NULL) = (offset_direction_code IS NULL))'`.
- [ ] 5.5 Hand-add data migrations: `op.execute("UPDATE pathway_block SET type='message' WHERE type='email'")` then `op.execute("DELETE FROM pathway_block WHERE type='timer'")`.
- [ ] 5.6 Write `downgrade()` that drops constraints + indexes + columns + table in reverse order and reverses the `message → email` rename. Document inability to restore deleted `timer` rows.
- [ ] 5.7 Run `moon run :reset && moon run backend:migrate && moon run backend:migrate -- downgrade -1 && moon run backend:migrate` locally to validate up → down → up.

## 6. Backend — pathway schemas + service validation

- [ ] 6.1 Extend `PathwayEdgeIn` / `PathwayEdgeOut` in `app/schemas/pathway/pathway.py` with `time_marker_id: UUID | None`, `offset_value_id: UUID | None`, `offset_direction_code: str | None`.
- [ ] 6.2 Add `EdgeTimingValidationError(edge_id, reason)` in `app/services/pathway/errors.py`; map to HTTP 422.
- [ ] 6.3 Extend `_ResolvedDefinition.from_payload` to validate the edge timing union: at most one of `(delay_value_id, time_marker_id, source_branch_id)` may be set; if `time_marker_id` is set, both `offset_value_id` and `offset_direction_code` must be set (else raise `EdgeTimingValidationError`). Mirrors DB CHECK so violations surface as 422 not 500.
- [ ] 6.4 Validate `time_marker_id` and `offset_value_id` belong to the same `pathway_version` (mirrors existing cross-version FK checks).
- [ ] 6.5 Validate `offset_direction_code` exists in the seeded `pathway_edge_offset_direction` rows (cached lookup at service startup, or hit DB once per request — match existing lane_kind pattern).
- [ ] 6.6 Service test: edge with both `delay_value_id` and `time_marker_id` set → `EdgeTimingValidationError`.
- [ ] 6.7 Service test: edge with `time_marker_id` but null `offset_value_id` → `EdgeTimingValidationError`.
- [ ] 6.8 Service test: edge with marker timing but marker belongs to another version → existing cross-version error.
- [ ] 6.9 Router test: `PUT /pathways/{id}` with invalid timing → 422; payload identifies `edge_id` and reason.

## 7. Backend — block validation + seed

- [ ] 7.1 Confirm `_validate_block_config` covers all new block types (no code change needed — it's schema-driven). Add a service test per new block type asserting at least one valid + one invalid payload.
- [ ] 7.2 Service test: `wait.event_type` outside `EVENT_TYPES` enum → 422 with structured field path.
- [ ] 7.3 Service test: `message.channel` outside the channel enum → 422.
- [ ] 7.4 Service test: `pathway_link.mode` outside `blocking|fire_and_forget` → 422.
- [ ] 7.5 Update `scripts/seed_pathway.py`: replace `timer` block with a `wait` block (`event_type=pathology_report`); replace `email` references with `message` (`channel=email`); add one `form` block on a patient lane; add one marker-anchored edge using the existing `surgery` time marker (verify marker exists in seed or add it).
- [ ] 7.6 Run `moon run :reset && moon run backend:seed`. Confirm seed succeeds, all blocks render correctly via `GET /pathways/{id}`.

## 8. Backend — schema regen

- [ ] 8.1 `moon run backend:openapi` — regenerate `apps/backend/openapi.json`.
- [ ] 8.2 `moon run orchestrator:typegen` — refresh `apps/orchestrator/src/lib/api/schema.d.ts`.

## 9. Frontend — types + catalogue plumbing

- [ ] 9.1 Add `BlockSemantics` literal union to `apps/orchestrator/src/modules/pathway/types.ts` derived from `schema.d.ts`. Add discriminated `EdgeTiming` union (`completion`, `marker`, `immediate`, `branch`).
- [ ] 9.2 Replace the hardcoded `BLOCK_TYPE_ICONS` map in `blockCatalogue.tsx` with a `LUCIDE_BY_NAME` lookup that resolves a lucide component from a string. Fall back to `Workflow` icon (current behaviour).
- [ ] 9.3 `BlockNode` (canvas node body) switches on `block.semantics` (one switch, eight cases); render one-line summary per semantics. Adding a block with existing semantics requires zero TS.
- [ ] 9.4 `BuilderDrawer` keeps the existing per-`type` inspector; add a temporary "Geen inspector beschikbaar" placeholder branch for `form`, `wait`, `pathway_link`. Comment links to `pathway-config-forms` change.
- [ ] 9.5 Update `apps/orchestrator/src/modules/pathway/blockCatalogue.tsx` (or wherever new types need static i18n keys) — Dutch labels for `message`, `form`, `wait`, `pathway_link`.

## 10. Frontend — i18n

- [ ] 10.1 Rename `pathway.blockType.email.*` to `pathway.blockType.message.*` in `nl/pathway.json`. Keep the existing copy where it still applies.
- [ ] 10.2 Add new keys: `pathway.blockType.form.{label,description}`, `pathway.blockType.wait.{label,description}`, `pathway.blockType.pathwayLink.{label,description}`.
- [ ] 10.3 Add edge timing kind labels: `pathway.edgeTiming.{completion,marker,immediate,branch}.label`.
- [ ] 10.4 Add offset direction labels: `pathway.edgeOffsetDirection.{before,after}` (read from API, copy serves as fallback).
- [ ] 10.5 Add event type labels: `pathway.eventType.{pathologyReport,scanReport,labResult,externalData}`.

## 11. Frontend — tests

- [ ] 11.1 Vitest: `blockCatalogue.test.ts` — every entry's `semantics` is a known `BlockSemantics`; every `icon` resolves to a lucide component or falls back to default.
- [ ] 11.2 Vitest: `useCanvasHandlers.newBlockTypes.test.ts` — dropping a `form` / `wait` / `pathway_link` block onto its allowed lane dispatches `add-block` with the correct default config (empty for required fields, lets backend reject).
- [ ] 11.3 Vitest: serialization round-trip — edge with marker timing survives `PathwayEdgeOut.parse → PathwayEdgeIn.serialize` unchanged.
- [ ] 11.4 Playwright happy-path: drag a `form` from dock → patient lane → block appears with default label; same for `wait` (system lane); same for `pathway_link` (system lane).

## 12. Verify + ship

- [ ] 12.1 `moon run backend:lint && moon run backend:typecheck && moon run backend:test-host -- tests/services/pathway tests/api/routers/pathway`.
- [ ] 12.2 `moon run orchestrator:lint && moon run orchestrator:typecheck && moon run orchestrator:test -- src/modules/pathway`.
- [ ] 12.3 `moon run :reset && moon run backend:migrate && moon run backend:seed`. Spot-check `GET /pathways/{seed-id}` includes new block types + marker-anchored edge.
- [ ] 12.4 Update `openspec/scope.md` to record `pathway-block-redesign` capability and the planned follow-up `pathway-config-forms`.
- [ ] 12.5 `/verify` clean. Commit per logical unit (catalogue / migration / schema regen / frontend type-flow / i18n / tests).
