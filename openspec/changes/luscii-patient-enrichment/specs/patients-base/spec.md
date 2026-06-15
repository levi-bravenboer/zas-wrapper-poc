# patients-base Specification (delta)

## MODIFIED Requirements

### Requirement: Patient identifiers persist in a dedicated child table

The backend SHALL persist a `patient_identifiers` table where each row links one identifier value to one patient. Columns: `id` (UUID, PK), `patient_id` (UUID, not null, references `patients.id`, on delete CASCADE), `system` (varchar 255, not null), `value` (varchar 255, not null), `use` (varchar 32, not null, default `'official'`), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`), `deleted_at` (timestamptz, nullable). Tenant scope SHALL be inherited transitively through the `patient_id` foreign key; identifier rows MUST NOT be queried in isolation from `patients`. A partial unique index `(patient_id, system, value) WHERE deleted_at IS NULL` SHALL prevent duplicate identifiers per patient.

The Luscii system (`urn:zas:luscii:patient`, registered in `app/core/identifiers.py`) SHALL additionally be unique **across patients**: a partial unique index on `(system, value) WHERE system = 'urn:zas:luscii:patient' AND deleted_at IS NULL`. A patient SHALL hold at most one active Luscii identifier. Other systems keep per-patient-only uniqueness.

#### Scenario: Identifier rows cascade delete on hard patient delete

- **WHEN** a `patients` row is hard-deleted (test-only path)
- **THEN** all matching `patient_identifiers` rows MUST be deleted by the FK CASCADE

#### Scenario: Same identifier reusable across patients

- **WHEN** two `patient_identifiers` rows have identical `(system, value)` but different `patient_id`, and the system is not `urn:zas:luscii:patient`
- **THEN** both inserts MUST succeed (uniqueness is per-patient for non-Luscii systems)

#### Scenario: Luscii identifier unique across patients

- **WHEN** an active row `(system='urn:zas:luscii:patient', value=V)` exists for patient A and an insert attempts the same `(system, value)` for patient B
- **THEN** the insert MUST fail on the partial unique index

#### Scenario: INSZ identifier uses Belgian OID system

- **WHEN** an INSZ identifier is created via API or seed
- **THEN** its `system` MUST equal `urn:oid:2.16.840.1.113883.2.8.4.1.1` and its `value` MUST pass Mod-97 checksum validation

#### Scenario: Identifier query path enforces tenant scope through join

- **WHEN** the API lists identifiers for a patient
- **THEN** the underlying SQL MUST join `patient_identifiers` to `patients` and filter by `patients.tenant_id = :current_tenant`

## ADDED Requirements

### Requirement: Identifier immutability carve-out for the Luscii link endpoints

`PATCH /patients/{id}` SHALL continue to reject any `identifiers` payload with `422`. The ONLY write path for `urn:zas:luscii:patient` identifier rows SHALL be the dedicated link endpoints (`PUT`/`DELETE /patients/{id}/luscii-link`, specified in `luscii-patient-data`). `POST /patients` SHALL reject initial identifiers using the Luscii system with `422` — links are created only through the validated endpoint.

#### Scenario: PATCH still rejects identifier mutation

- **WHEN** a `PATCH /patients/{id}` body contains an `identifiers` field
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: POST rejects Luscii-system identifiers

- **WHEN** a `POST /patients` body includes an identifier with `system='urn:zas:luscii:patient'`
- **THEN** the API MUST respond `422` directing the caller to the link endpoint
