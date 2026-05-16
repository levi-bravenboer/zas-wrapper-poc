## ADDED Requirements

### Requirement: Pathway definition aggregate

The backend SHALL persist a pathway definition as an aggregate identified by a stable UUID. The aggregate root is the `pathway` row; child entities (`pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_block_branch`, `pathway_edge`, `pathway_time_marker`, `pathway_block_deferred_field`, `pathway_timing_value`) cascade-delete with the root. The aggregate SHALL hold a human-friendly `name`. Every aggregate table SHALL inherit `TenantOwnedEntity` (from `apps/backend/app/db/base.py`) so `id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at`, and audit FKs come from the base class. The pathway has no design-time entry block — execution start is picked at enrollment (F4, separate change). Concrete storage is relational with one purposeful jsonb (`pathway_block.config`) per Naming Conventions & Schema Exceptions in `design.md`.

#### Scenario: Persist and reload a pathway

- **WHEN** a client `POST`s a pathway with a name, two blocks, and one edge between them
- **THEN** the backend persists the aggregate
- **AND** a subsequent `GET /pathways/{id}` returns the full definition with the same blocks and edges

#### Scenario: Audit columns auto-stamped on save

- **WHEN** a client `POST`s or `PUT`s a pathway as user U on tenant T
- **THEN** newly inserted rows have `created_by = U`, `updated_by = U`, `tenant_id = T` (stamped by the `before_flush` audit hook)

#### Scenario: Soft delete hides the pathway from list

- **WHEN** a client calls `DELETE /pathways/{id}` followed by `GET /pathways`
- **THEN** the deleted pathway is not present in the response
- **AND** `deleted_at` is non-null on the underlying row

#### Scenario: Cascade delete clears all child rows

- **WHEN** a pathway with phases, lanes, blocks, branches, edges, time markers, and timing values is deleted
- **THEN** all child rows are soft-deleted with the same `deleted_at` timestamp (or removed if hard-delete is used)

### Requirement: Pathway REST surface

The backend SHALL expose REST endpoints for pathway-definition lifecycle under `/pathways`:

- `GET /pathways` — list pathway summaries (`id`, `name`, `updated_at`, `block_count`).
- `POST /pathways` — create an empty pathway and return its id.
- `GET /pathways/{id}` — return the full pathway definition (all child entities embedded).
- `PUT /pathways/{id}` — replace the pathway definition wholesale.
- `DELETE /pathways/{id}` — delete the pathway aggregate.

Endpoints SHALL follow the `openapi-contract` requirements: stable `operation_id`, declared response models, declared error responses, central router tag + prefix.

#### Scenario: List pathways returns summaries

- **WHEN** a client calls `GET /pathways` after creating two pathways
- **THEN** the response contains two summaries, each with `id`, `name`, `updated_at`, and `block_count`

#### Scenario: Replace pathway is wholesale

- **WHEN** a client calls `PUT /pathways/{id}` with a definition that drops a previously-present block
- **THEN** a subsequent `GET /pathways/{id}` no longer contains the dropped block or any edges that referenced it

#### Scenario: Delete pathway removes it

- **WHEN** a client calls `DELETE /pathways/{id}` followed by `GET /pathways/{id}`
- **THEN** the GET returns 404

### Requirement: Block-type catalogue

The backend SHALL expose `GET /pathways/blocks` returning the registry of available block types. Each entry SHALL include a stable `type` identifier (kebab-case), a human-readable `label`, a `default_lane_kind_code` (one of the seeded `pathway_lane_kind.code` values), and a JSON schema (`config_schema`) describing the block's configuration fields. The catalogue inlines the lane-kind `code` (a stable D10 identifier) rather than a UUID FK so the orchestrator does not need a second round-trip to resolve catalogue entries. The PoC registry SHALL include at minimum: `appointment`, `decision`, `milestone`, `timer`, `task`, and `email`. External-system blocks (e.g. a Luscii care-path reference) are deferred. The catalogue is owned by the backend; the orchestrator SHALL NOT hardcode block names or config shapes.

