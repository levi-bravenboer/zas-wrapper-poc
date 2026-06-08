## 0. Prerequisite gate

- [x] 0.1 Verify `pathway-model-redesign` parent design.md decisions D1, D4, D7 are still locked in. Halt and surface to user if any decision has changed.

## 1. Domain — `BaseBlock` hierarchy

- [x] 1.1 `app/domain/pathway/blocks/_base.py`: define `BaseBlock` (Pydantic v2) with `name`, `lane_kind`, stub `input_logic: list = []`, stub `timing_policy: dict | None = None`. Class attrs: `LABEL`, `DESCRIPTION`, `ICON`, `LANE_KINDS`, `EVENTS`, `RESULT_TYPE`, `FIELD_MODES`, `DEFERRED_FIELDS`.
- [x] 1.2 `app/domain/pathway/blocks/deferred.py`: `DeferredFieldSpec` (attr, label, kind, required, help, default, depends_on).
- [x] 1.3 Per-kind subclasses under `app/domain/pathway/blocks/<kind>/block.py` covering today's 9 kinds: `AppointmentBlock` (appointment), `TaskBlock` (task), `DecisionBlock` (decision), `MessageBlock` (message), `FormBlock` (form), `MilestoneBlock` (milestone), `WaitBlock` (wait), `PathwayLinkBlock` (pathway_link), `ExternalProgramBlock` (luscii_program, with `provider: Literal["luscii", ...]` discriminator). Each subclass declares its typed fields, `DEFERRED_FIELDS`, class metadata. New kinds from the parent spec catalogue (`start`, `subpath`, `treatment`, `mdo`, `bridge`, `end-pathway`, `notification`) ship as separate proposals after foundations.
- [ ] 1.4 Retire `BlockTypeEntry` registry and its data files. Add deprecation shim that resolves old `(type: str)` strings to the new subclass class. (Resolver shim landed in `resolver.py`; registry retire pending — gated on §4/§5 migrating consumers off `get_block_type`/`BLOCK_TYPES`.)
- [x] 1.5 Unit tests per subclass: instantiation, default field values, `DEFERRED_FIELDS` shape, `LANE_KINDS` membership.

## 2. Storage — single-table inheritance

- [x] 2.1 Alembic migration: add columns to existing `pathway_block` in-place — `kind` discriminator (nullable initially; backfilled then set NOT NULL in chain slot #2), ~30 nullable per-kind columns prefixed by kind (`appointment_title`, `milestone_label`, etc.), plus stub JSONB columns `input_logic` (default `'[]'::jsonb`) and `timing_policy` (nullable) for chain slot #2. No table rename; the four FKs that reference `pathway_block.id` stay intact.
- [x] 2.2 `app/db/models/pathway/block.py`: extend `PathwayBlock` with `kind` discriminator + all per-kind nullable columns + `input_logic` + `timing_policy` stubs as plain `Mapped` fields on the flat ORM class. SQLAlchemy polymorphic loading deferred to chain slot #2 once `kind` is NOT NULL.
- [x] 2.3 Mapper layer `app/db/models/pathway/block_mapper.py`: `to_domain(row: PathwayBlock) -> BaseBlock` dispatches via `resolve_block_kind(row.kind)`; `from_domain(block: BaseBlock) -> dict[str, Any]` returns the kwargs to apply on a row. Legacy projector `legacy_to_domain(row)` reads `(type, config)` and yields a domain subclass when `kind` is NULL.
- [x] 2.4 Data backfill: same Alembic revision (`op.execute(...)`) populates `kind` + per-kind columns from every existing row's `(type, config)`. Cover every kind present in demo seeds. Legacy `type` / `config` rows stay untouched as a fallback.
- [x] 2.5 Round-trip test: every backfilled row materialises into the right typed subclass; re-serialising matches the original `config` shape on the fields the subclass owns.

## 3. Deferred fields — class-level

- [x] 3.1 Drop reliance on `pathway_block_deferred_field` table for spec storage. Per D10 demo content is rebuilt manually, so no historical scrape data exists — `DEFERRED_FIELDS` ships empty per subclass except `AppointmentBlock.location`. Builder-team-authored defaults fill in over time; per-instance `pathway_block_deferred_field` rows still drive override behaviour until chain slot #3 retires the runtime side. `scheduled_at` deliberately deferred to chain slot #3 (lands on `BlockExecution` per D5).
- [x] 3.2 Validator: at publish, every `DeferredFieldSpec.attr` must reference an existing field on the subclass. (`app/domain/pathway/blocks/validators.py::validate_deferred_field_attrs`; catalogue-wide check in `validate_all_block_classes`; tests in `tests/domain/pathway/test_block_validators.py`.)
- [x] 3.3 Note: runtime `DeferredFieldValue` table is chain slot #3; this change only lands the spec side.

## 4. Read API on new shape

- [ ] 4.1 `GET /pathways/{id}`: serialise blocks from the new `pathway_block` table via Pydantic v2 discriminated union.
- [ ] 4.2 `GET /pathways/{id}/blocks/{block_id}`: same discriminated union.
- [ ] 4.3 OpenAPI: re-run `moon run backend:openapi`; verify discriminator surfaces correctly.
- [ ] 4.4 Frontend: `/openapi-sync` regenerates types; spot-check `BlockNodeRouter` still resolves per-kind components.

## 5. Write API compat shim

- [x] 5.1 `PUT /pathways/{id}` (real write surface; spec said `POST/PATCH /pathways/{id}/blocks` but builder authors via bulk replace) accepts legacy `(type, config)` payload. Shim (`app/db/models/pathway/block_write_shim.py::block_in_to_orm_kwargs`) resolves the typed subclass and dual-writes the typed per-kind columns alongside the verbatim legacy `type`/`config`/`label` on the same row (migration kept the table in-place per §2.1, so "dual-write to `pathway_block_legacy`" collapses to "same row, both shapes" — see drift note in proposal vs. migration).
- [x] 5.2 Router `replace_pathway` reads `X-Pathway-Block-Shape: typed` header; threads `typed_shape: bool` to `replace_definition` → shim. When set, `config` is validated as the typed subclass payload (no `config` indirection).
- [x] 5.3 Contract tests: `tests/services/pathway/test_pathway_service.py::test_replace_definition_dual_writes_typed_columns` (legacy round-trip + both column sets written) and `::test_replace_definition_typed_shape_writes_typed_columns` (typed-payload header path). Clone path (`pathway_version_service.py` fork-from-publish) round-trips via `block_row_clone_kwargs`; covered transitively by existing fork tests.

## 6. Validation

- [ ] 6.1 Publish-time validator: every block instance validates against its subclass (Pydantic v2 strict). Invalid → publish rejected with per-block error.
- [ ] 6.2 Lane-kind validator (D7): `block.lane.kind ∈ block.__class__.allowed_lane_kinds`.

## 7. Cleanup + sync

- [ ] 7.1 Retire dead registry files (`app/domain/pathway/blocks/_registry.py` etc.) once subclasses cover all kinds.
- [ ] 7.2 Run `/verify backend` and `/verify orchestrator` (latter for typegen drift).
- [ ] 7.3 Update CHAIN.md or new `CHAIN-pathway-model.md`: mark slot #1 ready-to-apply.
