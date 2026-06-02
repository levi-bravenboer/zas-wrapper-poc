## MODIFIED Requirements

### Requirement: Block-type catalogue exposes runtime semantics and rendering hints

Every entry in the pathway block-type catalogue SHALL carry a non-empty `semantics` code from a fixed enum, an `icon` name string, and a `ui_schema` JSON object. Every entry SHALL additionally carry a `source` field equal to `'native'` or `'external'`, and `provider` + `kind` fields (non-null only when `source='external'`). The catalogue API SHALL serialize these fields alongside the existing `type`, `label`, `allowed_lane_kind_codes`, `supports_branches`, and `config_schema` properties.

For external entries, the serialized `config_schema` SHALL describe author-time fields only (see `external-block-integrations` capability).

#### Scenario: Catalogue response includes semantics, icon, ui_schema, and source metadata

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** every returned entry includes `semantics` (string), `icon` (non-empty string), `ui_schema` (object), and `source` (`'native'` or `'external'`)
- **AND** every entry with `source='external'` has non-null `provider` and `kind` strings
- **AND** every entry with `source='native'` has `provider=null` and `kind=null`

#### Scenario: ui_schema field order references only declared fields

- **GIVEN** a block-type entry whose `ui_schema.order` is present
- **THEN** every string in `ui_schema.order` SHALL exist as a key in `config_schema.properties`

### Requirement: Block roster matches clinical pathway primitives

The pathway block-type catalogue SHALL contain at least the following native types: `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`. The catalogue SHALL NOT contain `timer` or `email` as native types. The catalogue MAY additionally contain external entries whose `type` code uses the dotted `<provider>.<kind>` form contributed by the `external_block_provider` registry.

#### Scenario: Catalogue lists the expected eight native block types

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the response array contains entries with codes `appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`, each with `source='native'`
- **AND** the codes `timer` and `email` are absent

#### Scenario: External Luscii program entry appears when provider is enabled

- **GIVEN** the `external_block_provider` row for `luscii` has `status='enabled'` with a `program` capability
- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the response array contains exactly one entry with `type='luscii.program'`, `source='external'`, `provider='luscii'`, `kind='program'`
- **AND** that entry's `allowed_lane_kind_codes` equals `['external']`

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

## ADDED Requirements

### Requirement: Block-type code accepts namespaced external form

The persisted `pathway_block.type` column SHALL accept either a bare native code (e.g. `appointment`) or a dotted external code matching `^[a-z_]+\.[a-z_]+$` (e.g. `luscii.program`). The DB CHECK constraint SHALL enforce the lexical shape; application-level validation SHALL enforce that the parsed `(provider, kind)` pair exists in the `external_block_provider` registry.

#### Scenario: Native bare code is accepted

- **WHEN** a client submits a `PUT /pathways/{id}` payload with a block `type='appointment'`
- **THEN** the server responds with HTTP 200 and the row persists with `type='appointment'`

#### Scenario: Registered external dotted code is accepted

- **GIVEN** the `luscii` provider with the `program` kind is enabled
- **WHEN** a client submits a payload with a block `type='luscii.program'`
- **THEN** the server responds with HTTP 200 and the row persists with `type='luscii.program'`

#### Scenario: Malformed type code is rejected at the DB layer

- **WHEN** a write bypassing the API attempts to insert `type='Luscii.Program'` (uppercase) or `type='luscii..program'`
- **THEN** the DB CHECK constraint rejects the row
