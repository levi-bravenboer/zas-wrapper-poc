## ADDED Requirements

### Requirement: Namespaced external block-type codes

The pathway block-type catalogue SHALL accept external entries whose `type` code uses the form `<provider>.<kind>` (lowercase, dotted) where `<provider>` is a stable kebab/snake-case vendor identifier and `<kind>` is the vendor-defined kind code (e.g. `luscii.program`). Native block types SHALL continue to use bare codes without a dot.

The persisted `pathway_block.type` column SHALL enforce the lexical shape via a DB CHECK constraint matching `^[a-z_]+(\.[a-z_]+)?$`. Application-level validation SHALL continue to enforce that the parsed code resolves to an entry in the catalogue.

#### Scenario: External code parses provider and kind

- **GIVEN** a catalogue entry with `type='luscii.program'`
- **WHEN** the backend parses the code via `BlockTypeCode.parse`
- **THEN** it resolves to `(source='external', provider='luscii', kind='program')`

#### Scenario: Unknown code in payload is rejected at the catalogue layer

- **WHEN** a client submits a `PUT /pathways/{id}` payload containing a block with `type='unknownvendor.thing'`
- **THEN** the server responds with HTTP 422
- **AND** the error payload identifies the unknown block-type code

#### Scenario: Malformed type code is rejected at the DB layer

- **WHEN** a write bypassing the API attempts to insert `type='Luscii.Program'` (uppercase) or `type='luscii..program'`
- **THEN** the DB CHECK constraint rejects the row

### Requirement: Catalogue surfaces entries with provenance metadata

`GET /pathway-block-types` SHALL return external block entries alongside native ones. Every entry SHALL include `source` (`'native'` or `'external'`), and external entries SHALL additionally include non-null `provider` and `kind` fields. Native entries SHALL have `provider=null` and `kind=null`.

#### Scenario: Native entry has null provider and kind

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the entry with `type='appointment'` has `source='native'`, `provider=null`, `kind=null`

#### Scenario: Luscii program entry exposes provider and kind

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the response array contains exactly one entry with `type='luscii.program'`, `source='external'`, `provider='luscii'`, `kind='program'`
- **AND** that entry's `allowed_lane_kind_codes` equals `['external']`
- **AND** that entry's `semantics` equals `'external_program'`

### Requirement: Author-time block config schema excludes per-patient fields

External block catalogue entries SHALL declare a `config_schema` that contains only **author-time** fields — selections, references, and policy toggles set by the pathway author at build time. It SHALL NOT contain fields that vary per enrolled patient (demographics, identifiers, contact info, per-patient clinical targets, per-patient measurement cadence, or any value that would differ between two patients enrolled into the same pathway version).

Per-patient values are captured at runtime via the vendor's enrollment surface (e.g. Luscii's `POST /v1/patients`) and are out of scope for the block config.

#### Scenario: Luscii program config schema contains only author-time fields

