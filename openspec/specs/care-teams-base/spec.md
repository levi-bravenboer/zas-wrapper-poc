# care-teams-base Specification

## Purpose
TBD - created by archiving change care-teams-base. Update Purpose after archive.
## Requirements
### Requirement: Care teams persist FHIR-aligned per-patient teams

The backend SHALL persist a `care_teams` table where each row represents one logical care team for one patient, period-bounded and statused. The table SHALL inherit `TenantOwnedEntity` and SHALL carry columns: `id`, `tenant_id`, `patient_id` (NOT NULL FK → `patients.id` ON DELETE RESTRICT), `name` (varchar 255, nullable), `status` (enum `care_team_status` with values `active|inactive`, NOT NULL, default `active`), `period_start` (timestamptz, NOT NULL, default `now()`), `period_end` (timestamptz, nullable), `category` (varchar 255, nullable — reserved for FHIR codeable concept), plus the inherited audit columns. A patient MAY have multiple `care_teams` rows simultaneously, modelling multi-condition care.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `patients-base`)
- **THEN** a `care_teams` table exists with all columns and FK `patient_id` → `patients.id`

#### Scenario: Patient must be same tenant as care team

- **WHEN** a write attempts to set `care_teams.patient_id` to a patient row whose `tenant_id` differs from the care team's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: Patient may have multiple active teams

- **WHEN** two `care_teams` rows reference the same `patient_id` and both have `status='active'` and `period_end IS NULL`
- **THEN** both inserts MUST succeed (no constraint forbids parallel active teams)

### Requirement: Care team participants persist period-bounded membership

The backend SHALL persist a `care_team_participants` table where each row represents one practitioner's membership in one care team for one period. Columns: `id`, `tenant_id` (denormalised, NOT NULL), `care_team_id` (NOT NULL FK → `care_teams.id` ON DELETE CASCADE), `user_id` (NOT NULL FK → `users.id` ON DELETE RESTRICT), `role_in_care` (enum `role_in_care` with values `primary|consulting|observer`, NOT NULL), `period_start` (timestamptz, NOT NULL, default `now()`), `period_end` (timestamptz, nullable), `acting_as_practitioner_role_id` (UUID, nullable, FK → `practitioner_roles.id` ON DELETE RESTRICT), `assigned_by` (UUID, NOT NULL, FK → `users.id` ON DELETE RESTRICT), `unassigned_by` (UUID, nullable, FK → `users.id` ON DELETE RESTRICT), plus standard audit columns (`created_at`, `updated_at`).

`acting_as_practitioner_role_id` records the **specific PractitionerRole** the participant was acting under for this engagement — strictly more precise than the pre-split `on_behalf_of_organisation_id` (which captured only the organisation). The referenced `PractitionerRole`, when not NULL, MUST belong to the same practitioner whose `user_id` matches the participant row and MUST be in the same tenant; the service layer SHALL enforce both constraints.

A partial unique index `(care_team_id, user_id) WHERE period_end IS NULL` SHALL prevent two concurrent open membership rows for the same practitioner on the same team. The same `(care_team_id, user_id)` pair MAY repeat over non-overlapping closed periods, supporting leave-and-rejoin scenarios.

#### Scenario: Two concurrent open rows for same user on same team rejected

- **WHEN** an insert attempts to add a second `care_team_participants` row with the same `care_team_id` and `user_id` where `period_end IS NULL` and an existing open row exists
- **THEN** the database MUST reject the insert with a unique-violation error

#### Scenario: Repeat membership over non-overlapping periods allowed

- **WHEN** an insert adds a new `care_team_participants` row for an existing `(care_team_id, user_id)` pair where the previous row has a non-NULL `period_end <= new.period_start`
- **THEN** the insert MUST succeed

#### Scenario: Closing membership preserves the row

- **WHEN** a DELETE-participant API call is made for an open row
- **THEN** the row's `period_end` MUST be set to `now()` and `unassigned_by` to the actor's user id; the row MUST NOT be physically deleted

#### Scenario: Cross-tenant user assignment rejected

- **WHEN** an insert attempts to set `user_id` to a user whose `tenant_id` differs from the care team's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: acting_as PractitionerRole must belong to the participant's practitioner

- **WHEN** an insert or update sets `acting_as_practitioner_role_id` to a `PractitionerRole` whose `practitioner.user_id` does not match the row's `user_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: acting_as PractitionerRole must share tenant with the care team

