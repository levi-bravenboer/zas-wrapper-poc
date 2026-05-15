## MODIFIED Requirements

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

### Requirement: Authenticator Protocol seam

The backend SHALL define an `Authenticator` Protocol in `app/services/auth/authenticator.py` exposing at minimum `async def authenticate(self, *, email: str, password: str) -> User | None`. A `PasswordAuthenticator` implementation MUST satisfy this Protocol by verifying the input password against the user's `password_hash` via a `PasswordHasher` wrapper around `argon2-cffi`. The `PasswordAuthenticator` MUST return `None` when the looked-up user's `password_hash IS NULL` (OIDC-only identity) instead of attempting verification against a null value. `AuthService` MUST accept an `Authenticator` (the Protocol type, not the concrete class) in its constructor; the `Authenticator` Protocol remains a credential-verification seam — not a route-shape seam — and is consumed exclusively by `PasswordLoginProvider`.

#### Scenario: Authenticator injectable

- **WHEN** a test constructs `AuthService` with a `FakeAuthenticator` implementing the Protocol
- **THEN** `AuthService.login` MUST drive the fake without touching the real password hasher or repository

#### Scenario: Wrong password rejected

- **WHEN** `PasswordAuthenticator.authenticate(email="admin@zas.local", password="wrong")` is awaited
- **THEN** it MUST return `None`

#### Scenario: Correct password accepted

- **WHEN** `PasswordAuthenticator.authenticate(email="admin@zas.local", password=<seeded admin password>)` is awaited
- **THEN** it MUST return the matching `User` row

#### Scenario: Null password_hash rejected

- **WHEN** `PasswordAuthenticator.authenticate` is awaited against a user whose `password_hash IS NULL`
- **THEN** it MUST return `None` without calling `PasswordHasher.verify`

## ADDED Requirements

### Requirement: LoginProvider Protocol owns route handlers

The backend SHALL define a `LoginProvider` Protocol in `app/services/auth/providers/base.py` with at minimum the following surface:

```python
class LoginProvider(Protocol):
    key: str                          # 'password', and later 'eid', 'itsme', 'csam'
    label: str                        # human-readable label for the providers endpoint
    kind: Literal['password', 'oidc'] # render strategy hint for the frontend
```

Provider implementations live under `app/services/auth/providers/`. The PoC ships exactly one implementation, `PasswordLoginProvider` (`app/services/auth/providers/password.py`), which exposes an `async authenticate(email: str, password: SecretStr) -> SessionUser` method and consumes the existing `Authenticator` Protocol internally. OIDC-shaped providers MUST be defined in their own modules at MVP time; this change does NOT ship any.

The `LoginProvider` Protocol is the *route-shape* seam. The `Authenticator` Protocol (kept for backwards compatibility with the password flow) is the *credential-check* seam consumed by `PasswordLoginProvider`. The auth router MUST wire concrete provider methods into concrete routes (one HTTP handler per (provider × method) pair) — kind-based dispatch inside a single handler is FORBIDDEN.

#### Scenario: Password provider conforms to Protocol

- **WHEN** `PasswordLoginProvider` is checked against the `LoginProvider` Protocol via `isinstance(provider, LoginProvider)` or `mypy --strict`
- **THEN** the check MUST pass, with `key == "password"`, `kind == "password"`, and a non-empty `label`

#### Scenario: Provider authenticate mints session

- **WHEN** a router handler calls `await password_provider.authenticate(email=..., password=...)` with valid credentials
- **THEN** the call MUST return a `SessionUser` matching the looked-up user; on failure it MUST raise `InvalidCredentialsError`

### Requirement: Provider registry exposes enabled providers

The backend SHALL expose a `LoginProviderRegistry` (in `app/services/auth/providers/registry.py`) that constructs and lists the providers enabled for a given deployment. The registry MUST be a constructor dep on `AuthService` (or a sibling service consumed by the router), MUST contain at minimum the `password` provider in PoC, and MUST return providers in a stable order. The registry is the single source of truth for `GET /auth/providers` responses.

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
