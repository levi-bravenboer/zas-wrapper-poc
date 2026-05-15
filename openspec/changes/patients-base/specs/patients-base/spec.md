## ADDED Requirements

### Requirement: Patient is a clinical subject, never an authenticatable identity

The `patients` table SHALL represent a clinical subject only. Patients SHALL NOT authenticate against our system, HiX-embedded surfaces, or any other login pathway exposed by this codebase. The `patients` table SHALL NOT carry credential columns (`password_hash`, `auth_provider_sub`, `session_*`, `last_login_at`, or equivalents). Identity for login lives exclusively in `users`. Any future patient-facing surface SHALL be introduced as a separate capability with its own auth entity — the `patients` row stays clinical-subject-only.

#### Scenario: Patients table has no credential or login columns

- **WHEN** the `patients` table schema is inspected after migration
- **THEN** no column named `password_hash`, `auth_provider_sub`, `session_token`, `session_id`, `last_login_at`, or `mfa_*` MUST exist on the table

#### Scenario: Patient ID is never accepted by auth routes

- **WHEN** any `/auth/*` route receives a request body
- **THEN** that route's request schema MUST NOT reference `Patient` or `patient_id` in any field

### Requirement: Patient shape conforms to FHIR R4 Patient

The patient entity (columns + identifier rows + API search parameters) SHALL conform structurally to FHIR R4 `Patient`. Specifically: gender values SHALL use the FHIR `administrative-gender` value set (`male|female|other|unknown`); identifier `system` values SHALL be URI-formatted (URN OID or URL) matching FHIR `Identifier.system` semantics; date-of-birth SHALL be `birth_date` (date-only, no timezone) per FHIR `Patient.birthDate`; list-search parameters SHALL be named to map 1:1 to FHIR `Patient` search params (`family`→`family_name`, `given`→`given_name`, `birthdate`→`birth_date`, `identifier`→`identifier`). The capability SHALL NOT depend on the `fhir.resources` library; FHIR is the shape contract, not the wire format.

#### Scenario: Gender column rejects non-FHIR codes

- **WHEN** an insert or update attempts to set `gender` to a value outside `{male, female, other, unknown}`
- **THEN** the database enum check MUST reject it

#### Scenario: Identifier system is URI-formatted

- **WHEN** a `patient_identifiers` row is created via API
- **THEN** the `system` value MUST start with `urn:` or `http:` or `https:` (URI-formatted), validated at the schema layer

### Requirement: Patients table persists tenant-scoped patient entities

