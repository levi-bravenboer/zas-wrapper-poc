## MODIFIED Requirements

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

