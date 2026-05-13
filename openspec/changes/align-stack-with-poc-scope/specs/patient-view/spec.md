## ADDED Requirements

### Requirement: Patient detail route

The orchestrator SHALL expose `/patienten/$patientId` showing the patient's current pathway as a vertical list of blocks. The current block MUST be visually marked; completed blocks render as struck-through; upcoming blocks render plain. The page MUST be caregiver-facing only — there is no patient-facing UI in PoC.

#### Scenario: Current block highlighted

- **WHEN** the patient is enrolled with `current_block_id = b3`
- **THEN** the row for block `b3` carries `aria-current="step"` and the active style token

#### Scenario: Completed blocks marked

- **WHEN** an enrollment has `completed_block_ids = ["b1", "b2"]`
- **THEN** rows for `b1` and `b2` render with the completed style and are not interactive

### Requirement: Luscii clinical care path embed

A `luscii_care_path` block SHALL render inline inside the patient view by showing `static_payload` JSON in a read-only code panel with the block's title. No interpretation, summary, or transformation of the payload is allowed in PoC.

#### Scenario: Luscii block renders as-is

- **WHEN** the patient view contains a `luscii_care_path` block with `static_payload = {"foo": "bar"}`
- **THEN** the page renders `{"foo": "bar"}` verbatim in a code panel below the block title

### Requirement: Backend patient detail router

The backend SHALL expose `GET /patients/{id}` returning the patient, the active enrollment, the enrolled pathway, and the runtime state (`current_block_id`, `completed_block_ids`).

#### Scenario: Detail returns runtime state

- **WHEN** `GET /patients/p1` is called for an enrolled patient
- **THEN** the response includes `enrollment.current_block_id` and `enrollment.completed_block_ids`