The backend SHALL persist a `patients` table where each row represents a patient belonging to exactly one tenant. `Patient` SHALL inherit `TenantOwnedEntity`, so each row carries the inherited columns (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus patient-specific columns (`primary_organisation_id`, `given_name`, `family_name`, `birth_date`, `gender`, `source`, `external_system`, `external_ref`, `external_version`, `last_synced_at`). The `primary_organisation_id` column SHALL be a NOT NULL FK to `organisations.id` (on delete RESTRICT). The referenced organisation MUST belong to the same tenant as the patient row (enforced at service layer). All non-identifier patient queries SHALL be tenant-scoped through the inherited `tenant_id` filter.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `organisations-base`)
- **THEN** a `patients` table exists with columns `id` (UUID, primary key, not null), `tenant_id` (UUID, not null, references `tenants.id`, on delete RESTRICT), `primary_organisation_id` (UUID, not null, references `organisations.id`, on delete RESTRICT), `created_by` (UUID, not null, references `users.id`, on delete RESTRICT), `updated_by` (UUID, not null, references `users.id`, on delete RESTRICT), `deleted_by` (UUID, nullable, references `users.id`, on delete RESTRICT), `given_name` (varchar 255, not null), `family_name` (varchar 255, not null), `birth_date` (date, nullable), `gender` (enum `gender`, not null), `source` (enum `patient_source`, not null, default `'local'`), `external_system` (varchar 64, nullable), `external_ref` (varchar 255, nullable), `external_version` (varchar 64, nullable), `last_synced_at` (timestamptz, nullable), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`), `deleted_at` (timestamptz, nullable)

#### Scenario: Primary organisation must be same-tenant

- **WHEN** a write attempts to set `primary_organisation_id` to an organisation row whose `tenant_id` differs from the patient's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: External-ref uniqueness is tenant-scoped and ignores soft-deleted rows

- **WHEN** the migration runs
- **THEN** a partial unique index exists on `(tenant_id, external_system, external_ref)` with predicate `external_ref IS NOT NULL AND deleted_at IS NULL`

#### Scenario: Audit fields auto-filled by hook on patient insert

- **WHEN** an authenticated caregiver's request inserts a patient and `session.info[SESSION_ACTOR_KEY]` is set to the caregiver's `SessionUser`
- **THEN** the patient row's `tenant_id`, `created_by`, and `updated_by` MUST be stamped by the audit hook to the caregiver's `tenant_id` / `id` — the API handler MUST NOT set those fields explicitly

#### Scenario: Tenant isolation hides cross-tenant rows

- **WHEN** a caregiver in tenant A issues `GET /api/v1/patients/{id}` for a patient row whose `tenant_id` is tenant B
- **THEN** the API MUST respond `404 Not Found` (not `403`) to avoid existence disclosure

### Requirement: Gender enum is a single canonical FHIR-aligned value

The backend SHALL define exactly one Python `Gender` enum at `app/core/enums/patient.py` with values `male`, `female`, `other`, `unknown` (string-valued via `StrEnum`), re-exported from `app/core/enums/__init__.py`. These values MUST match FHIR R4 administrative-gender codes verbatim. This enum MUST be the source of truth for the `gender` column type (`sa.Enum(Gender, name="gender", native_enum=True, create_constraint=True)`) and for every Pydantic `gender` field in `app/schemas/`.

#### Scenario: ORM model imports Gender from core

- **WHEN** the `Patient` ORM model declares its `gender` column
- **THEN** it MUST import `Gender` from `app.core.enums.patient` and pass it to `sa.Enum(...)`

#### Scenario: Pydantic schemas import Gender from core

- **WHEN** a Pydantic schema types a `gender` field
- **THEN** it MUST import `Gender` from `app.core.enums.patient`

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs on a fresh database
- **THEN** a Postgres enum type `gender` exists with exactly the values `('male', 'female', 'other', 'unknown')` in that order

### Requirement: Patient source enum captures row authority

The backend SHALL define a `PatientSource` enum at `app/core/enums/patient.py` with values `local`, `hix`, `luscii` (string-valued via `StrEnum`), persisted as Postgres enum type `patient_source`. The `source` column on `patients` SHALL NOT be nullable and SHALL default to `local`. Rows with `source != 'local'` SHALL have `external_system` and `external_ref` populated; rows with `source == 'local'` MAY leave `external_ref` null.

#### Scenario: Default source is local

- **WHEN** a row is inserted via the API without an explicit `source` value
- **THEN** the row's `source` MUST be persisted as `'local'`

#### Scenario: HiX-sourced row carries external linkage

- **WHEN** a row is upserted by the HiX adapter (MVP) with `source='hix'`
- **THEN** the database MUST require `external_system='hix'` AND `external_ref IS NOT NULL` for that row (enforced by adapter contract; PoC validator stub)

### Requirement: Patient identifiers persist in a dedicated child table

The backend SHALL persist a `patient_identifiers` table where each row links one identifier value to one patient. Columns: `id` (UUID, PK), `patient_id` (UUID, not null, references `patients.id`, on delete CASCADE), `system` (varchar 255, not null), `value` (varchar 255, not null), `use` (varchar 32, not null, default `'official'`), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`), `deleted_at` (timestamptz, nullable). Tenant scope SHALL be inherited transitively through the `patient_id` foreign key; identifier rows MUST NOT be queried in isolation from `patients`. A partial unique index `(patient_id, system, value) WHERE deleted_at IS NULL` SHALL prevent duplicate identifiers per patient.

#### Scenario: Identifier rows cascade delete on hard patient delete

- **WHEN** a `patients` row is hard-deleted (test-only path)
- **THEN** all matching `patient_identifiers` rows MUST be deleted by the FK CASCADE

#### Scenario: Same identifier reusable across patients

- **WHEN** two `patient_identifiers` rows have identical `(system, value)` but different `patient_id`
- **THEN** both inserts MUST succeed (uniqueness is per-patient, not global)

#### Scenario: INSZ identifier uses Belgian OID system

- **WHEN** an INSZ identifier is created via API or seed
- **THEN** its `system` MUST equal `urn:oid:2.16.840.1.113883.2.8.4.1.1` and its `value` MUST pass Mod-97 checksum validation

#### Scenario: Identifier query path enforces tenant scope through join

- **WHEN** the API lists identifiers for a patient
- **THEN** the underlying SQL MUST join `patient_identifiers` to `patients` and filter by `patients.tenant_id = :current_tenant`

### Requirement: Patients API exposes tenant-scoped CRUD for authenticated caregivers and admins

The backend SHALL expose under `/patients` exactly these routes: `GET /patients` (list), `GET /patients/{id}` (read), `POST /patients` (create), `PATCH /patients/{id}` (update demographics), `DELETE /patients/{id}` (soft delete). All routes SHALL require an authenticated user matching `require_role(Role.ADMIN, Role.CAREGIVER)`. All routes SHALL be tenant-scoped via the session actor's `tenant_id`. Cross-tenant reads SHALL return `404`, never `403`. Every route handler that applies an auth guard SHALL carry an `# AUTH-HARDEN` source comment so future hardening passes are grep-able.

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request calls any `/patients` route
- **THEN** the API MUST respond `401 Unauthorized`

#### Scenario: List response includes identifiers

- **WHEN** a caregiver calls `GET /patients`
- **THEN** each patient in the response body MUST include an `identifiers` array with `{system, value, use}` entries, eagerly loaded

#### Scenario: PATCH cannot mutate identifiers in PoC

