## REMOVED Requirements

### Requirement: Orchestrator exposes a patients overview screen built on `DataTable<T>`

**Reason**: F4 is reframed by this change from "patients overview list" to "caregiver task list". The canonical attention surface moves to `/_auth/tasks` (specified by the new `tasks-base` capability — a server-side aggregator endpoint, NOT a tasks table). The `/_auth/patients` route is removed entirely — no list-style patient surface ships with this change.

**Migration**:
- The `/_auth/patients/index.tsx` route file is deleted.
- The route's `<FilterableListPage>` + `<DataTable<PatientRead>>` composition is deleted.
- The sidebar `"Mijn patiënten"` nav item is removed; a new `"Taken"` nav item points to `/_auth/tasks` (specified by `tasks-base`).
- Direct caregiver-facing access to "browse all patients" is intentionally NOT replaced in this change. If a stakeholder asks for a patient-directory browser at MVP, file a follow-up.
- The patient detail route `/_auth/patients/$patientId` is RETAINED as a standalone full-page detail surface (per design.md D16/D17). Tasks-context patient detail mounts the same `<PatientDetailView>` at `/_auth/tasks/p/$patientId`.
- The backend `GET /patients` list endpoint (with its `ListQuery` envelope and FHIR-aligned filters) is RETAINED — admin tooling, patient pickers, and care-team flows still consume it. Only the orchestrator's user-facing list route is dropped.

## MODIFIED Requirements

### Requirement: Patients list supports FHIR-aligned discrete search parameters

The `GET /patients` route SHALL ride on the shared `ListQuery` envelope (`page`, `page_size`, `q`, `order_by`, `order`, bracket-key `filter[<field>][<op>]=<value>`) introduced by `add-datatable-base`, and SHALL expose the FHIR `Patient` search dimensions through that envelope as follows:

- Pagination via `page` (int, default 1) and `page_size` (int, default 25, max 100); response envelope is `Page[PatientRead]` with `items`, `page`, `page_size`, `total`, `total_pages`.
- `filter[family_name][contains]=<value>` — case-insensitive substring on `patients.family_name` (FHIR `family`).
- `filter[given_name][contains]=<value>` — case-insensitive substring on `patients.given_name` (FHIR `given`).
- `filter[birth_date]=<ISO date>` (or `[gte]`/`[lte]`) — equality / range on `patients.birth_date` (FHIR `birthdate`).
- `filter[primary_organisation_id][eq|in]=<uuid>` — scoping by primary organisation.
- `q=<value>` — free-text search across `family_name`/`given_name` via `searchable_fields`.
- `identifier=<value>` — a flat router query param (NOT a `filter[...]` key) that short-circuits the rest of the query with an exact match on `patient_identifiers.value` joined through `patient_id` within the caller's tenant.

`order_by` SHALL accept at minimum `family_name`, `given_name`, `birth_date`, `created_at`. Unknown values MUST be rejected with `422` by the shared `ListQuery` validator. (The previously-considered `next_appointment_starts_at` sort key is NOT added — the task list is a server-side aggregator over `GET /tasks`, not a patient-list sort.)

When `identifier` is provided, it SHALL short-circuit all other filters and `q` (return the at-most-one matching row). When `identifier` is absent, the `filter[...]` entries SHALL be AND-combined and intersected with `q`. All matches SHALL be tenant-scoped via the session actor's `tenant_id` enforced by `BaseListRepository._tenant_predicate`. Filter field names align with FHIR R4 `Patient` search (`family`, `given`, `birthdate`, `identifier`) so MVP HiX adapter wiring is a direct mapping.

#### Scenario: order_by rejects unknown fields

- **WHEN** `GET /patients?order_by=gender` is called
- **THEN** the response MUST be `422 Unprocessable Entity`

#### Scenario: order_by rejects next_appointment_starts_at

- **WHEN** `GET /patients?order_by=next_appointment_starts_at` is called
- **THEN** the response MUST be `422 Unprocessable Entity` (no embedded next_appointment field; task aggregator lives at `GET /tasks`)

#### Scenario: Identifier short-circuits other filters

- **WHEN** `GET /patients?identifier=<value>&filter[family_name][contains]=zzz` is called and a patient in the caller's tenant has that identifier value
- **THEN** the response MUST contain that patient regardless of the `family_name` mismatch

#### Scenario: Multiple filters AND together

- **WHEN** `GET /patients?filter[family_name][contains]=jans&filter[birth_date]=1985-03-12` is called
- **THEN** the response MUST contain only patients whose `family_name` contains `jans` AND whose `birth_date` equals `1985-03-12`

#### Scenario: Search never crosses tenant boundary

- **WHEN** `GET /patients?identifier=<value>` is called and a patient with that identifier exists in a different tenant
- **THEN** the response MUST be empty

#### Scenario: Default pagination size applied

- **WHEN** `GET /patients` is called with no `page_size` param and the tenant has more than 25 patients
- **THEN** the response MUST contain at most 25 items and MUST report `page=1`, `page_size=25`, the correct `total`, and a `total_pages` consistent with `ceil(total / page_size)`

#### Scenario: Unknown filter field is rejected

- **WHEN** `GET /patients?filter[gender]=male` is called (gender is intentionally not in `PatientRepository.filterable_fields`)
- **THEN** the response MUST be `422 Unprocessable Entity` from the shared `ListQuery` validator
