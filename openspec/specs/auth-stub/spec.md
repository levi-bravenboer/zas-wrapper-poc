# auth-stub Specification

## Purpose
TBD - created by archiving change backend-setup. Update Purpose after archive.
## Requirements
### Requirement: Auth endpoint contract

The backend SHALL expose the following auth routes under the `auth` tag:

- `GET /auth/providers` returns the enabled login providers as `list[ProviderDescriptor]` with status 200. Operation id: `list_login_providers`. Unauthenticated (anyone hitting `/login` needs the list).
- `POST /auth/login/password` accepts `LoginRequest { email: EmailStr, password: SecretStr }` and on success sets a signed session cookie and returns `SessionUser { id, email, display_name, tenant_id, role }` with status 200. Operation id: `login_password`.
- `GET /auth/me` returns the `SessionUser` for the cookie owner with status 200, or 401 + `ErrorResponse{ code: "security.auth.unauthenticated" }` when no valid cookie is present. Operation id: `get_current_user`.
- `POST /auth/logout` clears the session cookie and returns status 204. Operation id: `logout_user`.

The following routes are RESERVED for OIDC providers and MUST NOT be implemented by this change:

- `GET /auth/login/{provider}/start` — initiates an OIDC redirect dance. Future operation id: `start_login_{provider}`.
- `GET /auth/login/{provider}/callback` — exchanges the IdP code for a session cookie and 302s to the post-login destination. Future operation id: `callback_login_{provider}`.

The legacy `POST /auth/login` route MUST be removed.

#### Scenario: Successful password login sets cookie

- **WHEN** a client POSTs valid credentials to `/auth/login/password`
- **THEN** the response is 200 with the `SessionUser` body, and the response carries a `Set-Cookie: BACKEND_SESSION=<signed>; HttpOnly; SameSite=Lax; Path=/` header

#### Scenario: SessionUser body shape

- **WHEN** `/auth/login/password` or `/auth/me` returns a `SessionUser`
- **THEN** the body MUST include exactly the fields `id` (UUID), `email` (string), `display_name` (string), `tenant_id` (UUID), `role` (one of `admin` / `caregiver` / `external`)

#### Scenario: Invalid credentials

- **WHEN** a client POSTs an unknown email or wrong password to `/auth/login/password`
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.invalid_credentials" }` and no cookie is set

#### Scenario: Inactive user cannot log in

- **WHEN** a client POSTs valid credentials for a user whose `is_active` is `False`
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.invalid_credentials" }` and no cookie is set

#### Scenario: External-only user cannot password-log-in

- **WHEN** a client POSTs valid credentials for a user whose `password_hash IS NULL` (an OIDC-only identity)
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

#### Scenario: Legacy `POST /auth/login` is gone

- **WHEN** a client POSTs to `/auth/login`
- **THEN** the response is 404 (or 405 with `Allow` not listing POST). No alias, no redirect.

### Requirement: Cookie security flags

Session cookies SHALL be set with `HttpOnly=True`, `SameSite=Lax`, `Path="/"`. The `Secure` flag MUST be `True` when `Settings.env == "production"` and MAY be `False` otherwise.

#### Scenario: Production cookie is Secure

- **WHEN** the app runs with `BACKEND_ENV=production` and a user logs in
- **THEN** the `Set-Cookie` header includes the `Secure` attribute

### Requirement: Session signing
Session cookies SHALL carry the Ory Kratos session token; the backend MUST NOT sign or interpret the token itself. Verification SHALL happen by forwarding the cookie to Kratos `GET /sessions/whoami` on each request. Session lifetime SHALL be configured in Kratos (`session.lifespan`, set to 8 hours to preserve the prior contract); tokens for expired or revoked sessions MUST be rejected. The `itsdangerous`-based serializer SHALL be removed from the auth path. Cookie naming MUST continue to resolve via `Settings.session_cookie_name` (`BACKEND_SESSION`, `__Host-` prefixed in production).

#### Scenario: Expired session rejected
- **WHEN** a client presents a session cookie whose Kratos session has passed its 8-hour lifespan to `/auth/me`
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.unauthenticated" }`

#### Scenario: Revoked session rejected
- **WHEN** a session is revoked server-side (logout, admin action, or user deactivation) and the client replays the cookie
- **THEN** the response is 401 with `ErrorResponse{ code: "security.auth.unauthenticated" }`

