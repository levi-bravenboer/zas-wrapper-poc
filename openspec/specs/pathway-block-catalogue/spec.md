# pathway-block-catalogue Specification

## Purpose
TBD - created by archiving change pathway-completion. Update Purpose after archive.
## Requirements
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

### Requirement: TreatmentBlock as the executed-procedure kind

The system SHALL model an executed clinical procedure as `TreatmentBlock` — `KIND="treatment"`, lane `caregiver`, fields `title` (required), `location`, `duration_minutes`, `notes` (SOP free-text; persisted as the `treatment_notes` column via the `<KIND>_<field>` mapper convention). The kind SHALL carry `RESULT_TYPE = TreatmentResult` with `{performed_at: datetime, notes: str | None, complications: str | None}`, validated at `complete_execution`. `input_logic` and `timing_policy` are both unrestricted.

#### Scenario: Treatment completion carries a typed result

- **GIVEN** an active `TreatmentBlock` execution
- **WHEN** the caregiver completes it with `{performed_at, notes, complications}`
- **THEN** the result validates against `TreatmentResult` and persists on `result_json`

#### Scenario: Treatment without title rejected at publish

- **WHEN** a pathway version containing a `TreatmentBlock` without `title` is published
- **THEN** publish fails with `BlockConfigError` on the block's title field

### Requirement: MdoBlock as the multi-disciplinary meeting kind

The system SHALL model a multi-disciplinair overleg as `MdoBlock` — `KIND="mdo"`, lane `caregiver`, fields `topic` (required) and `expected_attendees_note` (advisory free-text). The attendees model is exactly one leading caregiver (bound at runtime to `enrollment.assigned_caregiver_id`; NOT a template field) plus unlimited extra contributors. The class SHALL declare `EVENTS = ("contributed",)` and `RESULT_TYPE = MdoResult` with `{contributors: list[UUID], notes: str, closed_at: datetime}`. Completion is owned by the leading caregiver via `complete_execution` — no N-of-M gate.

#### Scenario: MDO topic required at publish

- **WHEN** a version containing an `MdoBlock` without `topic` is published
- **THEN** publish fails with `BlockConfigError`

#### Scenario: contributed is the only declarable MDO event

- **GIVEN** a downstream rule `event(mdo_block, "contributed")`
- **WHEN** the version is published
- **THEN** publish succeeds
- **AND** a rule naming any other event_type against the MDO is rejected

### Requirement: InformedConsentBlock as the two-actor consent kind

The system SHALL model patient consent as `InformedConsentBlock` — `KIND="informed_consent"`, lane `patient`, fields `questions` (FormQuestion list, default single yes/no "Ik geef toestemming", non-empty), `channels` (≥1 of email | sms | push | in_app, default `["email", "push"]`), `reminder_offset_iso` (ISO 8601, default `"P3D"`), `reminder_max` (0..10, default 3, spam-cap only — NOT a lifecycle gate), `expires_at_iso` (optional ISO 8601 duration from eligibility). `timing_policy` SHALL be rejected at publish (`InformedConsentShapeError`) — the lifecycle is owned by the per-kind fields. `RESULT_TYPE = InformedConsentResult` with `{consented, expired, signed_at, responses}` where `consented` and `expired` are mutually exclusive. Expiry completes the execution with `consented=false, expired=true` — NO new terminal state.

#### Scenario: Consent with timing_policy rejected

- **WHEN** a version whose `InformedConsentBlock` carries any `timing_policy` is published
- **THEN** publish fails with `BlockConfigError(field=blocks[<id>].timing_policy)`

#### Scenario: Unparseable reminder or expiry duration rejected

- **WHEN** `reminder_offset_iso` or `expires_at_iso` does not parse as an ISO 8601 duration
- **THEN** publish fails with `BlockConfigError` naming the field

#### Scenario: Result mutual exclusion

- **WHEN** a result with `consented=true` AND `expired=true` is constructed
- **THEN** validation fails

### Requirement: if_not_done_within SLA predicate

The `input_logic` rule set SHALL include `if_not_done_within(after_block: UUID, offset_iso: str)` — true when the referenced execution is NOT terminal (`completed` / `skipped`) AND `now >= sla_anchor + offset_iso`. `offset_iso` is an ISO 8601 duration sharing one grammar with `TimingPolicy`, including sub-day windows (`PT4H`) via `parse_iso_duration_timedelta`. The SLA anchor maps from `scheduled_at` until a dedicated `eligible_at` runtime column lands. Missing clock / anchor / execution SHALL evaluate to `False`. The publish gate SHALL reject rules whose `after_block` is not in the version or whose `offset_iso` does not parse.