#### Scenario: Catalogue lists PoC block types

- **WHEN** a client calls `GET /pathways/blocks`
- **THEN** the response includes entries for `appointment`, `decision`, `milestone`, `timer`, `task`, and `email`
- **AND** each entry carries a `type`, `label`, `default_lane_kind_code`, and `config_schema`

#### Scenario: Pathway blocks validated against catalogue

- **WHEN** a client submits a pathway containing a block whose `type` is not present in the catalogue
- **THEN** the backend rejects the request with a 422 validation error citing the unknown block type

#### Scenario: Block config validated against per-type schema

- **WHEN** a client submits a block whose `config` does not conform to the block type's `config_schema`
- **THEN** the backend rejects the request with a 422 validation error citing the offending field path

### Requirement: Phase-template catalogue

The backend SHALL expose `GET /pathways/phase-templates` returning a registry of phase templates owned by code (per D14). Each entry SHALL include a stable `id`, a `label`, a `default_ord`, and an optional `default_duration_days`. The PoC registry SHALL include at minimum the chapters used by the seeded Rugrevalidatie pathway (e.g. `pre-op`, `surgery`, `recovery`, `follow-up`). `pathway_phase.template_id` is a soft pointer (no FK constraint) so renaming or removing a template does not break existing pathways.

#### Scenario: Catalogue lists PoC phase templates

- **WHEN** a client calls `GET /pathways/phase-templates`
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

The backend SHALL persist phases as `pathway_phase` rows ordered by `ord` and unique within `(pathway_id, ord)`. A phase SHALL carry a `label` and an optional `template_id` (soft pointer to the phase-template catalogue, no FK constraint). Phases in PoC are decorative — no duration, no anchor event, no runtime date math (deferred per D11 / Open Questions). Every `pathway_block` SHALL reference exactly one `pathway_phase` via `phase_id` (NOT NULL). Phases are NOT navigable canvases; cross-phase edges (including loopbacks to lower-`ord` phases) are ordinary `pathway_edge` rows whose target block sits in a different phase.

#### Scenario: Loopback edge accepted across phases

- **WHEN** a pathway is saved with an edge whose source block is in a phase of `ord = 3` and target block is in a phase of `ord = 1`
- **THEN** the backend persists the edge with no special flag
- **AND** `GET /pathways/{id}` returns the same edge

#### Scenario: Reject block referencing a phase from another pathway

- **WHEN** a client submits a block whose `phase_id` belongs to a different pathway
- **THEN** the backend rejects the request with a 422 validation error

### Requirement: Timing value table

The backend SHALL persist all timing as rows in a shared `pathway_timing_value` table with a `kind` discriminator constrained to `fixed | enrollment` (PoC) and CHECK constraints enforcing exactly the columns appropriate for the chosen kind:

- `fixed` — `fixed_days` NOT NULL, enrollment columns NULL.
- `enrollment` — `enrollment_default_days` NOT NULL, optional `enrollment_min_days`/`enrollment_max_days`, `fixed_days` NULL.

