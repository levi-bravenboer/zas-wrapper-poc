## ADDED Requirements

### Requirement: Admin user list

The orchestrator SHALL expose `/instellingen` as an admin-only page rendering a list of users with username, role, and a role-assign action. Non-admin caregivers MUST receive a forbidden state with no row content.

#### Scenario: Admin sees the list

- **WHEN** the bootstrapped admin opens `/instellingen`
- **THEN** the page renders one row per user with username and role

#### Scenario: Caregiver forbidden

- **WHEN** a non-admin caregiver opens `/instellingen`
- **THEN** the page renders a forbidden state and no row content

### Requirement: Role assignment

Clicking the role-assign action SHALL call `POST /users/{id}/role` with `{ role: "caregiver" | "admin" }`. The action is only available to admins; admins MUST NOT be allowed to revoke their own admin role in PoC.

#### Scenario: Admin assigns caregiver role

- **WHEN** the admin assigns role `caregiver` to user `u2`
- **THEN** the row updates to show `caregiver`

#### Scenario: Self-demotion blocked

- **WHEN** the admin tries to assign `caregiver` to themselves
- **THEN** the backend rejects with `ErrorResponse.code = "admin.self_demotion_forbidden"`

### Requirement: Backend admin router

The backend SHALL expose `GET /users` and `POST /users/{id}/role`. Both routes MUST require admin role; non-admin requests return `403` with `security.auth.forbidden`.

#### Scenario: Caregiver forbidden

- **WHEN** an authenticated caregiver (not admin) calls `GET /users`
- **THEN** the response is `403` with `security.auth.forbidden`

### Requirement: Bootstrapped admin

The backend SHALL seed exactly one admin user during Alembic data migration using `BACKEND_BOOTSTRAP_ADMIN_USERNAME` and `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` settings. The seed MUST be idempotent — re-running migrations on a populated DB MUST NOT duplicate the admin row.

#### Scenario: Re-run safe

- **WHEN** Alembic data migration runs against a DB that already contains the admin user
- **THEN** the migration completes without duplicating the row
