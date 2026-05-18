# pathway-block-redesign Specification

## Purpose

Defines the pathway block-type catalogue (eight runtime semantics: `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`) plus the four edge timing kinds (`completion`, `marker`, `immediate`, `branch`) including marker offsets, the offset-direction lookup, and the Alembic migration that renamed `email`→`message` and dropped `timer`. Inspector forms for the new block types and the edge inspector UI are deferred to `pathway-config-forms`.

## Requirements
### Requirement: Block-type catalogue exposes runtime semantics and rendering hints

Every entry in the pathway block-type catalogue SHALL carry a non-empty `semantics` code from a fixed enum, an `icon` name string, and a `ui_schema` JSON object. The catalogue API SHALL serialize these fields alongside the existing `type`, `label`, `allowed_lane_kind_codes`, `supports_branches`, and `config_schema` properties.

#### Scenario: Catalogue response includes semantics, icon and ui_schema

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** every returned entry includes `semantics` (string equal to one of: `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`), `icon` (non-empty string), and `ui_schema` (object, possibly empty)

#### Scenario: ui_schema field order references only declared fields

- **GIVEN** a block-type entry whose `ui_schema.order` is present
- **THEN** every string in `ui_schema.order` SHALL exist as a key in `config_schema.properties`

### Requirement: Block roster matches clinical pathway primitives

The pathway block-type catalogue SHALL contain exactly the following types: `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`. The catalogue SHALL NOT contain `timer` or `email`.

#### Scenario: Catalogue lists the expected eight block types

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the response array contains exactly the codes `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`
- **AND** the codes `timer` and `email` are absent

#### Scenario: Message block accepts multiple channels

- **GIVEN** the catalogue entry `message`
- **THEN** its `config_schema.properties.channel.enum` contains exactly `email`, `sms`, `push`, `in_app`
- **AND** `channel`, `subject`, `body` are required fields
- **AND** `cta_label` and `cta_target` are optional fields

#### Scenario: Form block carries inline question definitions

- **GIVEN** the catalogue entry `form`
- **THEN** its `config_schema.properties.questions` is an array of objects
- **AND** each question object requires `id`, `type`, `label`, `required`
- **AND** `type` is one of `text`, `long_text`, `single_choice`, `multi_choice`, `scale`, `date`, `file`

#### Scenario: Wait block declares a closed event-type enum

- **GIVEN** the catalogue entry `wait`
- **THEN** its `config_schema.properties.event_type.enum` equals the codes returned by the event-type catalogue (`pathology_report`, `scan_report`, `lab_result`, `external_data`)
- **AND** `event_type` is required
- **AND** `timeout_days`, `on_timeout`, `source_block_id` are optional

#### Scenario: Pathway-link block requires target and mode

- **GIVEN** the catalogue entry `pathway_link`
- **THEN** its `config_schema.properties.target_pathway_id` requires a UUID
- **AND** its `config_schema.properties.mode.enum` contains exactly `blocking`, `fire_and_forget`
- **AND** both fields are required

### Requirement: Edge timing supports completion delays, marker offsets, branches, and immediate

A `pathway_edge` SHALL express its timing using at most one of three column groups: a completion delay (`delay_value_id`), a marker-anchored offset (`time_marker_id` + `offset_value_id` + `offset_direction_code`, all three set together), or a decision branch (`source_branch_id`). When none of those columns are set, the edge SHALL behave as an immediate transition.

#### Scenario: Edge with both delay and marker timing is rejected

- **WHEN** a client submits `PUT /pathways/{id}` with an edge that has `delay_value_id` set AND `time_marker_id` set
- **THEN** the server responds with HTTP 422
- **AND** the error payload identifies the offending `edge_id` and explains the timing-union violation

#### Scenario: Marker-anchored edge requires complete triple

- **WHEN** a client submits `PUT /pathways/{id}` with an edge that has `time_marker_id` set but null `offset_value_id` (or null `offset_direction_code`)
- **THEN** the server responds with HTTP 422
- **AND** the error payload identifies the offending `edge_id`

#### Scenario: Marker-anchored edge in the same version is accepted

- **GIVEN** a pathway version containing a `pathway_time_marker` with id `M` and a `pathway_timing_value` with id `V`
- **WHEN** a client submits `PUT /pathways/{id}` with an edge that has `time_marker_id=M`, `offset_value_id=V`, `offset_direction_code='before'`
- **THEN** the server responds with HTTP 200
- **AND** the persisted edge round-trips with those three values