#### Scenario: No local signing
- **WHEN** a developer inspects the auth session path after this change
- **THEN** no `itsdangerous` serializer is constructed for session cookies

### Requirement: `CurrentUserDep` available to other routers
A dependency `CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]` SHALL be exported from `app/services/access/identity/deps.py` (re-exported from `app/services/access/identity/__init__.py`) and used by any route that requires an authenticated user. `get_current_user` MUST resolve the session by calling Kratos `whoami` with the request's session cookie, map `identity.id` to the local `users` row via the `(external_idp='kratos', external_subject)` lookup, re-load that `User` row from the database on every request, reject the request with 401 when the session is invalid/revoked or the user is missing or `is_active = False`, and convert the loaded `User` to a `SessionUser` for the handler.

#### Scenario: Routes opt into auth
- **WHEN** a future router declares a handler `def list_pathways(user: CurrentUserDep) -> ...`
- **THEN** the handler receives the validated `SessionUser` (including `tenant_id` and `role`) and responds 401 (via the dependency) when the session cookie is missing, invalid, or revoked

#### Scenario: Role change visible on next request
- **WHEN** an admin updates a user's role via `PATCH /users/{id}/role`, and that user makes their next authenticated request
- **THEN** the `SessionUser` injected into the handler MUST reflect the new role without requiring re-login

### Requirement: DB-backed user store replaces in-memory dict

The backend SHALL authenticate users by looking them up via `UserRepository` against the `users` table. There SHALL NOT be an in-memory user dictionary anywhere in `app/services/access/identity/`. The `AuthService` MUST receive a `UserRepository` instance through its constructor.

#### Scenario: Login succeeds against seeded admin

- **WHEN** a client POSTs `/auth/login` with the seeded bootstrap admin credentials
- **THEN** the response is 200 with a `SessionUser` whose `email = "admin@zas.local"`, `role = "admin"`, and `tenant_id` equal to the seeded `zas` tenant id

#### Scenario: No module-level mutable user store

- **WHEN** a developer inspects every file under `app/services/access/identity/`
- **THEN** no module-level dict, list, or set containing user records MUST exist; user data lives only in the database

### Requirement: Authenticator Protocol seam
The backend SHALL define an `Authenticator` Protocol in `app/services/access/identity/authenticator.py` exposing at minimum `async def authenticate(self, *, email: str, password: str) -> User | None`. A `KratosAuthenticator` implementation MUST satisfy this Protocol by submitting a Kratos native login flow with the supplied credentials and, on success, mapping the returned identity to the local `User` row; it MUST return `None` on any Kratos login failure (wrong password, unknown identity, disabled identity) without distinguishing causes to the caller. The previous `PasswordAuthenticator` and `PasswordHasher` verification path SHALL no longer be wired into the login route (retained only by the import/rollback tooling). `AuthService` MUST continue to accept an `Authenticator` (the Protocol type, not the concrete class) in its constructor; the Protocol remains the credential-verification seam consumed exclusively by `PasswordLoginProvider`.

#### Scenario: Authenticator injectable
- **WHEN** a test constructs `AuthService` with a `FakeAuthenticator` implementing the Protocol
- **THEN** `AuthService.login` MUST drive the fake without any Kratos network call

#### Scenario: Wrong password rejected
- **WHEN** `KratosAuthenticator.authenticate(email="admin@zas.local", password="wrong")` is awaited
- **THEN** it MUST return `None`

#### Scenario: Correct password accepted
- **WHEN** `KratosAuthenticator.authenticate(email="admin@zas.local", password=<seeded admin password>)` is awaited
- **THEN** it MUST return the matching `User` row mapped from the Kratos identity

### Requirement: `OptionalCurrentUserDep` populates the audit session slot

The backend SHALL export `OptionalCurrentUserDep = Annotated[SessionUser | None, Depends(get_optional_current_user)]` from `app/services/access/identity/deps.py` (re-exported from `app/services/access/identity/__init__.py`). `get_optional_current_user` MUST share the same cookie-decode + user-reload logic as `get_current_user`, returning the resolved `SessionUser` on success and `None` (no raise) when the cookie is missing, tampered, expired, or refers to a missing / deactivated user.

`app/db/engine.get_session` SHALL consume `OptionalCurrentUserDep` and write `session.info[SESSION_ACTOR_KEY] = current_user` when not `None`, so the audit hook introduced in `backend-tenant-base` auto-stamps `tenant_id` / `created_by` / `updated_by` / `deleted_by` on every authenticated request. Unauthenticated requests MUST yield a session with the slot unset; the hook MUST stay a no-op in that path.

