## ADDED Requirements

### Requirement: Temporal interprets the pinned pathway as the runtime

The runtime SHALL execute each enrollment as a single generic `PathwayEnrollmentWorkflow` on Temporal that interprets the **pinned** pathway version (blocks + input_logic + timing) loaded as data. The workflow SHALL hold authoritative execution state; the Postgres `pathway_block_execution` and `pathway_enrollment` rows SHALL be a read projection written only by activities. All I/O (load, materialize, project, audit, external calls) SHALL occur in activities, never in workflow code.

#### Scenario: Enrollment starts a workflow

- **WHEN** a patient is enrolled in a published pathway version
- **THEN** a `PathwayEnrollmentWorkflow` starts, loads that version via an activity, and writes the initial execution projection (start auto-fired, downstream evaluated)

#### Scenario: Pathway edits do not affect a running enrollment

- **GIVEN** an active enrollment pinned to version N
- **WHEN** the pathway is re-authored and version N+1 is published
- **THEN** the running workflow continues to interpret version N unchanged

### Requirement: Caregiver actions advance the workflow via Temporal Update

Caregiver actions (complete a step, pick a decision branch, book an appointment) SHALL reach the workflow as **Temporal Updates**: the action endpoint sends an Update, the workflow validates and advances, and the new authoritative state is returned in the response. Cancellation MAY use a Signal. The SQL projection SHALL be updated by activities and is read-eventually-consistent by other surfaces.

#### Scenario: Completing a step returns new state synchronously

- **WHEN** a caregiver completes an actionable block
- **THEN** the Update advances the execution, re-evaluates downstream eligibility, and the response contains the updated step states

#### Scenario: Invalid action is rejected by the workflow

- **WHEN** a caregiver tries to complete a block that is not actionable
- **THEN** the Update is rejected with a validation error and no state changes

### Requirement: Blocks materialize work primitives when actionable

When a block becomes actionable the runtime SHALL materialize the matching primitive: `appointment`, `treatment`, and `mdo` blocks SHALL create a real `Appointment` row linked via `appointments.pathway_block_instance_id` (kind: appointment→builder-selected, treatment→`procedure`, mdo→`other`; mdo uses the subject patient with caregiver-only participants); `task` blocks SHALL be projected into the `/tasks` aggregator through a new `pathway` source; `external_program` (Luscii) SHALL enroll the patient via `POST /v1/patients` (one program; see the Luscii requirement); `message` is mock (logged, no delivery). `start` and `end_pathway` SHALL materialize no primitive. People come from the block's **enroll-chosen caregiver(s)** for its care-team role-type: the chosen caregiver(s) SHALL be the Appointment participants (one `lead` + optional others) or the task assignee. **Materialization timing is not a fixed look-ahead window** — a block materializes when its own `input_logic` + `timing_policy` (evaluated against the enrollment's anchor + named clinical dates) make it eligible, which may be future-dated (`upcoming`); downstream of incomplete/branching blocks is not materialized until reached. Completing the primitive SHALL advance the block execution.

#### Scenario: Appointment block creates an Appointment

- **WHEN** an `appointment` block becomes actionable and is booked
- **THEN** an `Appointment` row exists with `pathway_block_instance_id` set, the selected kind, scheduled time, and participants, and it appears in the appointment task source

#### Scenario: Task block surfaces via the pathway source

- **WHEN** a `task` block becomes actionable
- **THEN** the `/tasks` inbox includes a `pathway`-source `TaskItem` for it, and completing that item advances the execution

#### Scenario: Clinical result lives on the execution, not the appointment

- **WHEN** a `treatment` block's appointment is fulfilled with notes/complications
- **THEN** the scheduling/status lives on the `Appointment` and the `{performed_at, notes, complications}` result is stored on the block execution `result_json`

### Requirement: external_program enrolls the patient in a Luscii program

When an `external_program` (Luscii) block becomes actionable, an activity SHALL ensure a Luscii connection and enroll the patient via `POST /v1/patients` (demographics + identifiers + `programId`/`protocolId`), reusing an existing Luscii patient if found. One program covers the patient's Luscii content (consent, questionnaires, measurements) **internally**; the pathway SHALL NOT model those as separate blocks. The pathway SHALL NOT auto-gate on Luscii completion in the PoC — where a downstream block needs Luscii pre-work verified, a caregiver `task` ("review Luscii data") gates it. Luscii reads (`GET /v1/measurements`, `/v1/alerts`) feed the existing patient-detail `MeasurementCharts` display, not an auto-gate. `end_pathway` SHALL leave the Luscii program running (no unenroll).

#### Scenario: Luscii block enrolls the patient

- **WHEN** the `external_program` block becomes actionable
- **THEN** the patient is enrolled in the configured Luscii program (connection ensured, `programId` set) and the block completes on successful enrollment

#### Scenario: Operation gated by a caregiver review task, not auto-read

- **GIVEN** an operation that needs Luscii pre-op data verified
- **WHEN** the caregiver marks the "review Luscii pre-op data" task done
- **THEN** the operation becomes eligible (the pathway does not auto-read Luscii to gate)

