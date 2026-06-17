## MODIFIED Requirements

### Requirement: Audit enums map to FHIR CRUDE actions plus orthogonal outcome

The backend SHALL define `AuditAction` in `app/core/enums/audit.py` as the HL7 FHIR R5 `AuditEvent.action` 5-code set: `created` (C), `read` (R), `updated` (U), `deleted` (D), `execute` (E). `AuditAction` SHALL hold the coarse operation only; the most-specific domain event SHALL live in the `event_code` column, and the resource noun SHALL remain the free-text `resource_type`. Outcome SHALL stay the orthogonal `AuditResult` (`success | failure`). The legacy value `login` SHALL be retained so existing rows remain valid but SHALL be deprecated for new writes in favour of `action = execute` with `event_code = auth.login`. `ActorType` SHALL be extended to `user | patient | system | anonymous`, where `patient` denotes a mobile-originated patient actor (`actor_id` = patient id); the actor level ("user did / patient did / system did") SHALL be carried solely by `ActorType`.

#### Scenario: Runtime transition recorded as execute

- **WHEN** the runtime engine executes a block
- **THEN** the audit row MUST have `action = execute` and `event_code = runtime.block_executed` (not a bespoke `executed` action value)

#### Scenario: Read recorded as read action

- **WHEN** a caregiver views a patient dossier
- **THEN** the audit row MUST have `action = read`

#### Scenario: Action set is exactly the FHIR five plus legacy login

- **WHEN** `AuditAction` is enumerated
- **THEN** its values MUST be `created`, `read`, `updated`, `deleted`, `execute`, and the deprecated `login`

#### Scenario: Patient actor recorded for mobile action

- **WHEN** a patient completes a task from the mobile app
- **THEN** the audit row MUST have `actor_type = patient` and `actor_id` = the patient id

### Requirement: Append-only audit_events table

The backend SHALL persist an `audit_events` table that records one immutable row per audited event, inheriting `Base` directly (carrying `id` + `created_at` only — no `updated_at`/`deleted_at`/soft-delete). In addition to the base columns, the table SHALL carry `event_code` (text, nullable), `patient_id` (UUID, nullable), and `purpose_of_use` (enum, nullable). `patient_id` SHALL carry NO foreign key, consistent with `actor_id`/`tenant_id`, so a row survives patient deletion or archival. The table SHALL provide, in addition to the base indexes, `(patient_id, created_at DESC)` and `(event_code, created_at DESC)`.

#### Scenario: New columns created by migration

- **WHEN** a database is migrated to head
- **THEN** `audit_events` has columns `event_code` (text, nullable), `patient_id` (UUID, nullable), `purpose_of_use` (enum, nullable), plus indexes `ix_audit_events_patient` and `ix_audit_events_event_code`

#### Scenario: No patient foreign key

- **WHEN** the `audit_events` table is inspected
- **THEN** `patient_id` MUST NOT have a foreign key constraint

#### Scenario: Historical rows keep nulls

- **WHEN** the additive migration runs against existing rows
- **THEN** no backfill occurs and pre-existing rows have `event_code`, `patient_id`, and `purpose_of_use` all null

## ADDED Requirements

### Requirement: event_code carries the most-specific domain event

The backend SHALL record the most-specific event in an `event_code` text column (FHIR `AuditEvent.code`), validated at emit against an app-level vocabulary (`KNOWN_EVENT_CODES` in `app/services/audit/registry.py`), namespaced by surface (e.g. `pathway.published`, `runtime.enrolled`, `runtime.block_executed`, `runtime.sla_escalated`, `runtime.decision_branched`, `runtime.deferred_value_resolved`, `patient.dossier_viewed`, `auth.login`, `auth.logout`). An unknown `event_code` SHALL be rejected before write, mirroring `resource_type` validation.

#### Scenario: Unknown event_code rejected

- **WHEN** `emit()` is called with an `event_code` not in the vocabulary
- **THEN** it MUST raise before writing a row

#### Scenario: Known event_code persisted

- **WHEN** `emit()` is called with `event_code = runtime.enrolled`
- **THEN** the row MUST persist with that `event_code`

### Requirement: patient_id is the patient-centric query axis

The backend SHALL set `patient_id` (FHIR R5 `AuditEvent.patient`) on every audit event that concerns a patient's dossier, even when the touched entity is not the Patient row. This axis SHALL be independent of `resource_type`/`resource_id`. Events not concerning a patient (e.g. pathway template edits) SHALL leave `patient_id` null.