#### Scenario: Authenticated request stamps audit fields

- **WHEN** an authenticated route handler causes `session.add(<new AuditableEntity>)` followed by a flush
- **THEN** the resulting row's `tenant_id` / `created_by` / `updated_by` MUST equal the requesting user's `tenant_id` / `id` even when the handler did not set them explicitly

#### Scenario: Unauthenticated request leaves audit slot empty

- **WHEN** a request with no `BACKEND_SESSION` cookie reaches a handler that flushes a non-auditable `Entity` row (e.g. health writes)
- **THEN** the flush MUST succeed and `session.info[SESSION_ACTOR_KEY]` MUST be unset (the audit hook makes no changes)

### Requirement: `require_role` factory dep guards admin-only routes

The backend SHALL export a callable `require_role(*roles: Role)` from `app/services/access/identity/deps.py` (re-exported from `app/services/access/identity/__init__.py`) that returns a FastAPI dependency. The factory SHALL accept one or more `Role` values via variadic positional arguments. The returned dependency MUST resolve `CurrentUserDep` and raise `ForbiddenRoleError` (`forbidden.auth.role`, 403) when `current_user.role` is not in the set of accepted roles. When called with a single role, behaviour MUST match the prior single-role contract (no breakage at existing call sites).

#### Scenario: Allowed role passes (single-role guard)

- **WHEN** a route declares `Depends(require_role(Role.ADMIN))` and the current user has `role = Role.ADMIN`
- **THEN** the dependency MUST return the `SessionUser` and the handler MUST execute

#### Scenario: Disallowed role rejected (single-role guard)

- **WHEN** a route declares `Depends(require_role(Role.ADMIN))` and the current user has `role = Role.CAREGIVER`
- **THEN** the response MUST be 403 with `ErrorResponse{ code: "forbidden.auth.role" }`

#### Scenario: Any of multiple roles passes

- **WHEN** a route declares `Depends(require_role(Role.ADMIN, Role.CAREGIVER))` and the current user has `role = Role.CAREGIVER`
- **THEN** the dependency MUST return the `SessionUser` and the handler MUST execute

#### Scenario: None of the listed roles matches

- **WHEN** a route declares `Depends(require_role(Role.ADMIN, Role.CAREGIVER))` and the current user has a role outside that set
- **THEN** the response MUST be 403 with `ErrorResponse{ code: "forbidden.auth.role" }`

#### Scenario: Empty role set is a programmer error

- **WHEN** `require_role()` is called with no arguments
- **THEN** the call MUST raise `ValueError` at module load / route wiring time (not at request time)

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

### Requirement: LoginProvider Protocol owns route handlers

The backend SHALL define a `LoginProvider` Protocol in `app/services/access/identity/providers/base.py` with at minimum the following surface:

```python
class LoginProvider(Protocol):
    key: str                          # 'password', and later 'eid', 'itsme', 'csam'
    label: str                        # human-readable label for the providers endpoint
    kind: Literal['password', 'oidc'] # render strategy hint for the frontend
```

Provider implementations live under `app/services/access/identity/providers/`. The PoC ships exactly one implementation, `PasswordLoginProvider` (`app/services/access/identity/providers/password.py`), which exposes an `async authenticate(email: str, password: SecretStr) -> SessionUser` method and consumes the existing `Authenticator` Protocol internally. OIDC-shaped providers MUST be defined in their own modules at MVP time; this change does NOT ship any.

The `LoginProvider` Protocol is the *route-shape* seam. The `Authenticator` Protocol (kept for backwards compatibility with the password flow) is the *credential-check* seam consumed by `PasswordLoginProvider`. The auth router MUST wire concrete provider methods into concrete routes (one HTTP handler per (provider × method) pair) — kind-based dispatch inside a single handler is FORBIDDEN.

#### Scenario: Password provider conforms to Protocol

- **WHEN** `PasswordLoginProvider` is checked against the `LoginProvider` Protocol via `isinstance(provider, LoginProvider)` or `mypy --strict`
- **THEN** the check MUST pass, with `key == "password"`, `kind == "password"`, and a non-empty `label`

#### Scenario: Provider authenticate mints session

