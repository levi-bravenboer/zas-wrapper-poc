## ADDED Requirements

### Requirement: StartBlock as the pathway entry kind

The system SHALL model the pathway entry block as `StartBlock` — a `BaseBlock` subclass with `KIND="start"`, `TYPE_CODE="start"`, `ICON="play"`, `allowed_lane_kinds=(LANE_KIND_SYSTEM,)`, no per-kind columns, and a CONFIG_SCHEMA that exposes only the inherited `name`. `StartBlock` SHALL be registered in `BLOCK_CLASSES` ahead of `AppointmentBlock` so the palette ordering surfaces it first, and SHALL be added to the read-API discriminated union (`StartBlockOut`) and the write-API union (`StartBlockIn`) alongside the lookup table entry under `"start"`.

#### Scenario: Catalogue projection includes start

- **WHEN** the block-type catalogue is queried
- **THEN** the response contains a row with `type="start"` and `semantics="start"`
- **AND** the row carries `LABEL`, `DESCRIPTION`, and `ICON="play"` sourced from `StartBlock`

#### Scenario: Read API serialises start via discriminated union

- **GIVEN** a pathway version containing a `StartBlock`
- **WHEN** the pathway is fetched via the read API
- **THEN** the block payload has `kind="start"` and round-trips through `StartBlockOut`

### Requirement: Exactly one StartBlock per pathway version

The publish-time validator SHALL reject any pathway version that contains zero or more than one `StartBlock`. Zero starts raises `StartBlockCardinalityError(count=0)`; two or more raises `StartBlockCardinalityError(count=N)`. The error SHALL surface from `PathwayVersionService` as a `BlockConfigError` keyed on the `blocks` field.

#### Scenario: Publishing without a start is rejected

- **GIVEN** a concept pathway version with no `StartBlock`
- **WHEN** the version is published
- **THEN** publish fails with `BlockConfigError(field="blocks")` whose reason names `StartBlockCardinalityError` count=0

#### Scenario: Publishing two starts is rejected

- **GIVEN** a concept pathway version with two `StartBlock` instances
- **WHEN** the version is published
- **THEN** publish fails with `BlockConfigError(field="blocks")` whose reason names `StartBlockCardinalityError` count=2

### Requirement: StartBlock carries no input_logic or timing_policy

The publish-time validator SHALL reject any `StartBlock` whose `input_logic.rules` is non-empty or whose `timing_policy` is not `None`. Both rejections raise `StartBlockShapeError(field=...)` and surface as `BlockConfigError` keyed on `blocks[<start_id>].<field>`.

#### Scenario: Start with input_logic is rejected

- **GIVEN** a pathway version whose `StartBlock` has a non-empty `input_logic.rules`
- **WHEN** the version is published
- **THEN** publish fails with `BlockConfigError(field="blocks[<id>].input_logic")` and `StartBlockShapeError(field="input_logic")`

#### Scenario: Start with timing_policy is rejected

- **GIVEN** a pathway version whose `StartBlock` has a non-null `timing_policy`
- **WHEN** the version is published
- **THEN** publish fails with `BlockConfigError(field="blocks[<id>].timing_policy")` and `StartBlockShapeError(field="timing_policy")`

### Requirement: StartBlock auto-fires at enrollment create

At enrollment create, `RuntimeEngine.auto_fire_starts` SHALL transition every `StartBlock` execution still in `state=pending` directly to `state=completed` with `started_at = completed_at = now`. The standard eligibility pass SHALL run immediately afterwards on the same execution set, so downstream blocks whose `input_logic.rules` reference the start with the `if_done` predicate become eligible in the same call. The pass SHALL be idempotent — non-pending starts are skipped — and SHALL not require any explicit "start" HTTP call against the runtime aggregate.

#### Scenario: Enrolling a patient lands the start at completed

- **GIVEN** a published pathway version containing a `StartBlock` and one downstream `AppointmentBlock` gated by `if_done(start)`
- **WHEN** a patient is enrolled
- **THEN** the `StartBlock` execution has `state=completed`, `started_at` and `completed_at` populated
- **AND** the downstream `AppointmentBlock` execution has `state=eligible`

#### Scenario: Re-running auto_fire_starts is a no-op

- **GIVEN** an enrollment whose `StartBlock` execution is already `completed`
- **WHEN** `auto_fire_starts` runs again
- **THEN** no execution state changes and the returned id list is empty

