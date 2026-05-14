## MODIFIED Requirements

### Requirement: Auth endpoint contract

The backend SHALL expose three auth routes under the `auth` tag:

- `POST /auth/login` accepts `LoginRequest { email: EmailStr, password: SecretStr }` and on success sets a signed session cookie and returns `SessionUser { id, email, display_name, tenant_id, role }` with status 200.
- `GET /auth/me` returns the `SessionUser` for the cookie owner with status 200, or 401 + `ErrorResponse{ code: "security.auth.unauthenticated" }` when no valid cookie is present.
- `POST /auth/logout` clears the session cookie and returns status 204.

Operation IDs MUST be `login_user`, `get_current_user`, and `logout_user` respectively.

#### Scenario: Successful login sets cookie

- **WHEN** a client POSTs valid credentials to `/auth/login`
- **THEN** the response is 200 with the `SessionUser` body, and the response carries a `Set-Cookie: BACKEND_SESSION=<signed>; HttpOnly; SameSite=Lax; Path=/` header

#### Scenario: SessionUser body shape

- **WHEN** `/auth/login` or `/auth/me` returns a `SessionUser`
- **THEN** the body MUST include exactly the fields `id` (UUID), `email` (string), `display_name` (string), `tenant_id` (UUID), `role` (one of `admin` / `caregiver` / `external`)

#### Scenario: Invalid credentials

- **WHEN** a client POSTs an unknown email or wrong password to `/auth/login`
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.invalid_credentials" }` and no cookie is set

#### Scenario: Inactive user cannot log in

- **WHEN** a client POSTs valid credentials for a user whose `is_active` is `False`
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.invalid_credentials" }` and no cookie is set

#### Scenario: `/auth/me` without a cookie

- **WHEN** a client GETs `/auth/me` with no `BACKEND_SESSION` cookie
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.unauthenticated" }`

#### Scenario: `/auth/me` with a tampered cookie

- **WHEN** the cookie value's signature does not verify
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.unauthenticated" }` and no information about why the verification failed leaks in the body

#### Scenario: `/auth/me` for deactivated user

- **WHEN** a client presents a valid signed cookie for a user whose `is_active` has since become `False`
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.unauthenticated" }`

#### Scenario: Logout clears the cookie

- **WHEN** a logged-in client POSTs `/auth/logout`
- **THEN** the response is 204 and carries a `Set-Cookie: BACKEND_SESSION=; Max-Age=0; Path=/` header

### Requirement: `CurrentUserDep` available to other routers

A dependency `CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]` SHALL be exported from `app/services/auth/deps.py` (re-exported from `app/services/auth/__init__.py`) and used by any route that requires an authenticated user. `get_current_user` MUST verify the cookie's signature, decode its `user_id`, re-load the corresponding `User` row from the database on every request, reject the request with 401 when the user is missing or `is_active = False`, and convert the loaded `User` to a `SessionUser` for the handler.

#### Scenario: Routes opt into auth

- **WHEN** a future router declares a handler `def list_pathways(user: CurrentUserDep) -> ...`
- **THEN** the handler receives the validated `SessionUser` (including `tenant_id` and `role`) and responds 401 (via the dependency) when the cookie is missing or invalid

#### Scenario: Role change visible on next request

- **WHEN** an admin updates a user's role via `PATCH /users/{id}/role`, and that user makes their next authenticated request
- **THEN** the `SessionUser` injected into the handler MUST reflect the new role without requiring re-login

## ADDED Requirements

### Requirement: DB-backed user store replaces in-memory dict

The backend SHALL authenticate users by looking them up via `UserRepository` against the `users` table. There SHALL NOT be an in-memory user dictionary anywhere in `app/services/auth/`. The `AuthService` MUST receive a `UserRepository` instance through its constructor.

#### Scenario: Login succeeds against seeded admin

- **WHEN** a client POSTs `/auth/login` with the seeded bootstrap admin credentials
- **THEN** the response is 200 with a `SessionUser` whose `email = "admin@zas.local"`, `role = "admin"`, and `tenant_id` equal to the seeded `zas` tenant id

#### Scenario: No module-level mutable user store