- **WHEN** a router handler calls `await password_provider.authenticate(email=..., password=...)` with valid credentials
- **THEN** the call MUST return a `SessionUser` matching the looked-up user; on failure it MUST raise `InvalidCredentialsError`

### Requirement: Provider registry exposes enabled providers

The backend SHALL expose a `LoginProviderRegistry` (in `app/services/access/identity/providers/registry.py`) that constructs and lists the providers enabled for a given deployment. The registry MUST be a constructor dep on `AuthService` (or a sibling service consumed by the router), MUST contain at minimum the `password` provider in PoC, and MUST return providers in a stable order. The registry is the single source of truth for `GET /auth/providers` responses.

#### Scenario: PoC registry exposes password only

- **WHEN** the registry is constructed under PoC settings
- **THEN** `registry.list()` MUST return `[PasswordLoginProvider(...)]` with no other entries

#### Scenario: Registry order is stable

- **WHEN** `registry.list()` is awaited twice within the same process
- **THEN** both calls MUST return the same providers in the same order

### Requirement: `/auth/providers` returns the registry contents

The backend SHALL expose `GET /auth/providers` (operation id `list_login_providers`, unauthenticated) returning `list[ProviderDescriptor]`, where `ProviderDescriptor` is a Pydantic model with exactly the fields `key` (string), `label` (string), and `kind` (`"password"` or `"oidc"`). The response MUST be derived from `LoginProviderRegistry.list()` — adding a provider at MVP MUST NOT require editing this route handler.

#### Scenario: PoC providers response

- **WHEN** a client GETs `/auth/providers` under PoC settings
- **THEN** the response is 200 with body `[{"key": "password", "label": "E-mail + wachtwoord", "kind": "password"}]`

#### Scenario: Response shape stable

- **WHEN** a client GETs `/auth/providers`
- **THEN** every entry MUST contain exactly `key`, `label`, `kind` — no additional fields and no missing fields

#### Scenario: Endpoint is unauthenticated

- **WHEN** a client GETs `/auth/providers` with no `BACKEND_SESSION` cookie
- **THEN** the response is 200 (not 401); the list of providers is non-sensitive

### Requirement: Login events are audit-logged

The backend SHALL emit a structured audit log line on every login attempt (success and failure) and on every logout. The event MUST carry at minimum: timestamp (ISO 8601 UTC), event name (`auth.login.success` / `auth.login.failure` / `auth.logout`), provider key (`"password"` for now), client IP (from `X-Forwarded-For` last hop or socket peer), user agent, user id when known (success and logout always; failure when the email matched a row), and a failure reason code for failures (`invalid_credentials`, `inactive_user`, `null_password_hash`, `tampered_cookie`). The event MUST NOT include the password, the cookie value, or the user's email when the email did not match a row (avoid confirming account existence). In PoC the events MUST be written via the existing structured logger (one event per line, JSON-shaped); MVP promotes them to a queryable `auth_audit` table per `BL-042`.

#### Scenario: Successful login logged

- **WHEN** a client successfully POSTs to `/auth/login/password`
- **THEN** a single `auth.login.success` event MUST be emitted with the user's id, provider key `"password"`, IP, and user agent — no password or cookie value MUST appear in the log line

#### Scenario: Wrong-password failure logged with reason

- **WHEN** a client POSTs `/auth/login/password` with a known email and wrong password
- **THEN** a single `auth.login.failure` event MUST be emitted with `reason: "invalid_credentials"` and the user's id; the password MUST NOT appear

#### Scenario: Unknown-email failure logged without leaking existence

- **WHEN** a client POSTs `/auth/login/password` with an email that does not match any row
- **THEN** a single `auth.login.failure` event MUST be emitted with `reason: "invalid_credentials"` and `user_id: null`; the supplied email MUST NOT appear in the log line (no account-existence oracle)

#### Scenario: Logout logged

- **WHEN** an authenticated client POSTs to `/auth/logout`
- **THEN** a single `auth.logout` event MUST be emitted with the user's id

### Requirement: Production cookie name carries `__Host-` prefix

When `Settings.env == "production"`, the session cookie name SHALL be prefixed `__Host-` (i.e., the production cookie name MUST be `__Host-BACKEND_SESSION`). Browsers honour the `__Host-` prefix as an extra binding requiring `Secure`, `Path=/`, and the absence of the `Domain` attribute — together they prevent subdomain cookie injection. In non-production environments the cookie name SHALL remain `BACKEND_SESSION` so local development and the Vitest / Playwright runners do not need protocol-aware cookie handling.

