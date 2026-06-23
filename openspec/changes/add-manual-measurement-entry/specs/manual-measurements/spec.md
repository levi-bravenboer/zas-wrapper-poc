## ADDED Requirements

### Requirement: Local observations are stored FHIR-Observation-style

The backend SHALL persist manually-entered measurements in a dedicated `observation` table, separate from the Luscii proxy (which persists no measurement data). Each row SHALL carry: `id`, `patient_id` (FK to the patient), `code` (the measurement-type code, e.g. LOINC `8867-4`), `code_system` (e.g. `http://loinc.org`), `value` (numeric), `unit` (e.g. `beats/min`), `effective_date_time` (when the measurement was taken), `performer_id` (the caregiver who entered it), and standard create/soft-delete audit columns consistent with other patient-owned tables. The shape SHALL mirror the subset of FHIR `Observation` needed for a single numeric reading; no clinical interpretation, threshold, scoring, or status fields are stored.

#### Scenario: Manual measurement persisted

- **WHEN** a manual heart-rate measurement is created for a patient
- **THEN** an `observation` row exists with the patient's id, `code='8867-4'`, `code_system='http://loinc.org'`, the entered numeric `value`, `unit='beats/min'`, the supplied `effective_date_time`, and `performer_id` set to the calling caregiver

#### Scenario: Local store is independent of Luscii

- **WHEN** a patient has no Luscii link
- **THEN** manual observations can still be created and read back, and the Luscii "Metingen" data path is unaffected

### Requirement: Measurement type is a server-enforced allow-list

The backend SHALL accept only measurement types on an explicit allow-list. For now the allow-list contains exactly one entry: **heart rate** — code `8867-4`, system `http://loinc.org`, unit `beats/min`. A create request whose type is not on the allow-list SHALL be rejected with `422` and a typed error code (`invalid.observation.unsupported_type`); nothing is persisted. Adding a new supported type SHALL be a data change to the allow-list, not a change to the request/response contract.

#### Scenario: Supported type accepted

- **WHEN** a create request specifies the heart-rate type with a valid numeric value
- **THEN** the observation is persisted and returned

#### Scenario: Unsupported type rejected

- **WHEN** a create request specifies any type other than heart rate
- **THEN** the API responds `422` with error code `invalid.observation.unsupported_type` and persists nothing

#### Scenario: Unit and code derived server-side

- **WHEN** a create request omits or supplies a unit/code/system for a known type
- **THEN** the server SHALL set `code`, `code_system`, and `unit` from the allow-list entry rather than trusting client-supplied coding

### Requirement: Observations create and read endpoints are patient-access-guarded

The backend SHALL expose `POST /patients/{patient_id}/observations` (body: measurement type + numeric value + optional `effective_date_time` defaulting to now) and `GET /patients/{patient_id}/observations` (most-recent-first list for the patient). Both SHALL be guarded by the same `require_patient_access` predicate used by `PATCH /patients/{id}` and carry `# AUTH-HARDEN` markers. The create response SHALL return the persisted observation view.

#### Scenario: Create returns the persisted view

- **WHEN** a caregiver with access POSTs a valid heart-rate measurement
- **THEN** the API responds `201` with the observation view (id, patient_id, code, value, unit, effective_date_time, performer)

#### Scenario: List returns the patient's observations newest-first

- **WHEN** a caregiver with access GETs the observations for a patient with several stored readings
- **THEN** the API returns them ordered by `effective_date_time` descending, excluding soft-deleted rows

#### Scenario: Access denied without patient access

- **WHEN** a caller without access to the patient calls either endpoint
- **THEN** the API responds as `require_patient_access` dictates (same as `PATCH /patients/{id}`) and persists nothing

#### Scenario: Effective time defaults to now

- **WHEN** a create request omits `effective_date_time`
- **THEN** the server SHALL set it to the current time at persist

### Requirement: Add-measurement dialog with a type dropdown on the patient detail page

The orchestrator patient detail page SHALL provide an affordance that opens an add-measurement dialog. The dialog SHALL contain a measurement-type dropdown, a numeric value field, and a timestamp field defaulting to now. The dropdown SHALL list only the supported types (heart rate for now). On submit it SHALL call `POST /patients/{patient_id}/observations`; on success it SHALL invalidate the observations query and close. Validation SHALL require a measurement type and a numeric value before submit is enabled.

#### Scenario: Dialog submits a heart-rate reading

- **WHEN** a caregiver opens the dialog, selects heart rate, enters a numeric value, and submits
- **THEN** the measurement is created and the dialog closes after the observations query is invalidated

#### Scenario: Dropdown lists only supported types

- **WHEN** the dialog is open
- **THEN** the type dropdown shows heart rate as the only selectable option

#### Scenario: Submit blocked until valid

- **WHEN** no type is selected or the value is non-numeric/empty
- **THEN** the submit action is disabled
