## ADDED Requirements

### Requirement: Caregiver enrolls a patient into a published pathway version

A caregiver on the patient's care team SHALL enroll the patient into a **published** pathway version from the patient page. Enrollment SHALL capture an **anchor date** (day-0; defaults to today, editable), any **named clinical dates** the pathway declares (e.g. `operation_date`) — pre-filled with the system's **earliest-feasible** suggestion (from blocking prerequisites + per-block min-lead-times) and editable — and the **enroll-phase deferred values** from the pathway's deferred-field descriptor. The descriptor SHALL be built over the **fully-flattened** block set (including blocks inlined by any subpath). The enrollment SHALL be **pinned** to that version. Submitting SHALL create the enrollment via the existing `POST /enrollments` and start its runtime workflow.

#### Scenario: Successful enrollment

- **WHEN** a care-team caregiver enrolls a patient in a published version with the required deferred values and an anchor date
- **THEN** an enrollment is created pinned to that version, its workflow starts, and the patient's Pathway tab shows the first steps

#### Scenario: Missing required deferred value blocks enrollment

- **WHEN** the caregiver submits without a required enroll-phase value
- **THEN** enrollment is rejected with a validation error naming the missing field, and no enrollment is created

#### Scenario: Only published versions are enrollable

- **WHEN** the caregiver opens the pathway picker
- **THEN** only published versions are selectable; concept/draft versions are not offered

#### Scenario: Named clinical date is suggested and editable

- **GIVEN** a pathway declaring `operation_date` with blocking prereqs + min-lead-times
- **WHEN** the caregiver reaches that field at enroll
- **THEN** it is pre-filled with the earliest feasible date and the caregiver may push it later (not earlier than feasible)

### Requirement: Enrollment resolves each block's participant to a Practitioner

Each materializing block declares a FHIR `action.participant` (role code + optional specialty). At enrollment the caregiver SHALL **resolve each block's participant to an actual `Practitioner`** by filtering the patient's **`CareTeam`** members / practitioners matching that role + specialty — **one or several** (e.g. an `mdo` has multiple participants). A resolved practitioner SHALL be recorded as a **`CareTeam.participant`** (added to the team if not already on it). Blocks sharing the same participant spec MAY default to the same resolution with a per-block override. An enrollment SHALL NOT be created until every block's required participant(s) are resolved (same validation path as required deferred fields).

#### Scenario: Participants resolved per block from the care team filtered by role + specialty

- **WHEN** a caregiver enrolls a patient in a pathway whose blocks require participants (e.g. role=physician, specialty=urology)
- **THEN** the enroll form offers care-team members / practitioners matching that role + specialty for each block
- **AND** each block uses its resolved Practitioner(s) at runtime (`Appointment.participant.actor` / task owner)

#### Scenario: MDO takes multiple caregivers

- **WHEN** an `mdo` block is enrolled
- **THEN** the caregiver may choose several participants (one lead + others) for it

#### Scenario: Choosing a non-member adds them to the care team

- **WHEN** the caregiver chooses someone not currently on the patient's care team
- **THEN** that caregiver is added to the care team as part of enrollment

#### Scenario: Unfilled required block caregiver blocks enrollment

- **WHEN** the caregiver submits with a block's required caregiver left unchosen
- **THEN** enrollment is rejected naming the block, and no enrollment is created

### Requirement: A patient may hold multiple concurrent enrollments

The system SHALL allow a patient to be enrolled in more than one pathway at the same time. Each enrollment SHALL be independent and SHALL render as its own section in the Pathway tab.

#### Scenario: Second enrollment while first is active

- **GIVEN** a patient with one active enrollment
- **WHEN** the caregiver enrolls them in a second pathway
- **THEN** both enrollments are active and listed separately

### Requirement: Enrollment lifecycle controls

A care-team caregiver SHALL be able to **cancel**, **pause**, and **resume** an enrollment (states active/paused/completed/cancelled). Completion SHALL occur automatically when an `end_pathway` block is reached. Pausing SHALL stop timers/auto-advance until resumed. Cancelling SHALL withdraw materialized work on open steps. There is no per-step skip in this version.

#### Scenario: Pause halts auto-advance

- **GIVEN** an active enrollment with an upcoming timed step
- **WHEN** the caregiver pauses the enrollment
- **THEN** the timer does not advance the step until the enrollment is resumed

#### Scenario: Cancel withdraws open work

- **WHEN** the caregiver cancels an active enrollment
- **THEN** the enrollment becomes `cancelled` and materialized appointments/tasks on open steps are withdrawn

### Requirement: List a patient's enrollments for read

The backend SHALL expose a list-by-patient read returning the patient's enrollments, each with its block executions (state, scheduled_at, due_at/ready, completed_at, result_json), scoped to the caller's care-team membership for that patient. This read backs the Pathway tab.

#### Scenario: Care-team caregiver lists enrollments

- **WHEN** a care-team caregiver requests the patient's enrollments
- **THEN** the response lists each enrollment with its executions and current states

#### Scenario: Non-care-team caregiver is denied

- **WHEN** a caregiver not on the patient's care team requests the enrollments
- **THEN** the request is denied (same not-found/forbidden shape as other care-team-scoped reads)
