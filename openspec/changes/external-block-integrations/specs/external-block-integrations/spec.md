## ADDED Requirements

### Requirement: External block provider registry

The system SHALL persist registered external block providers in an `external_block_provider` table keyed by a kebab-case `code` (e.g. `luscii`) with `label`, `status` (`enabled`, `disabled`), and `capabilities_json` describing the block kinds the provider contributes. The API SHALL expose providers via `GET /external-block-providers`.

#### Scenario: Provider registry lists enabled Luscii provider

- **WHEN** a client calls `GET /external-block-providers`
- **THEN** the response contains an entry with `code='luscii'`, `status='enabled'`, and a `capabilities` array listing the single `program` kind

#### Scenario: Disabled provider is hidden from catalogue but present in registry

- **GIVEN** a provider row with `status='disabled'`
- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** no entry with `source='external'` and that provider's `code` is present
- **AND** `GET /external-block-providers` still returns the row with `status='disabled'`

### Requirement: Namespaced external block-type codes

The pathway block-type catalogue SHALL accept external entries whose `type` code uses the form `<provider>.<kind>` (lowercase, dotted) where `<provider>` matches an `external_block_provider.code` and `<kind>` matches one of the kinds declared in that provider's `capabilities_json`. Native block types SHALL continue to use bare codes without a dot.

#### Scenario: External code parses provider and kind

- **GIVEN** a catalogue entry with `type='luscii.program'`
- **WHEN** the backend parses the code
- **THEN** it resolves to `(source='external', provider='luscii', kind='program')`

#### Scenario: Unknown provider in code is rejected

- **WHEN** a client submits a `PUT /pathways/{id}` payload containing a block with `type='unknownvendor.thing'`
- **THEN** the server responds with HTTP 422
- **AND** the error payload identifies the unknown provider code

#### Scenario: Unknown kind for known provider is rejected

- **WHEN** a client submits a block with `type='luscii.questionnaire'`
- **THEN** the server responds with HTTP 422
- **AND** the error payload identifies the unknown kind for provider `luscii` and lists the valid kinds (`program`)

### Requirement: Catalogue surfaces external entries with provenance metadata

`GET /pathway-block-types` SHALL return external block entries alongside native ones. Every entry SHALL include `source` (`'native'` or `'external'`), and external entries SHALL additionally include non-null `provider` and `kind` fields. Native entries SHALL have `provider=null` and `kind=null`.

#### Scenario: Native entry has null provider and kind

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the entry with `type='appointment'` has `source='native'`, `provider=null`, `kind=null`

#### Scenario: External entry exposes provider and kind

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the entry with `type='luscii.program'` has `source='external'`, `provider='luscii'`, `kind='program'`

### Requirement: External block client Protocol

The system SHALL provide an `ExternalBlockClient` Protocol exposing `list_blocks(kind) -> list[ExternalBlockOption]`, `get_block_schema(kind) -> dict`, and `resolve_block(kind, ref) -> ExternalBlockResolution`. A factory `get_external_block_client(provider_code, settings) -> ExternalBlockClient` SHALL dispatch on the provider code; an unknown code SHALL raise `ExternalProviderNotRegisteredError`.

#### Scenario: Luscii stub client implements the Protocol

- **WHEN** `get_external_block_client('luscii', settings)` is called with `BACKEND_LUSCII_MODE='stub'`
- **THEN** it returns an instance of `LusciiStubClient`
- **AND** `await client.list_blocks('program')` returns a non-empty list of fixture program options

#### Scenario: Unknown provider raises typed error

- **WHEN** `get_external_block_client('nonexistent', settings)` is called
- **THEN** the function raises `ExternalProviderNotRegisteredError` naming the unknown code

### Requirement: Instance-level schema and option fetch endpoints

The API SHALL expose `GET /external-block-providers/{provider}/kinds/{kind}/schema` returning the JSON Schema for **author-time** instance configuration, and `GET /external-block-providers/{provider}/kinds/{kind}/options` returning the list of selectable references (e.g. program IDs and labels). Both endpoints SHALL delegate to the provider's adapter via the Protocol.

#### Scenario: Schema endpoint returns author-time JSON Schema for Luscii program

- **WHEN** a client calls `GET /external-block-providers/luscii/kinds/program/schema`
- **THEN** the response body is a JSON Schema object whose `properties` contains exactly `program_id` (string, required), `protocol_id` (string, required), and `mode` (string enum of `blocking`/`fire_and_forget`, required)
- **AND** the schema does NOT contain `patient_identifier_system` (org-level, not per-block)
- **AND** the schema does NOT contain `version_pin` (implicit in `program_id` — Luscii's API treats each version as a distinct program id)

#### Scenario: Options endpoint returns fixture programs in stub mode

- **GIVEN** `BACKEND_LUSCII_MODE='stub'`
- **WHEN** a client calls `GET /external-block-providers/luscii/kinds/program/options`
- **THEN** the response is an array of objects each with `ref` (string program id) and `label` (string program name)

### Requirement: Author-time block config_schema excludes per-patient fields

The JSON Schema returned by `get_block_schema(kind)` (and surfaced via `GET /external-block-providers/{provider}/kinds/{kind}/schema`) SHALL contain only **author-time** fields — selections, references, and policy toggles set by the pathway author at build time. It SHALL NOT contain fields that vary per enrolled patient (demographics, identifiers, contact info, per-patient clinical targets, per-patient measurement cadence, or any value that would differ between two patients enrolled into the same pathway version).

Per-patient values are captured at runtime via the vendor's enrollment surface (e.g. Luscii's `POST /v1/patients`) and are out of scope for the block config. A separate `enrollment_schema` contract MAY be introduced later for the caregiver-side enrollment dialog; it is not part of `config_schema`.