- **WHEN** a developer inspects every file under `app/services/auth/`
- **THEN** no module-level dict, list, or set containing user records MUST exist; user data lives only in the database

### Requirement: Authenticator Protocol seam

The backend SHALL define an `Authenticator` Protocol in `app/services/auth/authenticator.py` exposing at minimum `async def authenticate(self, *, email: str, password: str) -> User | None`. A `PasswordAuthenticator` implementation MUST satisfy this Protocol by verifying the input password against the user's `password_hash` via a `PasswordHasher` wrapper around `argon2-cffi`. `AuthService` MUST accept an `Authenticator` (the Protocol type, not the concrete class) in its constructor.

#### Scenario: Authenticator injectable

- **WHEN** a test constructs `AuthService` with a `FakeAuthenticator` implementing the Protocol
- **THEN** `AuthService.login` MUST drive the fake without touching the real password hasher or repository

#### Scenario: Wrong password rejected

- **WHEN** `PasswordAuthenticator.authenticate(email="admin@zas.local", password="wrong")` is awaited
- **THEN** it MUST return `None`

#### Scenario: Correct password accepted

- **WHEN** `PasswordAuthenticator.authenticate(email="admin@zas.local", password=<seeded admin password>)` is awaited
- **THEN** it MUST return the matching `User` row

### Requirement: `require_role` factory dep guards admin-only routes

The backend SHALL export a callable `require_role(role: Role)` from `app/services/auth/deps.py` (re-exported from `app/services/auth/__init__.py`) that returns a FastAPI dependency. The returned dependency MUST resolve `CurrentUserDep` and raise `ForbiddenRoleError` (`forbidden.auth.role`, 403) when `current_user.role` does not equal the required role.

#### Scenario: Allowed role passes

- **WHEN** a route declares `Depends(require_role(Role.ADMIN))` and the current user has `role = Role.ADMIN`
- **THEN** the dependency MUST return the `SessionUser` and the handler MUST execute

#### Scenario: Disallowed role rejected

- **WHEN** a route declares `Depends(require_role(Role.ADMIN))` and the current user has `role = Role.CAREGIVER`
- **THEN** the response MUST be 403 with `ErrorResponse{ code: "forbidden.auth.role" }`

### Requirement: Production startup rejects default session secret

The backend SHALL fail fast at startup when `Settings.env == "production"` and `Settings.session_secret_key` still equals the development default literal `"change-me-in-production"`. The check MUST run during the FastAPI lifespan startup phase, before any request is accepted, and MUST raise a `RuntimeError` with a message identifying `session_secret_key` as the misconfigured field.

In non-production environments (`env in {"local", "test", "ci", ...}`) the default value is permitted so local dev and the test suite boot without requiring an explicit secret.

#### Scenario: Production boot with default secret aborts

- **WHEN** the FastAPI app starts with `BACKEND_ENV=production` and `BACKEND_SESSION_SECRET_KEY` unset (so the default `"change-me-in-production"` applies)
- **THEN** the lifespan startup MUST raise `RuntimeError` mentioning `session_secret_key` and the app MUST NOT begin accepting requests

#### Scenario: Production boot with overridden secret succeeds

- **WHEN** the FastAPI app starts with `BACKEND_ENV=production` and `BACKEND_SESSION_SECRET_KEY` set to any value other than `"change-me-in-production"`
- **THEN** the lifespan startup MUST complete normally

#### Scenario: Non-production boot with default secret succeeds

- **WHEN** the FastAPI app starts with `BACKEND_ENV=local` (or `test`) and `BACKEND_SESSION_SECRET_KEY` unset
- **THEN** the lifespan startup MUST complete normally with no error raised

## REMOVED Requirements

### Requirement: In-memory user store is POC-only

**Reason**: Replaced by the DB-backed `UserRepository` introduced by the `user-base` capability. The in-memory dict was a placeholder for the unimplemented spec; no migration of stored data is needed because no environment ever held data in the dict.

**Migration**: Delete any references to a module-level user dict in `app/services/auth_service.py` (the file is replaced by `app/services/auth/auth_service.py` under the per-domain split). Update tests that constructed user fixtures via the dict to seed `users` rows through the repository instead — see `tests/repositories/user/` and `tests/services/auth/` for fixture patterns.
