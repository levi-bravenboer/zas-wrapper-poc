## MODIFIED Requirements

### Requirement: Patients API exposes tenant-scoped CRUD for authenticated caregivers and admins

The backend SHALL expose under `/patients` exactly these routes: `GET /patients` (list), `GET /patients/{id}` (read), `POST /patients` (create), `PATCH /patients/{id}` (update demographics), `DELETE /patients/{id}` (soft delete). All routes SHALL require an authenticated user matching `require_role(Role.ADMIN, Role.CAREGIVER)`. All routes SHALL be tenant-scoped via the session actor's `tenant_id`. Cross-tenant reads SHALL return `404`, never `403`.

**Visibility within a tenant** SHALL be filtered as follows:

- `admin` users SHALL see all non-soft-deleted patients in their tenant.
- `caregiver` users SHALL see a patient ONLY when they have at least one open `care_team_participants` row (`period_end IS NULL`) on an active `care_teams` row (`status='active'`) for that patient.

There SHALL NOT be a fallback path. Caregivers without an open participant row SHALL NOT see the patient regardless of organisation-tree relationships. Patients without any care team SHALL be invisible to caregivers; an admin (or future pathway runtime) MUST explicitly create a team and assign participants.

The same visibility predicate SHALL drive `require_patient_access(patient_id)` for `GET /patients/{id}`, `PATCH /patients/{id}`, `DELETE /patients/{id}`, and any care-team route whose path includes a `patient_id`.

Every route handler that applies an auth guard SHALL carry an `# AUTH-HARDEN` source comment.

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

- **WHEN** a caregiver issues `DELETE /patients/{id}` on a patient they can access
- **THEN** the row's `deleted_at` MUST be set to `now()`, `deleted_by` MUST be set to the caregiver's `id`, and subsequent `GET /patients/{id}` MUST return `404`

#### Scenario: AUTH-HARDEN marker present on every guarded route

- **WHEN** any source-level scan of `app/api/routers/patient/patient_router.py` runs
- **THEN** every route handler that applies a role or session guard MUST carry an `# AUTH-HARDEN` comment within its function body or as a leading guard-line comment

#### Scenario: Admin sees all patients in tenant

- **WHEN** an admin in tenant T calls `GET /patients` with no filters
- **THEN** the response MUST contain every non-soft-deleted patient row whose `tenant_id == T`

#### Scenario: Caregiver sees patient via open care-team participant row

- **WHEN** a caregiver U has an open `care_team_participants` row on an active `care_teams` row for patient P, and U calls `GET /patients` or `GET /patients/{P.id}`
- **THEN** the response MUST include P

#### Scenario: Caregiver does not see patient absent membership

- **WHEN** caregiver U has NO open `care_team_participants` row on an active `care_teams` row for patient P, and U calls `GET /patients/{P.id}`
- **THEN** the response MUST be `404` regardless of whether U's `organisation_id` is related to P's `primary_organisation_id`

#### Scenario: Patient without any care team is invisible to caregivers

- **WHEN** patient P exists in tenant T but has zero `care_teams` rows, and caregiver U in tenant T calls `GET /patients/{P.id}`
- **THEN** the response MUST be `404` (admin in tenant T still sees P)