#### Scenario: Luscii program schema excludes per-patient fields

- **WHEN** a client calls `GET /external-block-providers/luscii/kinds/program/schema`
- **THEN** the returned JSON Schema's `properties` does NOT contain any of: `patient_id`, `patient_dob`, `patient_name`, `patient_email`, `patient_phone`, `patient_bsn`, `target_value`, `dose`, `measurement_frequency`

#### Scenario: Registration of a provider declaring per-patient fields is rejected

- **GIVEN** a provider seed whose `capabilities_json` for some kind declares a `config_schema.properties` containing a field whose name matches a known per-patient pattern (`patient_*`, `*_per_patient`, `target_*`, `dose*`)
- **WHEN** the registry loads the provider at startup
- **THEN** the registry SHALL raise `ProviderConfigSchemaScopeError` naming the offending field and the kind
- **AND** the provider SHALL NOT be served from `GET /external-block-providers`

### Requirement: External-block canvas visualization is a content-sized thumbnail of the program

External-block renderers MAY use a larger, richer canvas representation than the native block size. For the Luscii Program block specifically, the renderer SHALL render the block at a size that auto-scales with the resolved program's layout density, within a fixed range:

- **Minimum dimensions: 360×200** (when phase_count ≤ 2 AND lane_count ≤ 2, OR when no program is selected yet)
- **Maximum dimensions: 540×300** (when phase_count ≥ 5 AND lane_count ≥ 4)
- **Sizing rule:**
  - `width = clamp(360, 360 + 60 × max(0, phase_count - 2), 540)`
  - `height = clamp(200, 200 + 50 × max(0, lane_count - 2), 300)`

The block size SHALL be computed from `LusciiProgramData.layout` (phases + lanes counts), not from selection state. There is NO selected-state size toggle.

The outer chrome SHALL be identical at every size: rail, title-overlay glass chip, Luscii corner badge, meta-overlay chip. Only the inner SVG body density differs.

The block component SHALL accept the resolved program data as input and produce the computed-size rendering from it.

In **stub mode** (this change), the renderer SHALL emit a **fake placeholder visualization** — synthetic markers / shapes sized against the lane accent — because the stub adapter does not return real program-structure data. The fake SHALL occupy the same body slot, dimensions, and surrounding chrome (header + provider corner badge) that the live-mode renderer will use.

In **live mode** (future change), the renderer SHALL replace the fake with a real miniature derived from `resolve_block(program_id)` output — instruments, schedule, and milestones rendered at thumbnail scale. The header SHALL continue to show program name + protocol + mode + version-pin in both modes.

Program-internal text content (full instrument list with cadence, alert-threshold values, care network, CE marking) SHALL continue to be surfaced in the inspector's read-only Program contents card in both modes. The canvas thumbnail is a *visual summary*; the inspector is the authoritative read-only detail.

#### Scenario: Block size auto-scales with program layout density

- **GIVEN** a Luscii Program block whose resolved program layout has 2 phases and 2 lanes
- **WHEN** the orchestrator renders the block node
- **THEN** the rendered block is 360×200 (minimum)
- **GIVEN** a different block resolved to a program with 4 phases and 3 lanes
- **THEN** the rendered block is 480×250
- **GIVEN** a block resolved to a program with 6 phases and 5 lanes
- **THEN** the rendered block is 540×300 (clamped at maximum)

#### Scenario: Stub-mode Luscii block renders fake placeholder, not real program internals

- **GIVEN** the Luscii adapter is in stub mode and a Luscii Program block is placed on the canvas
- **WHEN** the orchestrator renders the block node
- **THEN** the rendered DOM contains a placeholder visual sized per the auto-scale rule (between 360×200 and 540×300) with synthetic markers / shapes (phase × lane miniature)
- **AND** the rendered DOM does NOT contain any real instrument names, real alert-threshold values, or real moment labels (because the stub does not return them as separate fields — they are only in the inspector card)
- **AND** the inspector's Program contents card, when the block is selected, shows the stub's synthetic summary as text

#### Scenario: Empty Luscii block (no program picked) renders honest CTA at minimum size

- **GIVEN** a Luscii Program block placed on the canvas whose `config.program_id` is null
- **WHEN** the orchestrator renders the block node
- **THEN** the rendered block is 360×200 (minimum, because there's no layout to scale from)
- **AND** the body of the block SHALL render a centered CTA text "Pick a Luscii program" with no fake pathway shapes (no nodes, no edges, no lane bands inside the SVG body)
- **AND** the title overlay SHALL read "Luscii Program · Pick one" (or i18n equivalent)
- **AND** clicking the body SHALL open the inspector's program picker focused

#### Scenario: Block component surface is stable across stub → live swap

- **GIVEN** the Luscii block component
- **WHEN** the renderer is migrated from stub data to live data (future change)
- **THEN** the outer block frame, header layout, header content fields (name, protocol, mode, version-pin), provider corner badge, and body-slot dimensions SHALL be unchanged
- **AND** only the inner body visualization SHALL switch from synthetic placeholder to data-driven rendering

### Requirement: Allowed lane kinds carry through from provider capabilities

Each external block kind SHALL declare `allowed_lane_kind_codes` in the provider's `capabilities_json`. Block-lane-snap validation SHALL apply the same way as for native blocks: a payload is rejected when the block's lane kind is not in the kind's allowed set.

#### Scenario: Luscii program is restricted to external lane

- **GIVEN** the `luscii.program` capability declares `allowed_lane_kind_codes=['external']`
- **WHEN** a client submits a payload placing a `luscii.program` block on a patient lane
- **THEN** the server responds with HTTP 422 (`BlockLaneNotAllowedError`)
- **AND** the error payload lists `external` as the only allowed lane kind
