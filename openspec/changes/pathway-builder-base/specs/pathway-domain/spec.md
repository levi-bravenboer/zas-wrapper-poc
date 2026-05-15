## ADDED Requirements

### Requirement: Pathway definition aggregate

The backend SHALL persist a pathway definition as an aggregate identified by a stable UUID. The aggregate root is the `pathway` row; child entities (`pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_branch`, `pathway_edge`, `pathway_time_marker`, `pathway_block_field_resolution`, `pathway_block_luscii_extension`) cascade-delete with the root. The aggregate SHALL hold a human-friendly `name` and an `entry_block_id` FK to a row in `pathway_block` belonging to the same pathway. Concrete storage is relational with one purposeful jsonb (`pathway_block.config`) per Naming Conventions & Schema Exceptions in `design.md`.

#### Scenario: Persist and reload a pathway

- **WHEN** a client `POST`s a pathway with a name, two blocks, one edge between them, and an entry block id
- **THEN** the backend persists the aggregate
- **AND** a subsequent `GET /pathways/{id}` returns the full definition with the same blocks, edges, and entry block id

#### Scenario: Reject pathway without an entry block

- **WHEN** a client submits a pathway whose `entry_block_id` does not reference any block in the aggregate
- **THEN** the backend rejects the request with a 422 validation error citing the missing entry block

#### Scenario: Cascade delete clears all child rows

- **WHEN** a client `DELETE`s a pathway with phases, lanes, blocks, branches, edges, and time markers
- **THEN** all child rows are removed in the same transaction
- **AND** any `pathway_timing_value` rows referenced only by that pathway are eligible for cleanup

### Requirement: Pathway REST surface

The backend SHALL expose REST endpoints for pathway-definition lifecycle under `/pathways`:

- `GET /pathways` — list pathway summaries (`id`, `name`, `last_edited_at`, `block_count`).
- `POST /pathways` — create an empty pathway and return its id.
- `GET /pathways/{id}` — return the full pathway definition (all child entities embedded).
- `PUT /pathways/{id}` — replace the pathway definition wholesale.
- `DELETE /pathways/{id}` — delete the pathway aggregate.

Endpoints SHALL follow the `openapi-contract` requirements: stable `operation_id`, declared response models, declared error responses, central router tag + prefix.

#### Scenario: List pathways returns summaries

- **WHEN** a client calls `GET /pathways` after creating two pathways
- **THEN** the response contains two summaries, each with `id`, `name`, `last_edited_at`, and `block_count`

#### Scenario: Replace pathway is wholesale

- **WHEN** a client calls `PUT /pathways/{id}` with a definition that drops a previously-present block
- **THEN** a subsequent `GET /pathways/{id}` no longer contains the dropped block or any edges that referenced it

#### Scenario: Delete pathway removes it

- **WHEN** a client calls `DELETE /pathways/{id}` followed by `GET /pathways/{id}`
- **THEN** the GET returns 404

### Requirement: Block-type catalogue

The backend SHALL expose `GET /pathway-blocks` returning the registry of available block types. Each entry SHALL include a stable `type` identifier (kebab-case), a human-readable `label`, a `default_lane_kind_id` referencing `pathway_lane_kind`, and a JSON schema (`config_schema`) describing the block's configuration fields. The PoC registry SHALL include at minimum: `appointment`, `decision`, `milestone`, `timer`, and `luscii-clinical-path`. The catalogue is owned by the backend; the orchestrator SHALL NOT hardcode block names or config shapes.

#### Scenario: Catalogue lists PoC block types

- **WHEN** a client calls `GET /pathway-blocks`
- **THEN** the response includes entries for `appointment`, `decision`, `milestone`, `timer`, and `luscii-clinical-path`
- **AND** each entry carries a `type`, `label`, `default_lane_kind_id`, and `config_schema`

#### Scenario: Pathway blocks validated against catalogue

- **WHEN** a client submits a pathway containing a block whose `type` is not present in the catalogue
- **THEN** the backend rejects the request with a 422 validation error citing the unknown block type

#### Scenario: Block config validated against per-type schema

- **WHEN** a client submits a block whose `config` does not conform to the block type's `config_schema`
- **THEN** the backend rejects the request with a 422 validation error citing the offending field path

### Requirement: Phase-template catalogue

