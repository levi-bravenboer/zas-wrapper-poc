# kratos-identity Delta

> Stacks on `access-management-ory` (archived 2026-06-04).

## MODIFIED Requirements

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
