## ADDED Requirements

### Requirement: Mobile login issues the same BACKEND_SESSION cookie

`POST /mobile/auth/login/password` SHALL call the existing `issue_session_cookie(response, user)` helper used by the caregiver `POST /auth/login/password` route. The issued cookie SHALL carry identical attributes (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in prod with the `__Host-` prefix). The mobile app SHALL rely on the OS cookie jar (iOS, Android) and on `credentials: 'include'` (web target). No bearer token, no JWT, no second cookie name.

#### Scenario: Successful mobile login sets the existing cookie name

- **WHEN** `POST /mobile/auth/login/password` returns `200`
- **THEN** the response includes exactly one `Set-Cookie` header whose name is `BACKEND_SESSION` (or `__Host-BACKEND_SESSION` in prod) with the same attributes the caregiver route emits

#### Scenario: Caregiver route still issues the same cookie shape

- **WHEN** `POST /auth/login/password` returns `200`
- **THEN** the `Set-Cookie` header matches the existing scenario exactly (no change)

### Requirement: Logout is one endpoint for both surfaces

`POST /auth/logout` SHALL clear the `BACKEND_SESSION` cookie regardless of which surface issued the session. The route SHALL respond `204` and SHALL be safe to call without a valid session (idempotent). No `POST /mobile/auth/logout` parallel route SHALL exist in this change. The mobile app SHALL call `POST /auth/logout` from `resetAuth()` with `credentials: 'include'`.

#### Scenario: Mobile-issued cookie is cleared by the shared endpoint

- **WHEN** a mobile patient session cookie is issued and `POST /auth/logout` is called with `credentials: 'include'`
- **THEN** the response status is `204`
- **AND** the response sets `BACKEND_SESSION` with `Max-Age=0` (or equivalent expiry-in-the-past)

#### Scenario: No mobile-specific logout route exists

- **WHEN** the OpenAPI schema is inspected for `paths` keys starting with `/mobile/auth/logout`
- **THEN** zero keys match

### Requirement: Mobile sessions are not server-revocable in PoC

This change SHALL NOT add a server-side session revocation table, blacklist, or mid-session-kill endpoint for either surface. Existing session lifetime semantics carry over: the cookie expires by its built-in `Max-Age`; client-side logout (cookie cleared on the device) is the only revocation path. Server-side revocation lands as part of `BL-042` at MVP and SHALL apply to both surfaces from one source.

#### Scenario: No revocation table is created by this change

- **WHEN** the alembic revisions added by this change are inspected
- **THEN** no migration creates a `session_revocations`, `token_blacklist`, or similarly named table

## MODIFIED Requirements

### Requirement: POC username/password login

The orchestrator SHALL render a `/login` route that drives its login affordances off the `GET /auth/providers` response. For each provider returned by the discovery endpoint, the screen MUST mount the strategy registered for the provider's `kind`. The PoC ships exactly one strategy, `PasswordStrategy`, used for the `password` provider; it renders the existing styled email + password form. The form's email field MUST be validated by Zod as `z.string().email().min(1).max(256)`; the password field MUST be `.min(1).max(256)`. Submission MUST call `POST /auth/login/password` through the shared `openapi-fetch` client (typed against the regenerated `schema.d.ts`) with `credentials: 'include'` and body `{ email, password }`. **The orchestrator caregiver login flow is unchanged on the wire by this change; the backend route now filters `role <> 'patient'` internally via the shared `authenticate_password()` service. A patient user attempting to log in via the orchestrator MUST be rejected with the same generic `401` as a bad password.** On success the form MUST navigate to a same-origin `?redirect=` target when present, otherwise to `/`. The form's existing visual layout and styling MUST NOT change as part of this requirement — only submit behaviour, validation, and inline error rendering are added.

#### Scenario: Successful password login navigates to default destination

- **WHEN** the user submits valid credentials and `?redirect=` is absent
- **THEN** the frontend sends `POST /auth/login/password` with `{ email, password }`, receives `200` with a `Set-Cookie: BACKEND_SESSION=...; HttpOnly; SameSite=Lax; Path=/` header
- **AND** the app writes the returned `SessionUser` into the `authKeys.me()` query cache and navigates to `/` with `replace: true`

#### Scenario: Successful password login honours same-origin redirect

- **WHEN** the user submits valid credentials and the URL carries `?redirect=/patients/abc123`
- **THEN** the app navigates to `/patients/abc123` with `replace: true` after the `200` response
- **AND** the original `/login?redirect=...` entry is removed from history

#### Scenario: Redirect to non-same-origin or malformed target is dropped

- **WHEN** `?redirect=` does not start with `/`, starts with `//`, contains `\`, OR resolves to `/login`
- **THEN** the app navigates to `/` instead and never attempts the supplied target

#### Scenario: Invalid credentials

- **WHEN** the backend responds `401`
- **THEN** the form shows the localized error "Ongeldige inloggegevens" via a `<p role="alert">` rendered below the submit button

#### Scenario: Patient credentials rejected at the orchestrator login

- **WHEN** the orchestrator caregiver login form is submitted with credentials belonging to a `role = 'patient'` user
- **THEN** the backend responds `401`
- **AND** the form shows the same "Ongeldige inloggegevens" message — no separate "wrong surface" hint is rendered (no enumeration leak)