The backend SHALL expose `GET /pathway-phase-templates` returning a registry of phase templates owned by code (per D14). Each entry SHALL include a stable `id`, a `label`, a `default_ord`, and an optional `default_duration_days`. The PoC registry SHALL include at minimum the chapters used by the seeded Rugrevalidatie pathway (e.g. `pre-op`, `surgery`, `recovery`, `follow-up`). `pathway_phase.template_id` is a soft pointer (no FK constraint) so renaming or removing a template does not break existing pathways.

#### Scenario: Catalogue lists PoC phase templates

- **WHEN** a client calls `GET /pathway-phase-templates`
- **THEN** the response includes the seeded Rugrevalidatie chapters with `id`, `label`, `default_ord`, and `default_duration_days`

#### Scenario: Custom phase has NULL template_id

- **WHEN** a pathway is saved with a phase whose `template_id` is omitted
- **THEN** the persisted `pathway_phase` row has `template_id = NULL`
- **AND** subsequent `GET /pathways/{id}` returns the phase with no `template_id`

### Requirement: Lane two-table model

The backend SHALL persist lanes as two tables per D10:

- `pathway_lane_kind` — system catalogue, seeded migration with at minimum `patient`, `caregiver`, `system`, `external`.
- `pathway_lane` — per-pathway lane instance, FK `pathway_lane_kind_id`, with `label`, `ord`, and `is_default` flag.

Every `pathway_block` SHALL reference exactly one `pathway_lane` via `lane_id` (NOT NULL). Default lanes are materialized on first block placement of a given kind; custom lanes are added by the author. Within one pathway, `(pathway_id, ord)` SHALL be unique on `pathway_lane`.

#### Scenario: Default lane materialized on first block of that kind

- **WHEN** a pathway is saved with the first block of `default_lane_kind = 'system'` and no `pathway_lane` row of that kind exists
- **THEN** the backend creates a `pathway_lane` with `pathway_lane_kind_id = 'system'`, `is_default = true`, and assigns the block to it

#### Scenario: Custom lane override persisted

- **WHEN** a pathway is saved with a `pathway_lane` of kind `caregiver` and label `Apotheek` (`is_default = false`)
- **AND** a block points its `lane_id` at that lane
- **THEN** `GET /pathways/{id}` returns the lane with the custom label and the block assigned to it

#### Scenario: Reject block without lane

- **WHEN** a client submits a block with `lane_id = null`
- **THEN** the backend rejects the request with a 422 validation error

### Requirement: Phases per pathway

The backend SHALL persist phases as `pathway_phase` rows ordered by `ord` and unique within `(pathway_id, ord)`. A phase SHALL carry a `label`, an optional `template_id` (soft pointer to the phase-template catalogue), and an optional `duration_value_id` FK to `pathway_timing_value`. Every `pathway_block` SHALL reference exactly one `pathway_phase` via `phase_id` (NOT NULL). Phases are NOT navigable canvases; cross-phase edges (including loopbacks to lower-`ord` phases) are ordinary `pathway_edge` rows whose target block sits in a different phase.

#### Scenario: Loopback edge accepted across phases

- **WHEN** a pathway is saved with an edge whose source block is in a phase of `ord = 3` and target block is in a phase of `ord = 1`
- **THEN** the backend persists the edge with no special flag
- **AND** `GET /pathways/{id}` returns the same edge

#### Scenario: Reject block referencing a phase from another pathway

- **WHEN** a client submits a block whose `phase_id` belongs to a different pathway
- **THEN** the backend rejects the request with a 422 validation error

### Requirement: Timing value table

The backend SHALL persist all timing as rows in a shared `pathway_timing_value` table with a `kind` discriminator constrained to `fixed | enrollment | runtime` and CHECK constraints enforcing exactly the columns appropriate for the chosen kind:

- `fixed` — `fixed_days` NOT NULL, others NULL.
- `enrollment` — `enrollment_default_days` NOT NULL, optional `enrollment_min_days`/`enrollment_max_days`, others NULL.
- `runtime` — `runtime_source_block_id` NOT NULL, `runtime_source_output` NOT NULL, others NULL.

`pathway_block.duration_value_id` and `pathway_edge.delay_value_id` SHALL be nullable FKs to this table; NULL means "instant" / "no delay" respectively. The backend SHALL NOT store timing as JSON.

#### Scenario: Fixed timing round-trips

- **WHEN** a pathway is saved with a block whose duration is `{ kind: "fixed", days: 3 }`
- **THEN** the backend persists a `pathway_timing_value` with `kind='fixed'`, `fixed_days=3`
- **AND** `GET /pathways/{id}` returns the same shape for that block's duration

