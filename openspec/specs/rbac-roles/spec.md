# rbac-roles Specification

## Purpose
TBD - created by archiving change dynamic-rbac-roles-permissions. Update Purpose after archive.
## Requirements
### Requirement: App-function access is governed by tenant-scoped dynamic roles

App-function authorization SHALL be governed by tenant-scoped roles rather than a fixed `Role` enum. The backend SHALL persist a `roles` table (`id`, `tenant_id`, `slug`, `name`, `is_system`, inherited audit columns) with `slug` unique per tenant, and a `role_permissions` table (`role_id`, `permission`) joining a role to permission slugs. Each `users` row SHALL reference exactly one role through a NOT NULL `role_id` foreign key (the one-row-per-role model is preserved); the legacy `Role` Postgres enum and `users.role` column SHALL be removed. This layer is independent of Keto: Keto continues to govern per-patient data access, and the only seam between the two is the `patient.accessAll` permission.

#### Scenario: Tables created and enum removed by migration
- **WHEN** a fresh database is migrated to head
- **THEN** `roles` and `role_permissions` tables exist, `users.role_id` is a NOT NULL FK to `roles.id`, and neither the `users.role` column nor the `role` Postgres enum type exists

#### Scenario: Existing users mapped to roles
- **WHEN** the migration runs against a database whose users carry the legacy enum
- **THEN** users whose prior enum value was `admin` resolve to the seeded `admin` role and every other user resolves to the seeded `default` role

### Requirement: A role is a permission bundle; identity-type is derived from data

A role SHALL represent only a bundle of app-function permissions, not a clinical identity classification. Patient, caregiver, and external identities SHALL be derived from data, never from the role: a **patient** is a user with `patient_id` set, a **caregiver** is a user with a `Practitioner` row, and **external** status is derived from the organisation tree. Consequently the system SHALL seed only the `admin` and `default` roles — there SHALL be no `patient`, `caregiver`, or `external` role.

#### Scenario: Patient identity independent of role
- **WHEN** a patient user is inspected
- **THEN** their patient status derives from `patient_id IS NOT NULL` and they hold the `default` role like other non-admins, with no `patient` role existing

### Requirement: Permissions come from a code-defined catalog

Assignable permissions SHALL be a closed catalog defined in code (`app/core/enums/permission.py`), each entry a `resource.action` slug. CRUD actions SHALL use the canonical verbs `create | read | update | delete` (no synonyms), with domain verbs added only where a real action exists; there SHALL be no wildcard or `manage`-all alias (each `resource.action` is granted explicitly). The catalog SHALL gate config/admin resources and app actions only — patient *data* access verbs remain Keto's responsibility, with `patient.accessAll` the single seam. A `role_permissions` row's `permission` SHALL be validated against the catalog at the write boundary; a value outside the catalog MUST be rejected.

#### Scenario: Out-of-catalog permission rejected
- **WHEN** a write attempts to assign a permission slug not present in the code catalog
- **THEN** the service layer MUST reject it and persist no row

#### Scenario: Every catalog slug is enforced
- **WHEN** the catalog conformance test runs
- **THEN** every catalog permission MUST be referenced by at least one backend guard or be explicitly listed as frontend-only

### Requirement: Seeded roles bootstrap the model

The migration SHALL seed, per tenant, two undeletable `is_system` roles: `admin` (holding every catalog permission including `patient.accessAll`) and `default` (holding only `breakGlass.request`, otherwise empty). The `admin` role SHALL be granted to the bootstrap admin user so role management is possible immediately after migration. `is_system` roles MUST NOT be deletable.

#### Scenario: Admin role holds the full catalog
- **WHEN** the seed completes
- **THEN** the `admin` role's permission set equals the full code catalog and the bootstrap admin user is bound to it

#### Scenario: Default role keeps emergency access but no admin surfaces
- **WHEN** the seed completes
- **THEN** the `default` role holds `breakGlass.request` and no other permission, so non-admins can request break-glass but are denied admin/app-action surfaces until an admin grants more

#### Scenario: System role cannot be deleted
- **WHEN** a delete is attempted against an `is_system` role (`admin` or `default`)
- **THEN** the service layer MUST reject it

### Requirement: Permission-based guard replaces role checks and the Keto admin bypass

The backend SHALL expose `require_permission(slug)` resolving the session user's bound role to its effective permission set and denying with 403 when the slug is absent. It SHALL replace `require_role(...)` at config/admin and app-action routes. The patient-access bypass in `app/services/patient/deps.py` SHALL short-circuit to allow when the caller holds `patient.accessAll` (instead of the former `Role.ADMIN`), preserving tenant-wide patient read for admins without altering the Keto relation model.

#### Scenario: Missing permission denies
- **WHEN** a user whose role lacks `organisation.update` calls an organisation-edit route
- **THEN** the response is 403 and no mutation occurs

#### Scenario: patient.accessAll reproduces the admin bypass
- **WHEN** a user holding `patient.accessAll` requests any patient detail in their tenant
- **THEN** the response is 200 without a Keto check being required

### Requirement: RBAC gates app functions; Keto gates patient data

The two authorization layers SHALL be combined as a hybrid: RBAC answers *what a user may do* (config/admin resources and app actions) and Keto answers *which patient resources* a user may touch. Patient-data routes (patient list/detail, pathways and other patient-scoped reads/writes) SHALL remain authenticated + Keto-guarded and SHALL NOT carry an RBAC permission, except that `patient.accessAll` reproduces the Keto bypass. Config/admin and app-action routes SHALL be gated by `require_permission(slug)` with no Keto dimension. A route that is both an app action and patient-scoped MAY check both (defense in depth). Consequently a role with few permissions does NOT lose patient-care access — only admin/app-action surfaces.