- **WHEN** a `PATCH /patients/{id}` request body contains an `identifiers` field
- **THEN** the API MUST respond `422 Unprocessable Entity` with a clear message indicating identifier mutation is not supported in PoC

#### Scenario: DELETE soft-deletes and stamps deleted_by

- **WHEN** a caregiver issues `DELETE /patients/{id}`
- **THEN** the row's `deleted_at` MUST be set to `now()`, `deleted_by` MUST be set to the caregiver's `id`, and subsequent `GET /patients/{id}` MUST return `404`

#### Scenario: AUTH-HARDEN marker present on every guarded route

- **WHEN** any source-level scan of `app/api/routers/patient/patient_router.py` runs
- **THEN** every route handler that applies a role or session guard MUST carry an `# AUTH-HARDEN` comment within its function body or as a leading guard-line comment

### Requirement: Patients list supports FHIR-aligned discrete search parameters

The `GET /patients` route SHALL accept the following optional query parameters and combine them per the rules below:

- `limit` (int, default 50, max 200) and `offset` (int, default 0) for pagination
- `family_name` (str): prefix ILIKE match on `patients.family_name`
- `given_name` (str): prefix ILIKE match on `patients.given_name`
- `birth_date` (date, ISO 8601): exact equality on `patients.birth_date`
- `identifier` (str): exact equality on `patient_identifiers.value` joined through `patient_id` within the caller's tenant

When `identifier` is provided, it SHALL short-circuit the other filters (return the at-most-one matching row). When `identifier` is absent, the remaining filters SHALL be AND-combined. All matches SHALL be tenant-scoped via the session actor's `tenant_id`. Parameter names align with FHIR R4 `Patient` search (`family`, `given`, `birthdate`, `identifier`) so MVP HiX adapter wiring is a direct mapping.

#### Scenario: Identifier short-circuits other filters

- **WHEN** `GET /patients?identifier=<value>&family_name=zzz` is called and a patient in the caller's tenant has that identifier value
- **THEN** the response MUST contain that patient regardless of the `family_name` mismatch

#### Scenario: Multiple filters AND together

- **WHEN** `GET /patients?family_name=jans&birth_date=1985-03-12` is called
- **THEN** the response MUST contain only patients whose `family_name` starts with `jans` AND whose `birth_date` equals `1985-03-12`

#### Scenario: Search never crosses tenant boundary

- **WHEN** `GET /patients?identifier=<value>` is called and a patient with that identifier exists in a different tenant
- **THEN** the response MUST be empty

#### Scenario: Default pagination limit applied

- **WHEN** `GET /patients` is called with no `limit` param and the tenant has more than 50 patients
- **THEN** the response MUST contain at most 50 items and the response meta MUST report `limit=50`, `offset=0`, and the correct `total`

### Requirement: HiX patient adapter module reserves the MVP wiring point

The backend SHALL provide a module at `app/adapters/hix/patients.py` exposing class `HixPatientAdapter` with methods `fetch(external_ref: str)` and `upsert_from_hix(payload)`. Both methods SHALL raise `NotImplementedError("HiX patient adapter is MVP scope")` in PoC. The module SHALL be importable and covered by an import-test.

#### Scenario: Adapter module is importable

- **WHEN** `from app.adapters.hix.patients import HixPatientAdapter` is executed in any test
- **THEN** the import MUST succeed without side effects

#### Scenario: Adapter methods raise NotImplementedError in PoC

- **WHEN** `HixPatientAdapter().fetch("x")` or `HixPatientAdapter().upsert_from_hix({})` is called
- **THEN** the call MUST raise `NotImplementedError` with the message `"HiX patient adapter is MVP scope"`

### Requirement: Seed script generates synthetic patients only

The backend SHALL provide `scripts/seed_patients.py` that inserts a fixed set of synthetic patients into the default demo tenant. The script SHALL use a fixed PRNG seed for determinism, MUST generate Mod-97-checksum-valid but fictional INSZ values, and MUST NOT contain or fetch any real patient data from any source. The file SHALL carry a header comment stating "SYNTHETIC ONLY — see openspec/project.md no-PHI invariant."

#### Scenario: Re-running seed is idempotent

- **WHEN** `seed_patients.py` is run twice against the same database
- **THEN** the second run MUST NOT create duplicate rows (uniqueness enforced via `(tenant_id, external_system, external_ref)` partial index using a deterministic `external_ref` per seeded patient)

#### Scenario: All seeded INSZ values pass Mod-97 validation

- **WHEN** the seed script runs
- **THEN** every inserted INSZ identifier value MUST satisfy the Belgian rijksregisternummer Mod-97 checksum

#### Scenario: Caregiver actor stamps audit fields during seed

- **WHEN** the seed script runs after `seed_users.py` has bootstrapped the demo caregiver
- **THEN** the script MUST set `session.info[SESSION_ACTOR_KEY]` to the demo caregiver's `SessionUser` so that audit hooks stamp `created_by`, `updated_by`, and `tenant_id` correctly
