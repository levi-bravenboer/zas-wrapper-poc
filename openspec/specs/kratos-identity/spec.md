# kratos-identity Specification

## Purpose
TBD - created by archiving change access-management-ory. Update Purpose after archive.
## Requirements
### Requirement: Kratos runs as the identity provider for all interactive logins
The platform SHALL run Ory Kratos (pinned version, config under `infra/ory/kratos/`) as the system of record for credentials and sessions. Local development SHALL provide `kratos` + `kratos-migrate` services via docker compose; deployed environments SHALL use the Forge Kratos provisioning. The backend MUST NOT verify passwords or mint session tokens itself once this change lands.

#### Scenario: Local stack boots with Kratos
- **WHEN** a developer runs the local compose stack
- **THEN** Kratos public + admin APIs are reachable and `kratos-migrate` has applied its schema before the backend accepts logins

#### Scenario: Backend contains no credential verification
- **WHEN** a developer inspects `app/services/access/identity/` after the swap
- **THEN** no argon2 verification call is reachable from the login route; password checking happens only inside Kratos

### Requirement: Identity schemas per user type
Kratos SHALL define identity schemas for `practitioner` and `patient` identities (and a `default` admin schema). Traits SHALL carry at minimum `email`; traits MUST NOT carry authorization-relevant data (roles and entitlements live in Postgres and Keto respectively).

#### Scenario: Practitioner identity created with email trait
- **WHEN** the import script creates an identity for a caregiver user
- **THEN** the identity uses the `practitioner` schema and its traits contain the user's email

#### Scenario: No role trait consulted for authorization
- **WHEN** any backend authorization decision is made
- **THEN** the decision reads role/permissions from Postgres/Keto, never from Kratos traits

### Requirement: Argon2id hash import with no password resets
A one-shot idempotent import script SHALL create a Kratos identity for every active `users` row, passing the existing argon2id `password_hash` via the Kratos admin identity-import API so existing passwords keep working. User rows sharing one email (multi-role humans) SHALL map to a **single** Kratos identity: the first row imports the credential, subsequent rows link to the existing identity by email. The script SHALL write back `external_idp = 'kratos'` and `external_subject = <identity.id>` on each linked row. Re-running the script MUST NOT create duplicate identities.

#### Scenario: Existing password works after import
- **WHEN** the import has run and a seeded caregiver logs in with their pre-existing password
- **THEN** login succeeds via Kratos without any password reset

#### Scenario: Import is idempotent
- **WHEN** the import script runs twice
- **THEN** each user row still maps to exactly one Kratos identity and `external_subject` is unchanged

#### Scenario: Multi-role human gets one identity
- **WHEN** the import processes caregiver and patient rows sharing one email
- **THEN** exactly one Kratos identity exists for that email and both rows carry its id as `external_subject`

### Requirement: Session resolution via whoami
`resolve_actor_from_request` SHALL resolve the request's session by forwarding the session cookie to Kratos `GET /sessions/whoami`, mapping `identity.id` to the human's local user-row roster via `(external_idp='kratos', external_subject)` lookup, and selecting the bound row from `session_role_bindings` (automatic when the roster has one row). A missing, expired, or revoked Kratos session MUST resolve to unauthenticated (None), preserving existing 401 semantics. A live session whose roster has several rows but no binding MUST resolve to the 409 role-selection-required state on protected routes. The bound local `User` row MUST still be re-loaded on every request so `is_active` and role changes take effect immediately.

#### Scenario: Valid Kratos session resolves to SessionUser
- **WHEN** a request carries a cookie for an active Kratos session whose identity maps to one active user row
- **THEN** the request handler receives the corresponding `SessionUser`

#### Scenario: Revoked session is unauthenticated
- **WHEN** a session is revoked via the Kratos admin API and the client replays its cookie
- **THEN** the next request resolves to 401 `security.auth.unauthenticated`

#### Scenario: Deactivated user with live Kratos session is rejected
- **WHEN** whoami succeeds but the bound local user has `is_active = False`
- **THEN** the request resolves to 401 and the user's Kratos sessions are queued for revocation

#### Scenario: Unbound multi-role session is not yet an actor
- **WHEN** whoami succeeds, the identity maps to several user rows and no binding exists for the session
- **THEN** protected routes resolve to 409 role-selection-required, not 401 and not data

### Requirement: Login and logout proxy Kratos self-service flows
`POST /auth/login/password` SHALL submit a Kratos native login flow server-side and relay the resulting session cookie to the client; `POST /auth/logout` SHALL revoke the Kratos session server-side (not merely clear the client cookie). Route shapes, operation ids, and `SessionUser` response bodies MUST remain unchanged from the existing contract.

#### Scenario: Login round-trip unchanged for the frontend
- **WHEN** the orchestrator posts valid credentials to `/auth/login/password`
- **THEN** the response is 200 with the same `SessionUser` shape as before and a session cookie is set

#### Scenario: Logout revokes server-side
- **WHEN** a logged-in client posts `/auth/logout` and afterwards replays its old cookie
- **THEN** logout returned 204, and the replayed request is 401