#### Scenario: Window not yet expired

- **GIVEN** a rule `if_not_done_within(pathology, "P14D")` and 10 days elapsed
- **THEN** the rule evaluates to `False`

#### Scenario: Window expired and block still pending

- **GIVEN** the same rule and 16 days elapsed with the pathology block not terminal
- **THEN** the rule evaluates to `True`

#### Scenario: Window expired but block completed

- **GIVEN** the same rule, 16 days elapsed, pathology block `completed`
- **THEN** the rule evaluates to `False`

### Requirement: event predicate with per-kind EVENTS gate

The `input_logic` rule set SHALL include `event(after_block: UUID, event_type: str)`. The publish gate SHALL reject rules whose `event_type` is not declared in the referenced kind's class-level `EVENTS` tuple — no kind is silently usable as an event source. The evaluator matches recorded events via the producer's `produced["events"]` list (the contract the future event store hydrates); until the store lands the predicate is authorable but evaluates `False` at runtime.

#### Scenario: Undeclared event type rejected at publish

- **GIVEN** a rule `event(appointment_block, "measurement_out_of_bounds")` while `AppointmentBlock.EVENTS` lacks that type
- **WHEN** the version is published
- **THEN** publish fails with `BlockConfigError` naming the declared events

### Requirement: input_logic node references resolve within the version

Every `InputLogicRule.node` SHALL reference a block in the same pathway version, except `wait_after` rules whose `node` mirrors a time-marker id. The publish gate (`validate_input_logic_node_references`) SHALL reject dangling references with `BlockConfigError(field=blocks[<id>].input_logic.rules[i].node)` — the safety net under the builder's cascade-delete.

#### Scenario: Dangling reference rejected

- **GIVEN** a block whose rule references a deleted block id
- **WHEN** the version is published
- **THEN** publish fails naming the rule index

### Requirement: Dialog-driven builder authoring

The pathway builder SHALL author blocks exclusively through a dialog: clicking a palette tile opens the dialog in add mode (the block exists only after submit); clicking a canvas block opens the same dialog in edit mode hydrated from the typed envelope. The dialog SHALL carry name, phase picker, lane picker (only when the kind allows more than one lane kind), the per-kind config form, an `input_logic` rule composer (hidden for `start`), and a `timing_policy` editor (hidden for `start` / `end_pathway` / `informed_consent`). The canvas SHALL be read-only: no block dragging, no edge dragging, no drop targets.

#### Scenario: Add via dialog

- **WHEN** the author clicks a palette tile, fills the dialog, and submits "Voeg toe"
- **THEN** one `add-block` dispatch applies name + phase + lane + config + input_logic + timing_policy
- **AND** cancel leaves the version untouched

#### Scenario: Decision declares outputs in its dialog

- **GIVEN** the decision dialog
- **THEN** the author edits `question`, the typed `outputs` list, and `mode` (xor | and)
- **AND** downstream wiring happens on the downstream block's input_logic, never on the decision

### Requirement: Computed block layout

Block (x, y) SHALL be computed, never authored. Per (phase, lane) cell the canvas SHALL topologically sort blocks over rule-level `node` references (Kahn), assign columns left-to-right, stack branch fan-outs vertically per column, ignore cross-cell upstreams for column assignment, and place cycle remainders in a trailing column so no block is ever dropped. Lanes without blocks SHALL be hidden on the canvas while the dialog lane picker keeps the full lane list.

#### Scenario: Linear chain renders left-to-right

- **GIVEN** A ← B ← C wired via if_done in one cell
- **THEN** columns are A=0, B=1, C=2

#### Scenario: Decision fan-out stacks vertically

- **GIVEN** two blocks gated on the same decision
- **THEN** both render in the next column, stacked in creation order

### Requirement: Cascading block delete with confirmation

Deleting a block SHALL cascade within the concept version template: strip every other block's `input_logic.rules` entries referencing the deleted block, drop the block's `branches[]`, and drop derived edges touching it. The delete SHALL be reachable via a hover-X on the canvas node and via the edit dialog, both routing through a confirm dialog that enumerates the dependent blocks by name. Published versions and active runtime enrollments are never mutated.

#### Scenario: Cascade strips dependent rules

- **GIVEN** block B gated on block A via if_done
- **WHEN** the author confirms deleting A
- **THEN** A is gone and B's rule referencing A is stripped

#### Scenario: Confirm lists dependents

- **WHEN** the author clicks delete on a block with dependents
- **THEN** the confirm dialog names each dependent before anything is deleted

