## 0. Prerequisite gate

- [ ] 0.1 Verify `pathway-model-redesign` parent design.md decisions D1, D4, D7 are still locked in. Halt and surface to user if any decision has changed.

## 1. Domain — `BaseBlock` hierarchy

- [ ] 1.1 `app/domain/pathway/blocks/_base.py`: define `BaseBlock` (Pydantic v2) with `name`, `lane_kind`, stub `input_logic: list = []`, stub `timing_policy: dict | None = None`. Class attrs: `LABEL`, `DESCRIPTION`, `ICON`, `LANE_KINDS`, `EVENTS`, `RESULT_TYPE`, `FIELD_MODES`, `DEFERRED_FIELDS`.
- [ ] 1.2 `app/domain/pathway/blocks/deferred.py`: `DeferredFieldSpec` (attr, label, kind, required, help, default, depends_on).
- [ ] 1.3 Per-kind subclasses under `app/domain/pathway/blocks/<kind>/block.py` covering today's 9 kinds: `AppointmentBlock` (appointment), `TaskBlock` (task), `DecisionBlock` (decision), `MessageBlock` (message), `FormBlock` (form), `MilestoneBlock` (milestone), `WaitBlock` (wait), `PathwayLinkBlock` (pathway_link), `ExternalProgramBlock` (luscii_program, with `provider: Literal["luscii", ...]` discriminator). Each subclass declares its typed fields, `DEFERRED_FIELDS`, class metadata. New kinds from the parent spec catalogue (`start`, `subpath`, `treatment`, `mdo`, `bridge`, `end-pathway`, `notification`) ship as separate proposals after foundations.
- [ ] 1.4 Retire `BlockTypeEntry` registry and its data files. Add deprecation shim that resolves old `(type: str)` strings to the new subclass class.
- [ ] 1.5 Unit tests per subclass: instantiation, default field values, `DEFERRED_FIELDS` shape, `LANE_KINDS` membership.

## 2. Storage — single-table inheritance

- [ ] 2.1 Alembic migration: add columns to existing `pathway_block` in-place — `kind` discriminator (nullable initially; backfilled then set NOT NULL in chain slot #2), ~30 nullable per-kind columns prefixed by kind (`appointment_title`, `milestone_label`, etc.), plus stub JSONB columns `input_logic` (default `'[]'::jsonb`) and `timing_policy` (nullable) for chain slot #2. No table rename; the four FKs that reference `pathway_block.id` stay intact.
- [ ] 2.2 `app/db/models/pathway/block.py`: extend `PathwayBlock` with `kind` discriminator + all per-kind nullable columns + `input_logic` + `timing_policy` stubs as plain `Mapped` fields on the flat ORM class. SQLAlchemy polymorphic loading deferred to chain slot #2 once `kind` is NOT NULL.
- [ ] 2.3 Mapper layer `app/db/models/pathway/block_mapper.py`: `to_domain(row: PathwayBlock) -> BaseBlock` dispatches via `resolve_block_kind(row.kind)`; `from_domain(block: BaseBlock) -> dict[str, Any]` returns the kwargs to apply on a row. Legacy projector `legacy_to_domain(row)` reads `(type, config)` and yields a domain subclass when `kind` is NULL.
- [ ] 2.4 Data backfill: same Alembic revision (`op.execute(...)`) populates `kind` + per-kind columns from every existing row's `(type, config)`. Cover every kind present in demo seeds. Legacy `type` / `config` rows stay untouched as a fallback.
- [ ] 2.5 Round-trip test: every backfilled row materialises into the right typed subclass; re-serialising matches the original `config` shape on the fields the subclass owns.

## 3. Deferred fields — class-level

- [ ] 3.1 Drop reliance on `pathway_block_deferred_field` table for spec storage. Convert existing rows into per-class `DEFERRED_FIELDS` declarations (one-off data scrape, captured as constants in subclass files).
- [ ] 3.2 Validator: at publish, every `DeferredFieldSpec.attr` must reference an existing field on the subclass.
- [ ] 3.3 Note: runtime `DeferredFieldValue` table is chain slot #3; this change only lands the spec side.

## 4. Read API on new shape

- [ ] 4.1 `GET /pathways/{id}`: serialise blocks from the new `pathway_block` table via Pydantic v2 discriminated union.
- [ ] 4.2 `GET /pathways/{id}/blocks/{block_id}`: same discriminated union.
- [ ] 4.3 OpenAPI: re-run `moon run backend:openapi`; verify discriminator surfaces correctly.
- [ ] 4.4 Frontend: `/openapi-sync` regenerates types; spot-check `BlockNodeRouter` still resolves per-kind components.

## 5. Write API compat shim

- [ ] 5.1 `POST/PATCH /pathways/{id}/blocks`: keep accepting legacy `(type, config)` payload. Shim transforms via subclass-shim → writes to new `pathway_block` AND `pathway_block_legacy` (dual-write) until chain slot #2 retires legacy.
- [ ] 5.2 Add `X-Pathway-Block-Shape: typed` opt-in header — when present, route accepts typed-subclass payload directly without shim.
- [ ] 5.3 Contract tests: legacy payload round-trips; typed payload round-trips; mutations land on both tables and stay in sync.

## 6. Validation

- [ ] 6.1 Publish-time validator: every block instance validates against its subclass (Pydantic v2 strict). Invalid → publish rejected with per-block error.
- [ ] 6.2 Lane-kind validator (D7): `block.lane.kind ∈ block.__class__.allowed_lane_kinds`.

## 7. Cleanup + sync

- [ ] 7.1 Retire dead registry files (`app/domain/pathway/blocks/_registry.py` etc.) once subclasses cover all kinds.
- [ ] 7.2 Run `/verify backend` and `/verify orchestrator` (latter for typegen drift).
- [ ] 7.3 Update CHAIN.md or new `CHAIN-pathway-model.md`: mark slot #1 ready-to-apply.