#### Scenario: Default-role user keeps patient care
- **WHEN** a caregiver bound to the `default` role, with a Keto therapeutic relationship to patient P, requests P's detail
- **THEN** the response is 200 (patient-data access is Keto-driven, not RBAC-gated)

#### Scenario: Default-role user denied admin surfaces
- **WHEN** the same caregiver requests an organisation-admin or role-management route
- **THEN** the response is 403 (RBAC permission absent)

### Requirement: Role edits cannot amplify privilege

Role-management writes SHALL NOT let an actor grant a permission the actor does not already hold. The permission `patient.accessAll` and the `role.*` write actions (`role.create` / `role.update` / `role.delete`) SHALL be grantable only by a holder of the `admin` role, and `is_system` roles SHALL be editable only by an `admin`-role holder. These rules SHALL be enforced in the service layer, not only the router.

#### Scenario: No privilege amplification
- **WHEN** an actor able to edit roles but without `shieldingRule.update` attempts to add `shieldingRule.update` to any role
- **THEN** the service layer MUST reject the grant

#### Scenario: Crown-jewel permissions are admin-only
- **WHEN** a non-admin able to edit roles attempts to grant `patient.accessAll` or any `role.*` write action
- **THEN** the service layer MUST reject the grant

### Requirement: User-to-role assignment is escalation-guarded at the crown floor

Assigning a user to a role SHALL be gated by the assign permission (`user.update` / `role.update`). Assigning a user to the `admin` role, or to any role holding `patient.accessAll`, SHALL be permitted only to an `admin`-role holder (the crown floor). Assigning a user to any other (non-crown) role requires only the assign permission, with no subset check. Without the crown floor, the role-edit guard would be bypassable by self-assigning the existing all-powerful role.

#### Scenario: Non-admin cannot self-assign the admin role
- **WHEN** a non-admin holding the assign permission attempts to bind any user (including themselves) to the `admin` role or a `patient.accessAll`-holding role
- **THEN** the service layer MUST reject the assignment

#### Scenario: Normal role assignment needs only the permission
- **WHEN** a user holding the assign permission binds another user to a non-crown role
- **THEN** the assignment succeeds without a subset check

### Requirement: Role deletion is referentially safe and protects the last admin

A role bound to one or more users SHALL NOT be deletable (`users.role_id` is NOT NULL with `ON DELETE RESTRICT`); the caller MUST reassign or empty the role first. An empty, non-`is_system` role MAY be hard-deleted along with its `role_permissions`. The service layer SHALL forbid any operation that would leave a tenant with no user holding the admin capability (`patient.accessAll` plus role-write permissions) — including deleting/editing-away the `admin` role or unbinding its last member.

#### Scenario: Cannot delete a role with members
- **WHEN** a delete is attempted on a role that still has users bound to it
- **THEN** the operation MUST be rejected until the role is emptied

#### Scenario: Cannot remove the last admin
- **WHEN** an operation would leave the tenant with zero admin-capable users
- **THEN** the service layer MUST reject it

### Requirement: Roles exist for every tenant

The `admin` and `default` `is_system` roles SHALL be seeded for every tenant — by this change's migration for existing tenants and by tenant provisioning for tenants created afterwards. A tenant SHALL never exist without them, and the first admin provisioned into a tenant SHALL be bound to the `admin` role.

#### Scenario: New tenant gets system roles
- **WHEN** a new tenant is provisioned after this change is deployed
- **THEN** its `admin` and `default` roles exist and the bootstrap admin is bound to `admin`

### Requirement: Patient (mobile) routes are guarded by patient_id, not by role or permission

Patient (mobile) routes SHALL identify a patient by `users.patient_id IS NOT NULL` (plus Keto/ownership for any data), not by a role slug or RBAC permission; no `patient` role and no `patient.*` app-function permission SHALL exist. `users.patient_id` and the mobile authentication flow SHALL be unchanged; only the prior enum-literal role read SHALL move to the `patient_id` check.

#### Scenario: Patient mobile login unaffected
- **WHEN** a seeded patient logs in on the mobile app after the enum removal
- **THEN** the login succeeds, the route resolves the patient via `patient_id`, and `users.patient_id` is unchanged

### Requirement: Effective permissions are exposed to the client and kept fresh

The session payload (`/auth/me` and the login response) SHALL include the bound role's `slug` and its effective permission slugs, so the frontend can gate routes and controls. The frontend SHALL refetch the session permissions on navigation so a role-permission change is reflected within seconds. Frontend gating SHALL be a presentation affordance only; the backend permission guard remains the source of truth.

#### Scenario: Session returns effective permissions
- **WHEN** an authenticated user fetches their session
- **THEN** the payload includes the role slug and the array of effective permission slugs for the bound role

#### Scenario: Permission change reflected on navigation
- **WHEN** an admin changes a role's permissions and a bound user then navigates to a new route
- **THEN** the refetched session reflects the updated permission set (the backend guard already enforces it regardless)

### Requirement: Role and permission changes are audited

Role create / update / delete, permission-assignment changes, and role-to-user assignment SHALL be recorded through the audit service (`audit-trail-base`), attributing the actor and the change.

#### Scenario: Permission grant is audited
- **WHEN** an admin adds a permission to a role
- **THEN** an audit event records the actor, the role, and the granted permission

