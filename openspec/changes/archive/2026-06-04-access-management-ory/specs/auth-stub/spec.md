# auth-stub Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Server-side session revocation
The backend SHALL support revoking sessions server-side via Kratos: logout MUST revoke the current session at Kratos; deactivating a user (`is_active = False`) MUST revoke all of that identity's Kratos sessions; an admin "log out all sessions" path SHALL exist at the service layer. A revoked session MUST be unusable on the very next request (no grace window). This closes `BL-042` for the session-revocation half; the queryable `auth_audit` table half stays parked.

#### Scenario: Logout kills the session everywhere
- **WHEN** a user logs out in one browser while holding the same session cookie in another client
- **THEN** the other client's next request is 401

#### Scenario: Deactivation revokes all sessions
- **WHEN** an admin deactivates a user who has two active sessions
- **THEN** both sessions are revoked at Kratos and both clients' next requests are 401