#### Scenario: Enrollment timing with bounds round-trips

- **WHEN** a pathway is saved with an edge whose delay is `{ kind: "enrollment", default: 2, min: 0, max: 7 }`
- **THEN** the backend persists a `pathway_timing_value` with `enrollment_default_days=2`, `enrollment_min_days=0`, `enrollment_max_days=7`
- **AND** `GET /pathways/{id}` returns the same shape for that edge's delay

#### Scenario: Runtime timing references an upstream block

- **WHEN** a pathway is saved with a block whose duration is `{ kind: "runtime", source_block_id: <uuid>, source_output: "duration_days" }` and the referenced block exists in the same pathway
- **THEN** the backend persists a `pathway_timing_value` of kind `runtime`
- **AND** rejects the request with a 422 if `source_block_id` does not reference a block in the same pathway

#### Scenario: Reject contradictory timing kind

- **WHEN** a client submits a `pathway_timing_value` with `kind='fixed'` and a non-null `runtime_source_block_id`
- **THEN** the backend rejects the request (DB CHECK violation surfaced as 422)

### Requirement: Branches and edges

The backend SHALL persist decision-block branches as first-class `pathway_branch` rows scoped to the owning block, ordered by `ord`. `pathway_edge` SHALL reference `source_block_id`, `target_block_id`, and an OPTIONAL `source_branch_id` (NULL for non-branching sources). The backend SHALL reject edges whose `source_branch_id` is set but does not belong to `source_block_id`.

#### Scenario: Branching edge persisted with branch reference

- **WHEN** a decision block has two branches and the pathway is saved with two edges, each pointing at one of the branches
- **THEN** `GET /pathways/{id}` returns both edges with the matching `source_branch_id`

#### Scenario: Reject mismatched branch on edge

- **WHEN** a client submits an edge whose `source_branch_id` belongs to a different block
- **THEN** the backend rejects the request with a 422 validation error

### Requirement: Time markers

The backend SHALL persist optional `pathway_time_marker` rows for visual day markers on the canvas (e.g. "+1d", "+30d"). Each marker SHALL belong to a pathway, carry a `value_id` FK to `pathway_timing_value` and a `label`. Markers are presentation aids only and do not influence routing.

#### Scenario: Time marker round-trips

- **WHEN** a pathway is saved with one time marker labelled `Surgery + 30d` referencing a fixed timing value
- **THEN** `GET /pathways/{id}` returns the marker with the same label and timing value

### Requirement: Block field resolution

The backend SHALL persist per-block field-resolution overrides as `pathway_block_field_resolution` rows: `(block_id, field_path, source_kind, source_block_id?, source_output?)`. This table records which `config` fields (per the block's `config_schema`) are filled at enrollment vs runtime instead of at design time. The backend SHALL reject rows whose `field_path` does not exist in the block's `config_schema`.

#### Scenario: Field-resolution override persisted

- **WHEN** a pathway is saved with a block whose `config_schema` defines a `recipient_email` field and a field-resolution row marking `recipient_email` as `source_kind = 'enrollment'`
- **THEN** `GET /pathways/{id}` returns the override

#### Scenario: Reject override on unknown field

- **WHEN** a client submits a field-resolution row whose `field_path` is not present in the block's `config_schema`
- **THEN** the backend rejects the request with a 422 validation error

### Requirement: Saved pathway is enrollable

The backend SHALL treat any persisted pathway definition as enrollable. There SHALL be no separate publish step or draft/published distinction in the PoC. Versioning, audit trail, and publish workflow are out of scope and tracked under MVP delta.

#### Scenario: Saved pathway is immediately listable as enrollable

- **WHEN** a pathway is created and saved via `POST /pathways` followed by `PUT /pathways/{id}`
- **THEN** the pathway appears in `GET /pathways` with no draft/published flag
- **AND** there is no `publish` endpoint exposed

### Requirement: Luscii clinical-path block is opaque

The `luscii-clinical-path` block SHALL store its opaque payload in a dedicated `pathway_block_luscii_extension` table (one row per Luscii block) with the payload as `text` (NOT jsonb). The backend SHALL NOT interpret, evaluate, or transform the payload. Live Luscii Builder API integration is out of PoC scope.

#### Scenario: Luscii block round-trips byte-equivalent

- **WHEN** a pathway is saved with a `luscii-clinical-path` block whose extension payload is an arbitrary string
- **THEN** `GET /pathways/{id}` returns the same payload byte-for-byte for that block
