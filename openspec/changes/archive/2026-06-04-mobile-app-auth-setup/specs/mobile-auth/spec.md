## ADDED Requirements

### Requirement: Mobile patient password login route

The backend SHALL expose `POST /mobile/auth/login/password` accepting a JSON body `{ tenant: string, email: string, password: string }`. The route SHALL resolve the tenant slug to a `tenant_id`; on unknown slug it SHALL respond `400` with body `{ detail: "Unknown tenant" }`. The route SHALL call the shared `authenticate_password()` service with `role_filter = (role) => role == 'patient'`. On invalid credentials, inactive user, soft-deleted user, or role mismatch, it SHALL respond `401` with body `{ detail: "Invalid credentials" }` — the same status and body regardless of the failure cause, to prevent user enumeration. On success it SHALL issue a `BACKEND_SESSION` cookie via the existing `issue_session_cookie()` helper (same cookie attributes as caregiver login) and return `200` with body `{ session: PatientSession }`.

#### Scenario: Successful mobile login issues the existing session cookie

- **WHEN** a request `POST /mobile/auth/login/password` with body `{ tenant: "zas", email: "patient@zas.local", password: <env BACKEND_BOOTSTRAP_PATIENT_PASSWORD> }` arrives against a seeded patient user
- **THEN** the response status is `200`
- **AND** the response body is `{ session: { id, given_name, patient_id, tenant_id } }`
- **AND** the response includes `Set-Cookie: BACKEND_SESSION=...; HttpOnly; SameSite=Lax; Path=/`
- **AND** a structured audit-log entry is emitted with fields `{ event: "login", outcome: "success", surface: "mobile", user_id, tenant_id }`

#### Scenario: Wrong password returns 401 with generic message

- **WHEN** the password does not match the user's `password_hash`
- **THEN** the response status is `401`
- **AND** the response body is `{ "detail": "Invalid credentials" }`
- **AND** an audit-log entry is emitted with `{ event: "login", outcome: "failure", surface: "mobile", reason: "bad_password" }`

#### Scenario: Caregiver email rejected from mobile route

- **WHEN** the supplied email belongs to a user with `role <> 'patient'` in the resolved tenant
- **THEN** the response status is `401`
- **AND** the response body is `{ "detail": "Invalid credentials" }`
- **AND** the audit-log `reason` field is `"role_mismatch"` while the response remains generic

#### Scenario: Inactive patient user is rejected as invalid credentials

- **WHEN** the matched user has `is_active = false` OR `deleted_at IS NOT NULL`
- **THEN** the response status is `401` with the generic body
- **AND** no session cookie is set

#### Scenario: Unknown tenant slug returns 400

- **WHEN** the `tenant` slug does not match any row in `tenants`
- **THEN** the response status is `400`
- **AND** the response body is `{ "detail": "Unknown tenant" }`
- **AND** no audit-log entry is emitted for an unknown-tenant login attempt (logged at WARN level only)

### Requirement: Mobile patient session endpoint returns the lean payload

The backend SHALL expose `GET /mobile/auth/me`. The route SHALL require the `BACKEND_SESSION` cookie (loaded by the existing session middleware) and SHALL return `401 { detail: "Unauthenticated" }` if the cookie is absent or invalid. The route SHALL additionally return `401` if the loaded user's `role <> 'patient'`. On success it SHALL return `200 { id, given_name, patient_id, tenant_id }` (the `PatientSession` shape) and SHALL NOT include `family_name`, `birth_date`, `gender`, `role`, `email`, or any clinical field.

#### Scenario: Authenticated patient gets PatientSession

- **WHEN** a request `GET /mobile/auth/me` arrives with a valid `BACKEND_SESSION` cookie for a `role = 'patient'` user
- **THEN** the response status is `200`
- **AND** the response body equals `{ id, given_name, patient_id, tenant_id }`
- **AND** the response body has no other top-level fields

#### Scenario: Caregiver cookie rejected from mobile me route

- **WHEN** a request `GET /mobile/auth/me` arrives with a valid `BACKEND_SESSION` cookie for a `role <> 'patient'` user
- **THEN** the response status is `401`
- **AND** the response body is `{ "detail": "Unauthenticated" }`

#### Scenario: Missing cookie returns 401

- **WHEN** a request `GET /mobile/auth/me` arrives with no `BACKEND_SESSION` cookie
- **THEN** the response status is `401`

### Requirement: Shared password verification service

The backend SHALL expose an internal `authenticate_password()` service at `app/auth/login_service.py`. The function SHALL accept `email`, `password`, `tenant_id`, `role_filter: Callable[[Role], bool]`, and a DB session. It SHALL load the user via `user_repo.find_by_email_in_tenant(...)`, reject the request with a single `InvalidCredentials` exception in every failure mode (no user found, `is_active = false`, `deleted_at IS NOT NULL`, `role_filter` returned `False`, password mismatch), and SHALL run the password verification step even on user-not-found / role-mismatch paths so that response timing does not differ between failure causes. The function SHALL return the loaded `User` on success. Both `POST /auth/login/password` and `POST /mobile/auth/login/password` SHALL call this function.