#### Scenario: Production sets prefixed cookie

- **WHEN** the app runs with `BACKEND_ENV=production` and a user successfully logs in
- **THEN** the response `Set-Cookie` header MUST name the cookie `__Host-BACKEND_SESSION`, carry `Secure`, carry `Path=/`, and MUST NOT carry a `Domain=` attribute

#### Scenario: Non-production keeps unprefixed cookie

- **WHEN** the app runs with `BACKEND_ENV=local` (or `test` / `ci`) and a user successfully logs in
- **THEN** the response `Set-Cookie` header MUST name the cookie `BACKEND_SESSION` and the `Secure` attribute MAY be absent

#### Scenario: Cookie name read consistently

- **WHEN** any auth code path (login set-cookie, `/auth/me` cookie read, logout clear-cookie, `resolve_actor_from_request`) needs the cookie name
- **THEN** it MUST resolve the name via `Settings.session_cookie_name` (which encapsulates the prefix logic), not via a hard-coded string

### Requirement: External subject never holds a Belgian RRN

The `User.external_subject` column SHALL only ever store the IdP-issued opaque subject identifier (e.g., itsme® `sub`, CSAM `sub`, eID broker-issued subject). It MUST NOT store the Belgian Rijksregisternummer (RRN / national register number). The Belgian Wet 8 augustus 1983 + Sectoral Committee authorization regime restricts RRN processing; brokering the RRN-to-`sub` mapping is NewWave Care's responsibility, and our system MUST consume only the broker-issued opaque value.

Provider implementations SHALL document in code comments the exact IdP claim they map into `external_subject` and SHALL NOT accept the RRN claim even when an IdP exposes it.

#### Scenario: Format check rejects RRN-shaped subject

- **WHEN** any provider implementation attempts to write a value to `external_subject` that matches the Belgian RRN format (11 digits, the documented check-digit pattern)
- **THEN** the operation MUST raise an `InvalidExternalSubjectError` and MUST NOT persist the value — the provider has misidentified the claim

#### Scenario: Opaque subject persists

- **WHEN** an OIDC provider receives a `sub` claim like `"BE-itsme-abc123def456"` from the IdP and persists it
- **THEN** the write succeeds and the value is stored verbatim in `external_subject`

### Requirement: Production seed refuses default bootstrap password

The `scripts/seed_users.py` module SHALL refuse to run when `Settings.env == "production"` and either `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` or `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` is unset. The refusal MUST raise a `RuntimeError` naming the missing env var; the `"changeme"` fallback is PoC-only and MUST NOT be silently used in production. Non-production environments keep the existing fallback behaviour so local dev and CI boot without configuration.

#### Scenario: Production seed without env aborts

- **WHEN** `python -m scripts.seed_users` runs with `BACKEND_ENV=production` and `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` unset
- **THEN** the command MUST exit non-zero with a `RuntimeError` whose message names `BACKEND_BOOTSTRAP_ADMIN_PASSWORD`; no user row MUST be inserted

#### Scenario: Production seed with env succeeds

- **WHEN** both bootstrap password env vars are set and `BACKEND_ENV=production`
- **THEN** the command MUST succeed normally with no warning about the fallback

#### Scenario: Non-production seed still allows fallback

- **WHEN** `python -m scripts.seed_users` runs with `BACKEND_ENV=local` and the env vars unset
- **THEN** the command MUST succeed using the `"changeme"` fallback and emit a `WARNING` log line (existing behaviour preserved)

### Requirement: Server-side session revocation
The backend SHALL support revoking sessions server-side via Kratos: logout MUST revoke the current session at Kratos; deactivating a user (`is_active = False`) MUST revoke all of that identity's Kratos sessions; an admin "log out all sessions" path SHALL exist at the service layer. A revoked session MUST be unusable on the very next request (no grace window). This closes `BL-042` for the session-revocation half; the queryable `auth_audit` table half stays parked.

#### Scenario: Logout kills the session everywhere
- **WHEN** a user logs out in one browser while holding the same session cookie in another client
- **THEN** the other client's next request is 401

#### Scenario: Deactivation revokes all sessions
- **WHEN** an admin deactivates a user who has two active sessions
- **THEN** both sessions are revoked at Kratos and both clients' next requests are 401