A third kind (`runtime`, where a value reads an upstream block's output at execution) is parked in `openspec/scope.md` F3 MVP delta and added when F5/F6 runtime engine lands. `pathway_block.duration_value_id` and `pathway_edge.delay_value_id` SHALL be nullable FKs to this table; NULL means "instant" / "no delay" respectively. The backend SHALL NOT store timing as JSON.

#### Scenario: Fixed timing round-trips

- **WHEN** a pathway is saved with a block whose duration is `{ kind: "fixed", days: 3 }`
- **THEN** the backend persists a `pathway_timing_value` with `kind='fixed'`, `fixed_days=3`
- **AND** `GET /pathways/{id}` returns the same shape for that block's duration

#### Scenario: Enrollment timing with bounds round-trips

- **WHEN** a pathway is saved with an edge whose delay is `{ kind: "enrollment", default: 2, min: 0, max: 7 }`
- **THEN** the backend persists a `pathway_timing_value` with `enrollment_default_days=2`, `enrollment_min_days=0`, `enrollment_max_days=7`
- **AND** `GET /pathways/{id}` returns the same shape for that edge's delay

#### Scenario: Reject contradictory timing kind

- **WHEN** a client submits a `pathway_timing_value` with `kind='fixed'` and a non-null `enrollment_default_days`
- **THEN** the backend rejects the request (DB CHECK violation surfaced as 422)

#### Scenario: Reject unknown timing kind

- **WHEN** a client submits a `pathway_timing_value` with `kind='runtime'`
- **THEN** the backend rejects the request with a 422 (kind not supported in PoC)

### Requirement: Branches and edges

The backend SHALL persist decision-block branches as first-class `pathway_block_branch` rows scoped to the owning block, ordered by `ord`. `pathway_edge` SHALL reference `source_block_id`, `target_block_id`, and an OPTIONAL `source_branch_id` (NULL for non-branching sources). The backend SHALL reject edges whose `source_branch_id` is set but does not belong to `source_block_id`. `pathway_block_branch` rows SHALL be permitted only on blocks whose catalogue entry advertises branching support (PoC: hard-coded check against `decision`; future block-type catalogue entries declare a `supports_branches` flag). `pathway_edge` SHALL enforce `UNIQUE (source_block_id, target_block_id, source_branch_id) NULLS NOT DISTINCT` so duplicate connectors are rejected at the DB layer; the builder UI MUST also prevent duplicate-edge creation to surface the conflict before save.

#### Scenario: Branching edge persisted with branch reference

- **WHEN** a decision block has two branches and the pathway is saved with two edges, each pointing at one of the branches
- **THEN** `GET /pathways/{id}` returns both edges with the matching `source_branch_id`

#### Scenario: Reject mismatched branch on edge

- **WHEN** a client submits an edge whose `source_branch_id` belongs to a different block
- **THEN** the backend rejects the request with a 422 validation error

#### Scenario: Reject branch on non-branching block

- **WHEN** a client submits a `pathway_block_branch` whose `block_id` references a block of a type that does not support branching (e.g. `appointment`)
- **THEN** the backend rejects the request with a 422 validation error citing the block type

#### Scenario: Reject duplicate edge between same source/branch/target

- **WHEN** a client submits two edges with the same `source_block_id`, `target_block_id`, and `source_branch_id` (including both NULL)
- **THEN** the backend rejects the second edge with a 422 validation error (UNIQUE violation surfaced)

### Requirement: Time markers

The backend SHALL persist optional `pathway_time_marker` rows for visual day markers on the canvas (e.g. "+1d", "+30d"). Each marker SHALL belong to a pathway, carry a `value_id` FK to `pathway_timing_value` and a `label`. Markers are presentation aids only and do not influence routing.

#### Scenario: Time marker round-trips

- **WHEN** a pathway is saved with one time marker labelled `Surgery + 30d` referencing a fixed timing value
- **THEN** `GET /pathways/{id}` returns the marker with the same label and timing value

### Requirement: Block deferred fields (filled at enrollment)

The backend SHALL persist `pathway_block_deferred_field` rows as `(block_id, field_path)`. A row marks that `field_path` (must exist in the block's `config_schema`) is filled at enrollment time rather than design time. Runtime-resolved fields are deferred to MVP together with the runtime timing kind. The backend SHALL reject rows whose `field_path` does not exist in the block's `config_schema`.

#### Scenario: Enrollment-deferred field persisted

- **WHEN** a pathway is saved with a block whose `config_schema` defines a `recipient_email` field and a field-resolution row marking `recipient_email`
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

### Requirement: External-system blocks remain reference-only

The PoC catalogue contains no external-system blocks. If/when external-system blocks (e.g. a Luscii care-path reference, FHIR pulls, HiX tasks) are reintroduced, they SHALL carry NO external-system–specific column or table. Their catalogue `config_schema` SHALL define reference fields only (IDs and optional URLs) — never the upstream payload itself. The backend SHALL validate the reference shape via the catalogue's `config_schema` like any other block type and SHALL NOT fetch, parse, or mirror upstream clinical content.
