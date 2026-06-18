## MODIFIED Requirements

### Requirement: Practitioner table separates clinical identity from authentication identity

The backend SHALL persist a `practitioners` table where each row represents the FHIR `Practitioner` resource for exactly one caregiver `User`. `Practitioner` SHALL inherit `TenantOwnedEntity` and carry inherited audit columns plus `user_id` (UUID, NOT NULL, FK `users.id` ON DELETE RESTRICT, UNIQUE), `family_name` (varchar 255, NOT NULL), `given_name` (varchar 255, NOT NULL), `qualification` (text, NULLABLE). With the `Role` enum removed (`user-base` / `rbac-roles`), **caregiver identity is defined by the presence of a Practitioner row** — it is no longer a role. Eligibility SHALL therefore exclude the other identity-types: a user bound to the `admin` role, or a user with `patient_id` set, MUST NOT have a Practitioner row. The 1:1 split keeps authentication, session, and IdP code paths independent of clinical-identity fields and lets future login-less Practitioners be represented without forging User rows.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** a `practitioners` table exists with the inherited audit columns plus `user_id` (UUID NOT NULL, FK `users.id` ON DELETE RESTRICT, unique), `family_name` (varchar 255 NOT NULL), `given_name` (varchar 255 NOT NULL), `qualification` (text NULLABLE)

#### Scenario: Caregiver Practitioner is unique per user

- **WHEN** an attempt is made to insert a second `practitioners` row for the same `user_id`
- **THEN** the unique constraint MUST reject the insert

#### Scenario: Admin or patient user has no Practitioner row

- **WHEN** the service attempts to create a Practitioner for a `User` bound to the `admin` role or a `User` with `patient_id` set
- **THEN** the service layer MUST raise a domain error and the row MUST NOT persist

### Requirement: Practitioner and PractitionerRole API expose tenant-scoped admin CRUD plus caregiver self-read

The backend SHALL expose under `/practitioners` and `/practitioner-roles` admin CRUD plus caregiver self-read. Route guards SHALL use `require_permission(slug)` (`rbac-roles`) rather than the removed `require_role(Role.ADMIN/CAREGIVER)`: admin writes require `practitionerRole.create` / `practitionerRole.update` / `practitionerRole.delete` and `practitioner.*` equivalents; reads require the corresponding `*.read` slug, with a caregiver permitted to read only its own Practitioner. All routes SHALL stay tenant-scoped via the session actor's `tenant_id`; cross-tenant reads SHALL return `404`, never `403`. Every guarded route SHALL retain its `# AUTH-HARDEN` source comment.

#### Scenario: Caregiver can read its own Practitioner only

- **WHEN** a caregiver `C` calls `GET /practitioners/{user_id}` with `user_id != C.id`
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Missing-permission write rejected

- **WHEN** a user whose role lacks `practitionerRole.create` calls `POST /practitioner-roles`
- **THEN** the API MUST respond `403 Forbidden`