#### Scenario: Marker from another pathway version is rejected

- **WHEN** a client submits an edge whose `time_marker_id` belongs to a different `pathway_version`
- **THEN** the server responds with HTTP 422
- **AND** the error indicates cross-version reference

#### Scenario: Immediate edge has no timing columns set

- **WHEN** a client submits an edge with `delay_value_id`, `time_marker_id`, and `source_branch_id` all null
- **THEN** the server responds with HTTP 200
- **AND** the edge is persisted as an immediate transition

### Requirement: Offset direction is a catalogued lookup

The pathway domain SHALL persist allowed offset directions in `pathway_edge_offset_direction` with rows `before` and `after`. The API SHALL expose these rows for client rendering.

#### Scenario: Offset-direction catalogue lists before and after

- **WHEN** a client calls `GET /pathway-edge-offset-directions`
- **THEN** the response contains exactly two entries with codes `before` (ord 10) and `after` (ord 20)
- **AND** each entry includes a Dutch `label`

#### Scenario: Edge with unknown offset direction is rejected

- **WHEN** a client submits an edge with `offset_direction_code='sideways'`
- **THEN** the server responds with HTTP 422 (FK / app-level lookup miss)
- **AND** the error identifies the offending edge

### Requirement: Edge timing kinds are discoverable

The API SHALL expose the four timing kinds (`completion`, `marker`, `immediate`, `branch`) with their per-kind JSON Schemas and UI hints so the builder can render one inspector per kind.

#### Scenario: Timing-kind catalogue lists four kinds

- **WHEN** a client calls `GET /pathway-edge-timing-kinds`
- **THEN** the response contains exactly four entries with kinds `completion`, `marker`, `immediate`, `branch`
- **AND** each entry exposes a `config_schema` and a `ui_schema`

### Requirement: Migration renames email to message and removes timer

The Alembic migration `pathway_block_redesign_and_edge_timing` SHALL rename all `pathway_block.type='email'` rows to `'message'` and SHALL delete all `pathway_block.type='timer'` rows, allowing edge rows with FK to deleted blocks to cascade through the existing `ondelete=CASCADE`. The migration SHALL be reversible for the rename (lossy for `timer` rows).

#### Scenario: Migration replaces email rows with message rows

- **GIVEN** a database with one `pathway_block` row where `type='email'`
- **WHEN** the migration runs forward
- **THEN** that row's `type` equals `'message'`
- **AND** the row's `config` (`subject`, `body`) is unchanged

#### Scenario: Migration deletes timer rows and cascades edges

- **GIVEN** a database with one `pathway_block` row where `type='timer'` and one `pathway_edge` referencing it as source
- **WHEN** the migration runs forward
- **THEN** the timer block row is absent
- **AND** the dependent edge row is absent (CASCADE)

#### Scenario: Downgrade reverses the rename

- **GIVEN** a forward-migrated database with `pathway_block.type='message'` rows
- **WHEN** the migration runs backward
- **THEN** those rows have `type='email'`
- **AND** the new edge timing columns, indexes, CHECK constraints, and `pathway_edge_offset_direction` table are absent

### Requirement: Allowed-lane mapping covers all new block types

Each new block type SHALL declare `allowed_lane_kind_codes` consistent with its semantics. The block-lane-snap rules SHALL accept payloads only when the block's lane kind appears in the type's allowed set.

#### Scenario: Form block is only allowed on patient lanes

- **GIVEN** the catalogue entry `form` with `allowed_lane_kind_codes=['patient']`
- **WHEN** a client submits a `PUT /pathways/{id}` payload containing a `form` block on a `caregiver` lane
- **THEN** the server responds with HTTP 422 (`BlockLaneNotAllowedError`)

#### Scenario: Wait and pathway-link blocks are only allowed on system lanes

- **GIVEN** the catalogue entries `wait` and `pathway_link` each with `allowed_lane_kind_codes=['system']`
- **WHEN** a client submits a payload placing either on a patient or caregiver lane
- **THEN** the server responds with HTTP 422 (`BlockLaneNotAllowedError`)

#### Scenario: Message block is patient-only

- **GIVEN** the catalogue entry `message` with `allowed_lane_kind_codes=['patient']`
- **WHEN** a client submits a payload placing a `message` on a caregiver lane
- **THEN** the server responds with HTTP 422 (`BlockLaneNotAllowedError`)