### Requirement: A subpath inlines into one pathway; a cross-pathway link is separate

A `subpath` SHALL be **inlined** at build time into the same pathway version — its blocks become ordinary blocks in **one** enrollment and **one** Temporal workflow (no nested child workflow). A `pathway_link` to a **separate** pathway (e.g. the oncology **bridge**) SHALL instead spawn a **fire-and-forget** child enrollment and not block the parent.

#### Scenario: Subpath blocks run in the parent workflow

- **GIVEN** a pathway using a subpath ("operate")
- **WHEN** it is enrolled
- **THEN** the subpath's blocks are ordinary executions in the single workflow — no separate child enrollment is created

#### Scenario: Bridge spawns a separate pathway

- **WHEN** the final decision selects "cancer treatment"
- **THEN** this pathway ends (`end_pathway`) and a fire-and-forget `pathway_link` starts the separate oncology pathway

### Requirement: Timing keys off named clinical-date anchors, including forward offsets

`timing_policy` SHALL support keying off a **named clinical-date anchor** (e.g. `operation_date`) in addition to node-completion, including **forward/negative offsets** (`operation_date − N days`) so pre-op work fires ahead of a planned date. A block MAY declare a **min-lead-time** to a named date (`≥ N days before <date>`); the enroll-time earliest-feasible suggestion SHALL combine these with blocking prerequisites. Editing a named clinical date (rebooking) SHALL recompute the dependent Temporal timers.

#### Scenario: Pre-op block fires N days before the operation date

- **GIVEN** a block timed `operation_date − 3 days`
- **WHEN** `operation_date` is set
- **THEN** the block becomes actionable 3 days before it; if the date is rebooked, the timer recomputes

### Requirement: Durable timers auto-advance timed steps

A block whose timing is relative (e.g. `wait_after` N days) SHALL set a Temporal timer; when the timer fires the step SHALL flip from `upcoming` to actionable automatically without a caregiver action. A step whose timing has not elapsed SHALL be `upcoming` (not actionable). Escalation-on-timeout is out of scope.

#### Scenario: Timed step becomes actionable when the timer fires

- **GIVEN** a block configured "5 days after block X"
- **WHEN** block X completes
- **THEN** the dependent step is `upcoming` with a ready date 5 days out, and becomes actionable automatically when the Temporal timer fires

### Requirement: Runtime evaluates the full trigger-predicate vocabulary

The workflow interpreter SHALL evaluate the full `input_logic` vocabulary to gate eligibility: `IF_DONE`, `DECISION_OUTPUT`, `HAS_DATA`, `VALUE_EQUALS`, `VALUE_GT`, and the timing predicates `WAIT_AFTER` and `IF_NOT_DONE_WITHIN`, combined by `all_of` / `any_of` (with optional `n_of_m`). Timing predicates SHALL be realized as **Temporal timers**: `WAIT_AFTER` delays eligibility; `IF_NOT_DONE_WITHIN` fires an escalation path when the referenced block is not done within the window. Data predicates SHALL read the upstream block's `result_json`; `DECISION_OUTPUT` SHALL read the chosen output key.

#### Scenario: WAIT_AFTER delays eligibility via a timer

- **GIVEN** a block gated `wait_after` 5 days of block X
- **WHEN** X completes
- **THEN** a Temporal timer holds the block `upcoming`, and it becomes actionable when the timer fires

#### Scenario: IF_NOT_DONE_WITHIN escalates on timeout

- **GIVEN** a block gated `if_not_done_within` N days of block X
- **WHEN** X is not completed within N days
- **THEN** the escalation timer fires and the gated path activates

#### Scenario: VALUE_EQUALS gates on an upstream result

- **GIVEN** a block gated `value_equals` on a `treatment` result field
- **WHEN** the treatment completes with a matching value
- **THEN** the gated block becomes eligible

### Requirement: Dead-path work is cancelled

When a `decision` prunes an `xor` branch, or an enrollment is cancelled, the workflow SHALL run cleanup activities so any already-materialized primitives on the dead path are withdrawn: their `Appointment` rows move to `cancelled` status and their `pathway`-source task items drop from the inbox.

#### Scenario: Pruned branch cancels its appointment

- **GIVEN** an `xor` decision with a materialized appointment on branch B
- **WHEN** the caregiver picks branch A
- **THEN** branch B is skipped and its appointment is moved to `cancelled`

### Requirement: Every transition emits an audit event via an activity

Each runtime state transition SHALL invoke an `emitAuditEvent` activity carrying `{enrollment, execution, block_kind, action, actor, payload, at}`. This change SHALL NOT build the event store; the activity is a hook to be wired into the forthcoming audit/event-logging system. The hook SHALL be present even for fake-log blocks that carry no real integration.

#### Scenario: Advancing a fake-log block still emits an audit event

- **WHEN** a caregiver advances a `message` block
- **THEN** the execution transitions and an `emitAuditEvent` activity is invoked for the transition
