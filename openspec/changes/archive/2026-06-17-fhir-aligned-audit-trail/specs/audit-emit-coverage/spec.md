## ADDED Requirements

### Requirement: Pathway builder events are audited

The backend SHALL audit pathway and block lifecycle. Create/update/delete of pathways and blocks SHALL be captured automatically via `__audited__` opt-in (`action = created/updated/deleted`). Pathway publication SHALL emit an explicit event `action = execute`, `event_code = pathway.published`. Builder events concern templates, not patients, so `patient_id` SHALL be null.

#### Scenario: Pathway publish audited

- **WHEN** a pathway is published
- **THEN** an audit row MUST exist with `action = execute`, `event_code = pathway.published`, `patient_id` null

#### Scenario: Block edit captured by auto-diff

- **WHEN** a pathway block is updated
- **THEN** an `action = updated` row MUST be captured with a `changes` map and `patient_id` null

### Requirement: Patient data events are audited with patient axis

The backend SHALL audit patient-scoped data: dossier reads (`action = read`, `event_code = patient.dossier_viewed`) and create/update/delete of notes, appointments, and collaboration records. Every such event SHALL set `patient_id`. Patient-data reads SHALL set `purpose_of_use`.

#### Scenario: Note creation carries patient axis

- **WHEN** a note is created on patient X
- **THEN** the audit row MUST have `action = created`, `resource_type = Note`, `patient_id = X`

#### Scenario: Dossier read carries purpose

- **WHEN** patient X's dossier is viewed
- **THEN** the audit row MUST have `action = read`, `patient_id = X`, and a non-null `purpose_of_use`

#### Scenario: Denied dossier access audited

- **WHEN** an actor is denied access to patient X's dossier (403)
- **THEN** an audit row MUST have `action = read`, `result = failure`, `patient_id = X`

### Requirement: Pathway runtime transitions are audited

The backend SHALL emit an explicit audit event for each pathway runtime transition: enrollment (`runtime.enrolled`), block execution (`runtime.block_executed`), SLA escalation (`runtime.sla_escalated`), decision branching (`runtime.decision_branched`), deferred-value resolution (`runtime.deferred_value_resolved`), and admin fast-forward (`runtime.fast_forwarded`). All SHALL carry `action = execute` and the enrollment's `patient_id`. Engine-driven transitions with no human initiator SHALL set `actor_type = system`, `actor_id` null. The admin fast-forward SHALL set the admin as actor with `purpose_of_use = operations`, and SHALL emit its summary event in addition to the per-step `runtime.block_executed` events its loop triggers.

#### Scenario: Enrollment audited with patient

- **WHEN** a patient X is enrolled in a pathway
- **THEN** an audit row MUST exist with `action = execute`, `event_code = runtime.enrolled`, `patient_id = X`

#### Scenario: System-driven block execution

- **WHEN** the runtime engine executes a block without a human actor
- **THEN** the audit row MUST have `event_code = runtime.block_executed`, `actor_type = system`, `actor_id` null, and the enrollment's `patient_id`

#### Scenario: SLA escalation audited

- **WHEN** a block breaches its SLA and escalates
- **THEN** an audit row MUST exist with `event_code = runtime.sla_escalated` and the enrollment's `patient_id`

#### Scenario: Admin fast-forward audited

- **WHEN** an admin fast-forwards patient X's enrollment, completing N steps
- **THEN** one `runtime.fast_forwarded` event MUST exist with the admin actor, `patient_id = X`, `purpose_of_use = operations`, alongside the N per-step `runtime.block_executed` events

#### Scenario: One event per transition

- **WHEN** a single runtime transition occurs
- **THEN** exactly one audit event MUST be emitted for it

### Requirement: Patient-actor capability is in place; emit deferred to mobile backend

There is no patient/mobile login endpoint on the PoC backend, so this change SHALL ship the `ActorType.patient` value and the emit capability but SHALL NOT wire any patient-actor call site. When a patient-facing backend endpoint exists (mobile auth, task completion, measurement, consent), its handler SHALL emit `actor_type = patient` events without any audit schema change.

#### Scenario: Patient actor value is available without a schema change

- **WHEN** a patient-facing backend endpoint is later added and emits an audit event
- **THEN** it MUST be able to record `actor_type = patient` using the shipped enum and emit API, with no migration

#### Scenario: No patient-actor rows in PoC

- **WHEN** the PoC backend runs (no patient endpoints)
- **THEN** no `actor_type = patient` rows are produced, and this is expected