### Requirement: EndPathwayBlock as the pathway terminal kind

The system SHALL model the pathway terminal block as `EndPathwayBlock` — a `BaseBlock` subclass with `KIND="end_pathway"`, `TYPE_CODE="end_pathway"`, `ICON="stop"`, `allowed_lane_kinds=(LANE_KIND_SYSTEM,)`, no per-kind columns, and a CONFIG_SCHEMA that exposes only the inherited `name`. `EndPathwayBlock` SHALL be registered in `BLOCK_CLASSES`, added to the read-API discriminated union (`EndPathwayBlockOut`) and the write-API union (`EndPathwayBlockIn`), and to the kind lookup table under `"end_pathway"`. The wire kind uses snake-case `end_pathway` to align with `pathway_link` / `luscii_program`; the original catalogue note (`end-pathway`) is treated as a label-only convention.

#### Scenario: Catalogue projection includes end_pathway

- **WHEN** the block-type catalogue is queried
- **THEN** the response contains a row with `type="end_pathway"` and `semantics="end_pathway"`
- **AND** the row carries `LABEL`, `DESCRIPTION`, and `ICON="stop"` sourced from `EndPathwayBlock`

#### Scenario: Read API serialises end_pathway via discriminated union

- **GIVEN** a pathway version containing an `EndPathwayBlock`
- **WHEN** the pathway is fetched via the read API
- **THEN** the block payload has `kind="end_pathway"` and round-trips through `EndPathwayBlockOut`

### Requirement: At least one EndPathwayBlock per pathway version

The publish-time validator SHALL reject any pathway version that contains zero `EndPathwayBlock`s. Multiple terminals are explicitly allowed — each branch may carry its own terminal. The zero-end case raises `EndPathwayBlockMissingError` and surfaces from `PathwayVersionService` as a `BlockConfigError` keyed on the `blocks` field.

#### Scenario: Publishing without an end is rejected

- **GIVEN** a concept pathway version with no `EndPathwayBlock`
- **WHEN** the version is published
- **THEN** publish fails with `BlockConfigError(field="blocks")` whose reason names `EndPathwayBlockMissingError`

#### Scenario: Publishing with multiple ends is accepted

- **GIVEN** a concept pathway version with two `EndPathwayBlock` instances on distinct decision branches
- **WHEN** the version is published
- **THEN** publish succeeds and both terminals are persisted

### Requirement: EndPathwayBlock carries no timing_policy; input_logic is allowed

The publish-time validator SHALL reject any `EndPathwayBlock` whose `timing_policy` is not `None`, raising `EndPathwayBlockShapeError(field="timing_policy")` which surfaces as `BlockConfigError` keyed on `blocks[<end_id>].timing_policy`. The `input_logic` field is unrestricted — it is the author's responsibility to wire each terminal to its upstream gating predicate.

#### Scenario: End with timing_policy is rejected

- **GIVEN** a pathway version whose `EndPathwayBlock` has a non-null `timing_policy`
- **WHEN** the version is published
- **THEN** publish fails with `BlockConfigError(field="blocks[<id>].timing_policy")` and `EndPathwayBlockShapeError`

#### Scenario: End with input_logic is accepted

- **GIVEN** a pathway version whose `EndPathwayBlock` carries a non-empty `input_logic` referencing an upstream decision output
- **WHEN** the version is published
- **THEN** publish succeeds

### Requirement: EndPathwayBlock completion flips the enrollment terminal

When a `BlockExecution` whose template is an `EndPathwayBlock` transitions from `active` to `completed` via `EnrollmentService.complete_execution`, the enrollment SHALL transition `state="active" → "completed"`. The flip is idempotent: completing a second `EndPathwayBlock` on an already-`completed` enrollment SHALL NOT raise and SHALL leave the enrollment state untouched. The flip does NOT cascade through pending downstream blocks — engine fanout / eligibility passes are unchanged.

#### Scenario: First end completion flips enrollment

- **GIVEN** an active enrollment with one eligible `EndPathwayBlock` execution
- **WHEN** the caregiver completes that execution
- **THEN** the enrollment's `state` becomes `"completed"`
- **AND** the execution's `state` is `"completed"`

#### Scenario: Subsequent end completion is a no-op on enrollment state

- **GIVEN** an enrollment already in `state="completed"` after one terminal fired
- **WHEN** a second `EndPathwayBlock` execution is completed
- **THEN** the enrollment's `state` remains `"completed"` and no error is raised