- **WHEN** an insert or update sets `acting_as_practitioner_role_id` to a `PractitionerRole` whose `tenant_id` differs from the care team's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: acting_as backfilled from on_behalf_of_organisation_id

- **WHEN** the `practitioner-role-split` migration runs against an existing database holding `care_team_participants` rows
- **THEN** each row's `acting_as_practitioner_role_id` MUST be populated by (1) resolving an open `PractitionerRole` whose `(practitioner.user_id, organisation_id)` matches the row's `(user_id, on_behalf_of_organisation_id)`, (2) falling back to that practitioner's `is_primary` open role, (3) leaving NULL if neither resolves — and the old `on_behalf_of_organisation_id` column MUST be dropped after the backfill succeeds

### Requirement: Role-in-care enum carries closed FHIR-aligned set

The backend SHALL define a Python `RoleInCare` StrEnum at `app/core/enums/care_team.py` with values `primary`, `consulting`, `observer`, persisted as Postgres enum type `role_in_care`. Future widening to a free codeable concept is an additive change with no value removal.

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs on a fresh database
- **THEN** a Postgres enum type `role_in_care` exists with exactly the values `('primary', 'consulting', 'observer')` in that order

### Requirement: Role-in-care changes are recorded as close-and-reopen rows

When a participant's `role_in_care` changes, the API SHALL close the existing open row (set `period_end = now()`, set `unassigned_by`) and insert a new open row carrying the new role and a `period_start = now()`. Direct mutation of `role_in_care` on an existing row SHALL NOT be exposed to the API.

#### Scenario: PATCH role produces two rows

- **WHEN** a PATCH-participant call changes `role_in_care` from `primary` to `consulting` for an existing open row
- **THEN** after the call, the database MUST contain two rows for that `(care_team_id, user_id)` pair — one closed with `role_in_care='primary'` and a non-NULL `period_end`, one open with `role_in_care='consulting'` and `period_end IS NULL`

### Requirement: Care teams API exposes per-patient lifecycle endpoints

The backend SHALL expose the following routes, all guarded by `require_role(Role.ADMIN, Role.CAREGIVER)` and `require_patient_access(patient_id)` where the patient is in scope:

- `GET /patients/{patient_id}/care-teams` — list current + historical teams for a patient, with embedded participant rows
- `POST /patients/{patient_id}/care-teams` — create a new team; optionally pass initial participants
- `PATCH /care-teams/{id}` — update `name`, `category`, `status`, or close the team via `period_end`
- `POST /care-teams/{id}/participants` — add a participant (open row)
- `PATCH /care-teams/{id}/participants/{user_id}` — change `role_in_care` via close-and-reopen
- `DELETE /care-teams/{id}/participants/{user_id}` — close current open row

Every route handler that applies an auth guard SHALL carry an `# AUTH-HARDEN` source comment.

#### Scenario: List embeds participants

- **WHEN** a caregiver calls `GET /patients/{id}/care-teams` for a patient they can access
- **THEN** each team in the response MUST include a `participants` array with `{user_id, role_in_care, period_start, period_end, on_behalf_of_organisation_id}` for every row (open + closed)

#### Scenario: Cross-tenant patient returns 404

- **WHEN** any of the patient-scoped routes is called with a `patient_id` belonging to a different tenant
- **THEN** the API MUST respond `404 Not Found`

#### Scenario: AUTH-HARDEN markers present

- **WHEN** the source of `app/api/routers/care_team/care_team_router.py` is inspected
- **THEN** every route handler that applies a role or patient-access guard MUST carry an `# AUTH-HARDEN` comment

### Requirement: Seed assigns demo caregiver to each demo patient

The seed pipeline SHALL produce, for each seeded patient, exactly one active `care_teams` row and exactly one open `care_team_participants` row whose `user_id` is the seeded demo caregiver and `role_in_care = primary`. `on_behalf_of_organisation_id` SHALL reference the caregiver's `organisation_id`. The seed SHALL be idempotent.

#### Scenario: Every demo patient has the demo caregiver as primary

- **WHEN** the full seed pipeline has run
- **THEN** every seeded patient MUST have at least one active care team with at least one open participant row whose `user_id` is the seeded caregiver and `role_in_care = primary`

#### Scenario: Re-running care-teams seed is idempotent

- **WHEN** the care-teams seed runs twice against the same database
- **THEN** the count of `care_teams` rows and `care_team_participants` rows after run 2 MUST equal the counts after run 1