#### Scenario: Service is the single password-verification path

- **WHEN** a code search for `verify_password_hash` in `apps/backend/app/api/routers/**/*.py` is performed
- **THEN** zero call sites match — the only caller of the verifier is `apps/backend/app/auth/login_service.py`

#### Scenario: Service raises one exception for every rejection cause

- **WHEN** any of {user-not-found, inactive, soft-deleted, role-mismatch, bad-password} occurs
- **THEN** the service raises `InvalidCredentials` (no subclass that leaks the cause)
- **AND** internal logging records the cause without exposing it to the caller

#### Scenario: Constant-time rejection on role mismatch

- **WHEN** the loaded user is rejected by `role_filter`
- **THEN** the service still performs a password verification call against a dummy hash before raising `InvalidCredentials`, preserving response timing

### Requirement: Tenant slug resolver

The backend SHALL expose an internal `resolve_tenant_slug(slug: str, db) -> UUID` function at `app/auth/tenant_resolver.py`. The function SHALL match `tenants.slug` case-sensitively. Unknown slugs SHALL raise `UnknownTenant`, mapped to HTTP `400` at the route layer. The `tenants.slug` column SHALL exist (migration adds it if absent) with a UNIQUE constraint.

#### Scenario: Resolver returns tenant_id for the known PoC slug

- **WHEN** `resolve_tenant_slug("zas", db)` is called against a database seeded with the PoC tenant
- **THEN** the function returns the matching `tenants.id` UUID

#### Scenario: Unknown slug raises UnknownTenant

- **WHEN** `resolve_tenant_slug("does-not-exist", db)` is called
- **THEN** the function raises `UnknownTenant`

### Requirement: Audit log gains a surface field

The structured audit-log entry emitted by the shared login service SHALL include a `surface` field whose value is `"mobile"` for calls originating from the mobile-prefixed routes and `"caregiver"` for calls originating from the existing caregiver routes. No parallel log channel is introduced; the field is a single key on the existing log shape.

#### Scenario: Mobile login attempt logs surface=mobile

- **WHEN** any `POST /mobile/auth/login/password` request completes (success or failure)
- **THEN** the emitted log line includes `surface: "mobile"`

#### Scenario: Caregiver login attempt logs surface=caregiver

- **WHEN** any `POST /auth/login/password` request completes (success or failure)
- **THEN** the emitted log line includes `surface: "caregiver"`

### Requirement: PatientSession response model is the lean shape

`apps/backend/app/schemas/auth/mobile_session.py::PatientSession` SHALL be a Pydantic model with exactly these fields: `id: UUID`, `given_name: str`, `patient_id: UUID`, `tenant_id: UUID`. The model SHALL NOT include `family_name`, `birth_date`, `gender`, `email`, `role`, or any other patient demographic or clinical field. The OpenAPI schema SHALL register this model under the `mobile` tag.

#### Scenario: Model contains exactly four fields

- **WHEN** `PatientSession.model_fields` is inspected
- **THEN** the field set equals `{"id", "given_name", "patient_id", "tenant_id"}`

#### Scenario: OpenAPI registers PatientSession under the mobile tag

- **WHEN** the regenerated `apps/backend/openapi.json` is inspected
- **THEN** `paths["/mobile/auth/me"].get.responses["200"]` references `PatientSession`
- **AND** the route has the `mobile` tag

### Requirement: Seed step adds patient users only when env var is set

`scripts/seed_users.py` SHALL invoke a `seed_patient_users()` step after caregiver seeding. The step SHALL read `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` from the environment. If the variable is unset, the step SHALL exit non-zero with a message naming the missing variable (no silent skip). When set, the step SHALL create 1–2 `users` rows with `role = 'patient'`, linked to existing seeded patient rows via `patient_id`, with the hashed env-var password.

#### Scenario: Missing env var fails the seed

- **WHEN** `python -m scripts.seed_users` runs with `BACKEND_BOOTSTRAP_PATIENT_PASSWORD` unset
- **THEN** the script exits with a non-zero status
- **AND** stderr contains `BACKEND_BOOTSTRAP_PATIENT_PASSWORD`

#### Scenario: Env var present creates patient users linked to patients

- **WHEN** `python -m scripts.seed_users` runs with `BACKEND_BOOTSTRAP_PATIENT_PASSWORD=demo123`
- **THEN** the resulting `users` table contains at least one row with `role = 'patient'` and a non-NULL `patient_id`
- **AND** that row's `patient_id` matches an existing `patients.id`
