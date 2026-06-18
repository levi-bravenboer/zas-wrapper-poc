# pathway-model-foundations Specification

## Purpose
TBD - created by archiving change pathway-model-foundations. Update Purpose after archive.
## Requirements
### Requirement: BaseBlock class hierarchy as domain source of truth

The system SHALL model pathway blocks as a Python class hierarchy with `BaseBlock` as the abstract root and one concrete subclass per block kind currently supported: `AppointmentBlock` (appointment), `TaskBlock` (task), `DecisionBlock` (decision), `MessageBlock` (message), `FormBlock` (form), `MilestoneBlock` (milestone), `WaitBlock` (wait), `PathwayLinkBlock` (pathway_link), `ExternalProgramBlock` (luscii_program, parameterised by a `provider` field). The `BlockTypeEntry` data registry SHALL be retired.

#### Scenario: Per-kind metadata lives on the class

- **GIVEN** the subclass `AppointmentBlock`
- **THEN** its `LABEL`, `DESCRIPTION`, `ICON`, `LANE_KINDS`, `EVENTS`, `RESULT_TYPE`, `FIELD_MODES`, `DEFERRED_FIELDS` class attributes are the source of truth
- **AND** no entry for `AppointmentBlock` exists in the retired `BlockTypeEntry` registry

#### Scenario: Unknown kind rejected at construction

- **WHEN** the system attempts to construct a block whose `kind` discriminator has no matching subclass
- **THEN** construction fails with a `UnknownBlockKindError`

### Requirement: Single-table storage for pathway_block kinds

The system SHALL persist all pathway block kinds in the existing `pathway_block` table with a `kind` discriminator column and nullable per-kind columns prefixed by kind (e.g. `appointment_title`, `milestone_label`). A mapper layer (`app/db/models/pathway/block_mapper.py`) SHALL convert ORM rows to typed `BaseBlock` subclasses by dispatching on `kind`. SQLAlchemy polymorphic loading is deferred to chain slot #2 (`pathway-input-logic-and-timing`) once the discriminator is NOT NULL; during chain slot #1 the mapper is the only consumer-facing dispatch point. The table SHALL NOT be renamed; existing foreign keys (`pathway_edge.from_block_id`, `pathway_edge.to_block_id`, `pathway_block_branch.block_id`, `pathway_block_deferred_field.block_id`) reference `pathway_block.id` and must stay valid through the transition.

#### Scenario: Loading a pathway returns typed subclass instances

- **WHEN** a client loads a pathway containing one `AppointmentBlock` row and one `DecisionBlock` row
- **THEN** the domain layer materialises one `AppointmentBlock` instance and one `DecisionBlock` instance with their per-kind fields populated

#### Scenario: Per-kind columns are nullable across kinds

- **GIVEN** the `pathway_block` table contains an `appointment_location` column (used by `AppointmentBlock`)
- **WHEN** a `DecisionBlock` row is written
- **THEN** the `appointment_location` column on that row is NULL and writing succeeds

### Requirement: Class-level DeferredFieldSpec declarations

Each `BaseBlock` subclass SHALL declare its deferred fields via a class-level `DEFERRED_FIELDS: tuple[DeferredFieldSpec, ...]` attribute. The legacy `pathway_block_deferred_field` row-based spec table SHALL be retired as the spec source of truth.

#### Scenario: DeferredFieldSpec.attr must reference a real subclass field

- **GIVEN** a `BaseBlock` subclass declaring `DeferredFieldSpec(attr="nonexistent_field", ...)` in `DEFERRED_FIELDS`
- **WHEN** the publish-time validator runs against the subclass
- **THEN** validation fails with a `DeferredFieldAttrUnknownError`

### Requirement: Read API serialises typed discriminated union

The pathway read API (`GET /pathways/{id}` and `GET /pathways/{id}/blocks/{block_id}`) SHALL serialise blocks via a Pydantic v2 discriminated union keyed on `kind`. The OpenAPI schema SHALL surface the union.

#### Scenario: Block payload carries its kind discriminator and typed fields

- **GIVEN** chain slot #1 keeps the legacy `type` / `label` / `config`
  ORM columns alive alongside the new typed columns until slot #2
  retires them (per `proposal.md` storage section)
- **WHEN** a client requests `GET /pathways/{id}` for a pathway containing one `AppointmentBlock`
- **THEN** the response payload for that block has `kind="appointment"`, `location`, `scheduled_at`, and the other typed fields of `AppointmentBlock`
- **AND** the payload MAY also carry the legacy `type` / `label` /
  `config` envelope fields during the slot #1 transition so the
  builder UI keeps rendering kind-by-kind while migrating off
  `config` — those fields are dropped in chain slot #2 once every
  reader has migrated

### Requirement: Write API compat shim accepts legacy payload

The pathway write API (`POST/PATCH /pathways/{id}/blocks`) SHALL continue to accept the legacy `(type: str, config: dict)` payload during the chain slot #1 / #2 transition. The shim SHALL transform legacy payloads to typed subclass instances, dual-write to the new `pathway_block` table and the renamed `pathway_block_legacy` table, and surface validation errors using the typed subclass's schema.

#### Scenario: Legacy POST payload writes typed row

- **WHEN** a client `POST`s a block with `{"type": "appointment", "config": {"location": "Room 12"}}`
- **THEN** the shim writes a row to the new `pathway_block` table with `kind="appointment"` and `location="Room 12"`
- **AND** the shim writes the legacy row to `pathway_block_legacy`

#### Scenario: Typed payload opt-in via header skips the shim

- **WHEN** a client `POST`s a block with header `X-Pathway-Block-Shape: typed` and a payload matching the `AppointmentBlock` discriminated-union schema
- **THEN** the request is accepted directly without shim transformation
- **AND** the row is written to `pathway_block` with the typed fields

### Requirement: Lane-kind invariant enforced from class

The publish-time validator SHALL reject any block whose lane's `kind` is not in the block subclass's `allowed_lane_kinds` (renamed from `LANE_KINDS`) tuple.

#### Scenario: Block on disallowed lane rejected

- **GIVEN** `AppointmentBlock.allowed_lane_kinds = (LANE_KIND_CAREGIVER, LANE_KIND_PATIENT)`
- **WHEN** publish is attempted with an `AppointmentBlock` placed on a lane whose `kind = LANE_KIND_EXTERNAL`
- **THEN** publish is rejected with `LaneKindNotAllowedError` naming the block and the disallowed lane kind

