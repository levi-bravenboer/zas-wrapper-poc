# pathway-runtime-aggregate Specification

## Purpose
TBD - created by archiving change pathway-runtime-aggregate. Update Purpose after archive.
## Requirements
### Requirement: PathwayEnrollment carries anchor_date as single time reference

The system SHALL model a patient's entry into a pathway as a `pathway_enrollment` row keyed by `(patient_id, pathway_version_id)`. The row SHALL carry an `anchor_date` field that is the single reference point from which all relative `TimingPolicy` offsets compute. Enrollment state SHALL be one of `active`, `paused`, `completed`, `cancelled`.

#### Scenario: anchor_date drives scheduled_at for relative policies

- **GIVEN** an enrollment with `anchor_date = 2026-07-01`
- **AND** a block with `timing_policy = WaitAfterPolicy(offset="P5D")`
- **WHEN** the enrollment is created
- **THEN** the corresponding `BlockExecution.scheduled_at = 2026-07-06`

#### Scenario: Enrollment cannot activate while required deferred values missing

- **GIVEN** a pathway version where one block has a required `DeferredFieldSpec(attr="location", required=True)`
- **WHEN** `POST /enrollments` is called without supplying a value for `location`
- **THEN** the response is HTTP 422
- **AND** the error names the missing required deferred field

### Requirement: BlockExecution carries runtime-only fields, separate from template

The system SHALL persist per-enrollment per-block runtime state in `pathway_block_execution` rows. The row SHALL carry `scheduled_at`, `started_at`, `completed_at`, `due_at`, `state`, and `result_json`. The row SHALL NOT carry any field from the template (`timing_policy`, `input_logic`, typed subclass fields). State SHALL be one of `pending`, `eligible`, `active`, `completed`, `skipped`, `failed`.

#### Scenario: Result type validated against block subclass RESULT_TYPE

- **GIVEN** an `AppointmentBlock` execution in state `active` with `RESULT_TYPE = AppointmentResult({attended: bool, outcome_notes: str | None})`
- **WHEN** a client calls `:complete` with `result = {"foo": "bar"}`
- **THEN** the API responds with HTTP 422
- **AND** the row stays in state `active`

#### Scenario: State transitions follow the runtime state machine

- **GIVEN** an execution in state `pending`
- **WHEN** its `input_logic` rules first evaluate true under the current enrollment state
- **THEN** the execution transitions to `eligible`
- **AND** transitions to `active` only on an explicit `:start` call

### Requirement: at_enrollment_picked_date mirrors deferred value to scheduled_at

For blocks whose `timing_policy` is `AtEnrollmentPickedDatePolicy`, the date supplied as a deferred field value at enrollment time SHALL be persisted both to `pathway_deferred_field_value` (as the canonical authored value) and to `pathway_block_execution.scheduled_at` (as the queryable schedule target). This duplication SHALL be written once at enrollment creation and never recomputed.

#### Scenario: Picked date appears in both stores

- **GIVEN** a block `B` with `timing_policy = AtEnrollmentPickedDatePolicy()` and `DeferredFieldSpec(attr="scheduled_at", kind="datetime", required=True)`
- **WHEN** `POST /enrollments` supplies `scheduled_at = 2026-08-15T10:00Z` for block `B`
- **THEN** `pathway_deferred_field_value` has a row `(enrollment, B, "scheduled_at", "2026-08-15T10:00Z")`
- **AND** the `BlockExecution` for `(enrollment, B)` has `scheduled_at = 2026-08-15T10:00Z`

### Requirement: Runtime engine evaluates input_logic and drives transitions

The runtime engine SHALL provide `evaluate_eligibility(enrollment_id)`, `start(execution_id)`, `complete(execution_id, result)`, and `skip(execution_id, reason)` operations. `evaluate_eligibility` SHALL walk every execution in state `pending`, evaluate its block's `input_logic` rules using the closed `PredicateKind` evaluators, and transition matching executions to `eligible`. `complete` SHALL re-run `evaluate_eligibility` for the enclosing enrollment after writing the result.

#### Scenario: Completing a block triggers downstream eligibility

- **GIVEN** an enrollment with executions for blocks `A` (state `active`) and `B` (state `pending`, with `input_logic = [{node: "A", predicate: "if_done"}]`)
- **WHEN** `complete(A_execution_id, result)` is called
- **THEN** `A`'s execution transitions to `completed`
- **AND** `B`'s execution transitions to `eligible`

### Requirement: DecisionBlock XOR mode skips non-matching downstream branches

When a `DecisionBlock` with `mode="xor"` completes, the runtime engine SHALL identify the single matching `output_key`, transition downstream executions referencing that output to `eligible` per their `input_logic`, and transition downstream executions referencing other outputs to `skipped`.

#### Scenario: XOR decision skips the other branch

- **GIVEN** `DecisionBlock` `D` with `mode="xor"`, `outputs=("yes", "no")`
- **AND** downstream blocks `B_yes` (refs `output_key="yes"`) and `B_no` (refs `output_key="no"`)
- **WHEN** `D` completes with the predicate matching `"yes"`
- **THEN** `B_yes` transitions to `eligible`
- **AND** `B_no` transitions to `skipped`

