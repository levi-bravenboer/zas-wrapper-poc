# auth-stub Specification

## Purpose
TBD - created by archiving change backend-setup. Update Purpose after archive.
## Requirements
### Requirement: Auth endpoint contract

The backend SHALL expose three auth routes under the `auth` tag:

- `POST /auth/login` accepts `LoginRequest { username: str, password: str }` and on success sets a signed session cookie and returns `SessionUser { id, username, display_name }` with status 200.
- `GET /auth/me` returns the `SessionUser` for the cookie owner with status 200, or 401 + `ErrorResponse{ code: "auth.unauthenticated" }` when no valid cookie is present.
- `POST /auth/logout` clears the session cookie and returns status 204.

Operation IDs MUST be `login_user`, `get_current_user`, and `logout_user` respectively.

#### Scenario: Successful login sets cookie

- **WHEN** a client POSTs valid credentials to `/auth/login`
- **THEN** the response is 200 with the user body, and the response carries a `Set-Cookie: BACKEND_SESSION=<signed>; HttpOnly; SameSite=Lax; Path=/` header

#### Scenario: Invalid credentials

- **WHEN** a client POSTs an unknown username or wrong password
- **THEN** the response is 401 with `ErrorResponse{ code: "auth.invalid_credentials" }` and no cookie is set

#### Scenario: `/auth/me` without a cookie

- **WHEN** a client GETs `/auth/me` with no `BACKEND_SESSION` cookie
- **THEN** the response is 401 with `ErrorResponse{ code: "auth.unauthenticated" }`

#### Scenario: `/auth/me` with a tampered cookie

- **WHEN** the cookie value's signature does not verify
- **THEN** the response is 401 with `ErrorResponse{ code: "auth.unauthenticated" }` and no information about why the verification failed leaks in the body

#### Scenario: Logout clears the cookie

- **WHEN** a logged-in client POSTs `/auth/logout`
- **THEN** the response is 204 and carries a `Set-Cookie: BACKEND_SESSION=; Max-Age=0; Path=/` header

### Requirement: Cookie security flags

Session cookies SHALL be set with `HttpOnly=True`, `SameSite=Lax`, `Path="/"`. The `Secure` flag MUST be `True` when `Settings.env == "production"` and MAY be `False` otherwise.

#### Scenario: Production cookie is Secure

- **WHEN** the app runs with `BACKEND_ENV=production` and a user logs in
- **THEN** the `Set-Cookie` header includes the `Secure` attribute

### Requirement: Session signing

Cookie values SHALL be produced by `itsdangerous.URLSafeTimedSerializer` keyed on `Settings.session_secret_key`. Tokens MUST be rejected when older than 8 hours.

#### Scenario: Expired session rejected

- **WHEN** a client presents a session cookie minted 9 hours ago to `/auth/me`
- **THEN** the response is 401 with `ErrorResponse{ code: "auth.unauthenticated" }`

### Requirement: In-memory user store is POC-only

The backing user store SHALL be an in-memory dict in `app/services/auth_service.py`. The module MUST carry a top-level `# POC ONLY` banner naming the future change that replaces it.

#### Scenario: Banner present

- **WHEN** a developer opens `app/services/auth_service.py`
- **THEN** the first comment in the file reads `# POC ONLY — replaced by IdP integration. Do not extend.`

### Requirement: `CurrentUserDep` available to other routers

A dependency `CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]` SHALL be exported from `app/api/dependencies.py` and used by any route that requires an authenticated user.

#### Scenario: Routes opt into auth

- **WHEN** a future router declares a handler `def list_pathways(user: CurrentUserDep) -> ...`
- **THEN** the handler receives the validated `SessionUser` and responds 401 (via the dependency) when the cookie is missing or invalid