- **WHEN** a client calls `GET /pathway-block-types` and inspects the `luscii.program` entry
- **THEN** its `config_schema.properties` contains exactly `program_id` (string, required), `protocol_id` (string, required), and `mode` (string enum of `blocking`/`fire_and_forget`, required)
- **AND** the schema does NOT contain `patient_identifier_system` (org-level, not per-block)
- **AND** the schema does NOT contain `version_pin` (implicit in `program_id` — Luscii's API treats each version as a distinct program id)
- **AND** the schema does NOT contain any per-patient field (`patient_*`, `target_*`, `dose*`, `*_per_patient`)

### Requirement: Luscii programs are served via per-vendor routes

The system SHALL expose two Luscii-specific HTTP routes that read program payloads from `app/adapters/luscii/programs.py` (a `# POC ONLY` static constant in stub mode; a real fetch + cache layer in a future live-adapter change):

- `GET /luscii/programs` — picker list. Returns an array of objects each carrying at least `id`, `name`, `version`, `description`, `enrolled_count_org_wide`.
- `GET /luscii/programs/{id}` — full payload. Returns a `LusciiProgramData` object covering program metadata, protocols, instruments, alert thresholds, care network, and layout.

The route shape SHALL stay unchanged across the stub → live transition.

#### Scenario: Picker route returns the synthetic stub programs

- **WHEN** a client calls `GET /luscii/programs`
- **THEN** the response is an array of at least one entry
- **AND** each entry carries `id` starting with `luscii-` (synthetic-id prefix)
- **AND** the entries are stably ordered

#### Scenario: Resolve route returns the full LusciiProgramData

- **GIVEN** a Luscii program with `id='luscii-hartfalen-monitoring-v4'`
- **WHEN** a client calls `GET /luscii/programs/luscii-hartfalen-monitoring-v4`
- **THEN** the response validates against `LusciiProgramData`
- **AND** the response includes non-empty `protocols`, `instruments`, `alert_thresholds`, and `layout`

#### Scenario: Resolve route on unknown id returns 404

- **WHEN** a client calls `GET /luscii/programs/does-not-exist`
- **THEN** the response status is 404 with an error envelope identifying the unknown id

### Requirement: External-block canvas visualization is a content-sized thumbnail of the program

External-block renderers MAY use a larger, richer canvas representation than the native block size. For the Luscii Program block specifically, the renderer SHALL render the block at a size that auto-scales with the resolved program's layout density, within a fixed range:

- **Minimum dimensions: 360×200** (when phase_count ≤ 2 AND lane_count ≤ 2, OR when no program is selected yet)
- **Maximum dimensions: 540×300** (when phase_count ≥ 5 AND lane_count ≥ 4)
- **Sizing rule:**
  - `width = clamp(360, 360 + 60 × max(0, phase_count - 2), 540)`
  - `height = clamp(200, 200 + 50 × max(0, lane_count - 2), 300)`

The block size SHALL be computed from `LusciiProgramData.layout` (phases + lanes counts), not from selection state. There is NO selected-state size toggle.

The outer chrome SHALL be identical at every size: rail, title-overlay glass chip, Luscii corner badge, meta-overlay chip. Only the inner SVG body density differs.

#### Scenario: Block size auto-scales with program layout density

- **GIVEN** a Luscii Program block whose resolved program layout has 2 phases and 2 lanes
- **WHEN** the orchestrator renders the block node
- **THEN** the rendered block is 360×200 (minimum)
- **GIVEN** a different block resolved to a program with 4 phases and 3 lanes
- **THEN** the rendered block is 480×250
- **GIVEN** a block resolved to a program with 6 phases and 5 lanes
- **THEN** the rendered block is 540×300 (clamped at maximum)

#### Scenario: Stub-mode Luscii block renders fake placeholder built from the program's layout

- **GIVEN** the Luscii routes are serving stub data and a Luscii Program block is placed on the canvas with `program_id='luscii-hartfalen-monitoring-v4'`
- **WHEN** the orchestrator renders the block node
- **THEN** the rendered DOM contains a placeholder visual sized per the auto-scale rule with synthetic markers / shapes derived from the program's `layout` (phase × lane × node structure)
- **AND** the rendered DOM does NOT contain any inspector-only text (instrument labels, alert threshold values, care-network description)
- **AND** the inspector's Program contents card, when the block is selected, shows the stub's synthetic summary as text

#### Scenario: Empty Luscii block (no program picked) renders honest CTA at minimum size

- **GIVEN** a Luscii Program block placed on the canvas whose `config.program_id` is null
- **WHEN** the orchestrator renders the block node
- **THEN** the rendered block is 360×200 (minimum, because there's no layout to scale from)
- **AND** the body of the block SHALL render a centered CTA text "Pick a Luscii program" with no fake pathway shapes
- **AND** the title overlay SHALL read "Luscii Program · Pick one" (or i18n equivalent)
- **AND** clicking the body SHALL open the inspector's program picker focused

#### Scenario: Block component surface is stable across stub → live swap

- **GIVEN** the Luscii block component
- **WHEN** the renderer is migrated from stub data to live data (future change)
- **THEN** the outer block frame, header layout, header content fields (name, protocol, mode), provider corner badge, and body-slot dimensions SHALL be unchanged
- **AND** only the inner body visualization SHALL switch from synthetic placeholder to data-driven rendering

### Requirement: Allowed lane kinds carry through from catalogue entry

Each block type SHALL declare `allowed_lane_kind_codes` in its catalogue entry. The `luscii.program` entry SHALL declare `allowed_lane_kind_codes=['external']`. Block-lane-snap validation SHALL apply the same way as for native blocks: a payload is rejected when the block's lane kind is not in the kind's allowed set.

#### Scenario: Luscii program is restricted to external lane

- **WHEN** a client submits a payload placing a `luscii.program` block on a patient lane
- **THEN** the server responds with HTTP 422 (`BlockLaneNotAllowedError`)
- **AND** the error payload lists `external` as the only allowed lane kind
