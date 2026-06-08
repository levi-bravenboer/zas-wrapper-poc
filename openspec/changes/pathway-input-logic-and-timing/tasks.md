## 0. Prerequisite gate

- [ ] 0.1 Verify `pathway-model-foundations` is archived (`openspec/changes/archive/<date>-pathway-model-foundations/` exists). Halt if not.
- [ ] 0.2 Verify parent `pathway-model-redesign` design.md decisions D2, D3, D5, D6 unchanged.

## 1. Predicate vocabulary

- [ ] 1.1 `app/domain/pathway/input_logic/predicates.py`: `PredicateKind` enum (closed); per-predicate typed args dataclass; discriminated union for serialisation.
- [ ] 1.2 `InputLogicRule` Pydantic v2 model: `node: str`, `predicate: PredicateKind`, `args` typed per predicate via discriminator.
- [ ] 1.3 `InputLogic` aggregate: `rules: list[InputLogicRule]`, `aggregator: Literal["all_of", "any_of"]`, optional `n_of_m`.
- [ ] 1.4 Per-predicate evaluator function; `evaluate(rule, context) -> bool`. Unit tests covering every predicate.

## 2. `input_logic` on BaseBlock

- [ ] 2.1 Promote `BaseBlock.input_logic` from slot #1 stub to real field; default empty list.
- [ ] 2.2 Alembic migration: add `input_logic` JSONB column to `pathway_block`; index on GIN if query patterns warrant.
- [ ] 2.3 Mapper updates: `BaseBlock.input_logic` ⇄ ORM column.

## 3. Drop pathway_edge + backfill

- [ ] 3.1 Backfill data migration: for every edge row, append `{node: from_slug, predicate: "if_done"}` to `to.input_logic`. For decision-source edges, use `{predicate: "decision_output", args: {output_key: <branch_label>}}` per DecisionBlock.outputs mapping.
- [ ] 3.2 Alembic migration: drop `pathway_edge` table.
- [ ] 3.3 Canvas API: replace edge-row reads with derived-edge computation from every block's `input_logic`. Return `[{from, to, predicate, args}]` per pathway.
- [ ] 3.4 Validator: every `input_logic.node` resolves to an existing block in the same pathway version.

## 4. TimingPolicy

- [ ] 4.1 `app/domain/pathway/timing.py`: tagged union — `FixedDurationPolicy`, `WaitAfterPolicy`, `DueWithinPolicy`, `AtEnrollmentPickedDatePolicy`.
- [ ] 4.2 Alembic migration: add `timing_policy_kind`, `timing_offset_iso`, `timing_window_iso`, `timing_duration_iso` columns to `pathway_block` (nullable per variant).
- [ ] 4.3 Mapper: tagged union ⇄ per-variant columns.
- [ ] 4.4 Backfill: existing timing field → `FixedDurationPolicy` if duration set, else `WaitAfterPolicy(PT0S)`.
- [ ] 4.5 Promote `BaseBlock.timing_policy` from slot #1 stub.

## 5. DecisionBlock typed outputs

- [ ] 5.1 `DecisionBlock.outputs: tuple[str, ...]` required. `mode: Literal["xor", "and"] = "and"`.
- [ ] 5.2 Publish-time validator: every downstream `decision_output` reference must resolve to a real `output_key` on the named producer; producer must be a `DecisionBlock` or a kind that declares `outputs`.
- [ ] 5.3 XOR-mode invariant: at runtime exactly one output fires (enforced in slot #3 runtime; surface design constraint here).
- [ ] 5.4 Unit tests: valid + invalid output references; XOR vs AND mode.

## 6. Retire write-compat shim

- [ ] 6.1 Remove `X-Pathway-Block-Shape` header opt-in — typed payload becomes the only accepted shape.
- [ ] 6.2 Remove dual-write to `pathway_block_legacy` from the write API.
- [ ] 6.3 Alembic migration: drop `pathway_block_legacy` table.
- [ ] 6.4 Frontend builder UI: stop sending legacy `(type, config)` payload; author `input_logic` + `timing_policy` + typed fields directly. (`/openapi-sync` already exposed the typed shape in slot #1.)

## 7. Tests

- [ ] 7.1 Predicate evaluator unit tests per kind.
- [ ] 7.2 Backfill round-trip: every edge row produces correct `input_logic` entry; every legacy timing value produces correct `TimingPolicy` variant.
- [ ] 7.3 Canvas derived-edge test: derived edges match pre-migration edge rows for fixture pathway.
- [ ] 7.4 Publish-time validator tests: invalid `input_logic.node`, invalid `decision_output.output_key`, missing `outputs` on producer.

## 8. Sync + cleanup

- [ ] 8.1 `/openapi-sync` to surface `input_logic` + `TimingPolicy` + `outputs` on the typed schema.
- [ ] 8.2 `/verify backend` and `/verify orchestrator`.
- [ ] 8.3 Update `CHAIN-pathway-model.md`: slot #2 ready-to-apply.
