## ADDED Requirements

### Requirement: Caregiver password route filters out patient users

The existing `POST /auth/login/password` route SHALL be hardened so it never authenticates a user whose `role = 'patient'`. The route SHALL call the shared `authenticate_password()` service with `role_filter = (role) => role != 'patient'`. A leaked patient email + correct patient password attempted against the caregiver route SHALL return the same generic `401 { detail: "Invalid credentials" }` response as a wrong-password attempt.

#### Scenario: Patient email rejected from caregiver route

- **WHEN** `POST /auth/login/password` is called with valid patient credentials
- **THEN** the response status is `401`
- **AND** the response body is `{ "detail": "Invalid credentials" }`
- **AND** no `BACKEND_SESSION` cookie is set

### Requirement: LoginProvider registry stays single-row per kind

The `auth_providers` registry SHALL contain exactly one row per provider kind (today: one row for `password`). This change SHALL NOT add a second `password-mobile` registration. The role filter that distinguishes caregiver and mobile flows SHALL be supplied per-route by the caller of `authenticate_password()`, not encoded into a per-surface provider row.

#### Scenario: Auth providers table has one row for password

- **WHEN** `SELECT count(*) FROM auth_providers WHERE kind = 'password'` is executed
- **THEN** the result is exactly `1`

#### Scenario: Discovery endpoint still returns a single password provider

- **WHEN** `GET /auth/providers` is called
- **THEN** the response contains exactly one entry with `kind = 'password'`

## MODIFIED Requirements

### Requirement: PoC username/password verification path is shared

Password verification SHALL run through one service module — `apps/backend/app/auth/login_service.py::authenticate_password()`. The function SHALL be the single call site for the password hasher (`verify_password_hash`). Each surface-specific login route (caregiver `POST /auth/login/password`, mobile `POST /mobile/auth/login/password`) SHALL call this service with its own `role_filter` callable. The function SHALL raise a single `InvalidCredentials` exception in every failure mode and SHALL preserve constant-time behaviour by running the password verifier even on user-not-found and role-mismatch paths.

#### Scenario: Service is the only caller of the password verifier

- **WHEN** a code search for `verify_password_hash` in `apps/backend/app/api/routers/**/*.py` is performed
- **THEN** zero matches are found

#### Scenario: Each rejection cause raises the same exception type

- **WHEN** `authenticate_password()` rejects any of {user-not-found, inactive, soft-deleted, role-mismatch, bad-password}
- **THEN** the raised exception type is `InvalidCredentials` in every case
- **AND** the exception carries no public field naming the cause

#### Scenario: Caregiver route still authenticates caregivers

- **WHEN** `POST /auth/login/password` is called with valid caregiver credentials
- **THEN** the response status is `200`
- **AND** a `BACKEND_SESSION` cookie is set
- **AND** the response body matches the existing `SessionUser` shape (unchanged)