#### Scenario: Note edit carries patient_id

- **WHEN** a note on patient X is updated
- **THEN** the audit row MUST have `resource_type = Note`, `resource_id = <note>`, and `patient_id = X`

#### Scenario: Patient-centric query is single-axis

- **WHEN** the audit trail is queried for `patient_id = X`
- **THEN** all dossier events for patient X — across notes, appointments, runtime, and direct patient edits — MUST be returned without joining through each resource type

#### Scenario: Template edit has null patient_id

- **WHEN** a pathway template block is updated
- **THEN** the audit row MUST have `patient_id` null

### Requirement: purpose_of_use records the reason for access

The backend SHALL record a `purpose_of_use` value (FHIR `agent.authorization`) from the enum `treatment | operations | patient_request | emergency | break_the_glass`. It SHALL be required on read events of patient data and MAY be set on other events. On a caregiver read the value SHALL be derived from role context (default `treatment`), not required from the UI per request. `break_the_glass` SHALL denote an override of an access restriction and be independently queryable; the value and its queryability ship now, but the access-override flow that sets it is deferred (no PoC restriction to override).

#### Scenario: Patient read without purpose rejected

- **WHEN** a patient-data read event is emitted with no `purpose_of_use`
- **THEN** the emit MUST be rejected

#### Scenario: Break-the-glass access is isolable

- **WHEN** the trail is filtered by `purpose_of_use = break_the_glass`
- **THEN** only override-access events MUST be returned

### Requirement: Patient-data reads are captured explicitly

Because the `before_flush` hook captures writes only, the backend SHALL capture read/access events for patient-scoped data via an explicit emit seam (a FastAPI dependency) on patient-data GET routes, recording `action = read`, an `event_code`, `patient_id`, `purpose_of_use`, and request context. It SHALL emit one row per logical dossier view, not one per sub-resource fetch. Admin, template, and catalogue list routes SHALL NOT be read-logged.

#### Scenario: Dossier view emits one read event

- **WHEN** a caregiver loads patient X's dossier, which fetches profile, notes, and appointments
- **THEN** exactly one `patient.dossier_viewed` read event MUST be emitted with `patient_id = X`

#### Scenario: Catalogue read is not logged

- **WHEN** a user lists the pathway template catalogue
- **THEN** no read audit event MUST be emitted

### Requirement: Denied access to patient data is audited

The backend SHALL capture an audit event when an actor is denied access to a patient-data resource (authorization failure / 403), recording `action = read`, `result = failure`, the target `patient_id`, and the attempted `event_code`. This SHALL apply to the patient-data surfaces in the read-logging scope, not to every authorization failure in the application.

#### Scenario: Denied dossier read recorded

- **WHEN** an actor without a relationship to patient X requests patient X's dossier and is denied
- **THEN** exactly one audit row MUST exist with `action = read`, `result = failure`, `patient_id = X`

#### Scenario: Successful read is not a failure

- **WHEN** an authorized actor reads patient X's dossier
- **THEN** the audit row MUST have `result = success`, not `failure`

### Requirement: patient_id population is complete and enforced

Every patient-scoped model that opts into automatic capture (`__audited__`) SHALL have a defined patient-resolution path so its events carry `patient_id`. A conformance test SHALL assert this; a patient-scoped audited model with no resolution path MUST fail the test. A model that legitimately has no patient SHALL be an explicit, asserted exception, not an accidental null.

#### Scenario: Audited patient-scoped model resolves patient_id

- **WHEN** the audited-model conformance test runs
- **THEN** every patient-scoped `__audited__` model MUST have a patient-resolution path, or be explicitly listed as patient-less

### Requirement: System errors are excluded from the audit trail

The `audit_events` table SHALL record only actor-on-subject events (security, access, domain). Application errors, exceptions, and infrastructure failures SHALL NOT be written to `audit_events`; they belong in structured logging / error monitoring. A *failed audited action* (e.g. denied access, failed login) SHALL be recorded with `result = failure` — this is distinct from a system error.

#### Scenario: Exception is not an audit event

- **WHEN** a request handler raises an unhandled exception or the database times out
- **THEN** no `audit_events` row MUST be written for that error

#### Scenario: Failed audited action is recorded

- **WHEN** a login fails or a patient-data read is denied
- **THEN** an `audit_events` row with `result = failure` MUST be written (this is an audited action, not a system error)
