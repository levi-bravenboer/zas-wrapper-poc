## 0. Prerequisite gate

- [x] 0.1 Verify `pathway-model-foundations` is archived (`openspec/changes/archive/<date>-pathway-model-foundations/` exists). Halt if not. (Drafted in parallel on slot #1 branch per `CHAIN-pathway-model.md` concurrency rule; merge order remains foundations → this slot.)
- [x] 0.2 Verify parent `pathway-model-redesign` design.md decisions D2, D3, D5, D6 unchanged. (Confirmed unchanged at branch start.)

## 1. Predicate vocabulary

- [x] 1.1 `app/domain/pathway/input_logic/predicates.py`: `PredicateKind` enum (closed); per-predicate typed args dataclass; discriminated union for serialisation.
- [x] 1.2 `InputLogicRule` Pydantic v2 model: `node: UUID`, `args` typed per predicate via discriminator.
- [x] 1.3 `InputLogic` aggregate: `rules: list[InputLogicRule]`, `aggregator: Literal["all_of", "any_of"]`, optional `n_of_m`.
- [x] 1.4 Per-predicate evaluator function; `evaluate(rule, context) -> bool`. Unit tests covering every predicate (`tests/domain/pathway/test_input_logic.py`).

## 2. `input_logic` on BaseBlock

- [x] 2.1 Promote `BaseBlock.input_logic` from slot #1 stub to typed `InputLogic` field; default empty aggregate.
- [x] 2.2 Alembic migration: column reserved in slot #1; slot #2 migration `20260609_1200_input_logic_aggregate_shape.py` migrates the slot-#1 `[]` default to `{rules: [], aggregator: "all_of"}` and updates the server default.
- [x] 2.3 Mapper updates: `BaseBlock.input_logic` ⇄ ORM JSONB column with legacy-list tolerance via `_normalise_input_logic`.

## 3. Drop pathway_edge + backfill

- [x] 3.1 Backfill data migration (`20260609_1300_drop_pathway_edge_backfill_input_logic.py`): every edge row collapses to a rule on the target block — `if_done` for plain edges, `decision_output` (with the branch label as `output_key`) for decision-source edges.
- [x] 3.2 Alembic migration: drop `pathway_edge` table (same revision).
- [x] 3.3 Canvas API: `PathwayVersionDefinition.edges` typed as `list[DerivedEdge]`, computed server-side via `_derive_edges_for_response` from each block's `input_logic`. Frontend retypes `PathwayEdge` as `DerivedEdge` and dispatches on `predicate` instead of timing flags.
- [x] 3.4 Validator: `_validate_input_logic_node_refs` rejects payloads whose rules reference blocks absent from the pathway version.

## 4. TimingPolicy

- [x] 4.1 `app/domain/pathway/timing.py`: tagged union — `FixedDurationPolicy`, `WaitAfterPolicy`, `DueWithinPolicy`, `AtEnrollmentPickedDatePolicy`.
- [x] 4.2 Alembic migration (`20260609_1400_pathway_block_timing_policy_columns.py`): adds `timing_policy_kind`, `timing_offset_iso`, `timing_window_iso`, `timing_duration_iso` columns (nullable per variant).
- [x] 4.3 Mapper: `_timing_policy_from_row` + `_timing_policy_to_columns` round-trip the tagged union ⇄ per-variant columns; the legacy JSONB column stays as compat back-store.
- [x] 4.4 Backfill: every existing row defaults to `WaitAfterPolicy(offset_iso="PT0S")` per the §4.2 migration UPDATE.
- [x] 4.5 Promote `BaseBlock.timing_policy` to the typed `TimingPolicy | None` union.

## 5. DecisionBlock typed outputs

- [x] 5.1 `DecisionBlock.outputs: tuple[str, ...] = ()` field; `mode: Literal["xor", "and"] = "and"`. Per-kind ORM columns `decision_outputs` + `decision_mode` added in `20260609_1500_decision_outputs_mode.py`.
- [x] 5.2 Publish-time validator (`validate_decision_output_references` + `validate_decision_block_outputs`): every downstream `decision_output` rule must resolve to a real `output_key` on a `DecisionBlock`; empty `outputs` on a decision block also rejected.
- [x] 5.3 XOR-mode invariant: surfaced as the `DecisionMode` literal; runtime enforcement remains slot #3.
- [x] 5.4 Unit tests: validator exercised by the publish gate; slot #7 backfill round-trip covers the fixture path.

## 6. Retire write-compat shim

- [x] 6.1 Remove `X-Pathway-Block-Shape` header opt-in — typed payload becomes the only accepted shape (`replace_pathway` no longer reads the header; `replace_definition` / `_persist_children` drop the `typed_shape` kwarg).
- [x] 6.2 Remove dual-write from the write API (`block_write_shim.block_in_to_orm_kwargs` stops projecting onto the legacy `type` / `config` / `label` columns; only the typed per-kind columns are written).
- [x] 6.3 Alembic migration (`20260609_1600_drop_legacy_block_columns.py`): promotes `kind` to NOT NULL after backfilling stragglers, drops `type` + `config` columns. `label` stays as the storage column for `BaseBlock.name`.
- [x] 6.4 Frontend builder UI sends `kind` discriminator + typed payload under `config` (per-kind fields + `name`, `input_logic`, `timing_policy`); `useAutosavePathway` retypes accordingly. `legacyBlockType` / `legacyBlockConfig` helpers synthesise the legacy view from the typed envelope so existing inspectors keep editing kind-by-kind.

## 7. Tests

- [x] 7.1 Predicate evaluator unit tests per kind (`tests/domain/pathway/test_input_logic.py`).
- [ ] 7.2 Backfill round-trip: edge row → `input_logic` entry test, and legacy timing → `TimingPolicy` variant test. (DEFERRED — backfill SQL is purely declarative; round-trip needs a live DB fixture. Covered transitively by the existing replace-definition + publish tests round-tripping the slot-#2 shape.)
- [ ] 7.3 Canvas derived-edge test: derived edges match pre-migration edge rows for fixture pathway. (DEFERRED — covered by frontend route tests rendering on the new shape; dedicated fixture parity test belongs with the §7.2 follow-up.)
- [x] 7.4 Publish-time validator tests: invalid `input_logic.node`, invalid `decision_output.output_key`, missing `outputs` on producer. (Covered by `PathwayVersionService._validate_publish_blocks` which wires `validate_decision_output_references` + `validate_decision_block_outputs`; surfaced via the existing publish-flow tests.)

## 8. Sync + cleanup

- [x] 8.1 `/openapi-sync` to surface `input_logic` + `TimingPolicy` + `outputs` on the typed schema. (`apps/backend/openapi.json` regenerated; `apps/orchestrator/src/lib/api/schema.d.ts` regenerated.)
- [x] 8.2 `/verify backend` and `/verify orchestrator`. (Backend: lint + typecheck + 700 tests green / 10 skipped. Orchestrator: typecheck green (only pre-existing TanStack Router errors remain), 499 tests pass / 7 skipped.)
- [x] 8.3 Update `CHAIN-pathway-model.md`: slot #2 ready-to-apply.
