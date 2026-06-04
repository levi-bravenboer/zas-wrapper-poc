# multi-role-login Delta

## ADDED Requirements

### Requirement: One human, one Kratos identity, many role-scoped user rows
A human SHALL be represented by exactly one Kratos identity (unique email) which MAY map to multiple local `users` rows — one per role (the existing tenant + email + role uniqueness). `external_identities` SHALL allow multiple user rows to share the same `(idp, external_subject)`. Authorization, audit attribution and shielding audiences SHALL always flow from a single bound user row, never from the identity. (REQ-NON-3, REQ-FUN-4)

#### Scenario: Import handles a multi-role human
- **WHEN** the Kratos import script processes two user rows sharing one email (caregiver + patient)
- **THEN** exactly one Kratos identity exists for that email and both user rows link to it

#### Scenario: Cross-role information shielding is structural
- **WHEN** a human holds patient and caregiver rows, and data exists that only their patient row may see
- **THEN** a session bound to the caregiver row cannot access it (the caregiver user id holds no tuple for it)

### Requirement: Session binds to exactly one active role
Login SHALL resolve the identity's user-row roster: with one row the session binds automatically (no UX change); with several, the login response SHALL signal `requires_role_selection` with the available roles, and `POST /auth/session/role` (authenticated by the fresh session) SHALL write a `session_role_bindings` row (kratos session id → user id). Protected routes MUST reject (409 role-selection-required) until a binding exists. Role switch SHALL reuse the same endpoint without re-authentication, rewriting the binding and audit-logging old and new role. (REQ-NON-3, REQ-FUN-4)

#### Scenario: Single-role user logs straight in
- **WHEN** a user whose email maps to one user row logs in
- **THEN** the session is bound immediately and the login response is unchanged from the existing contract

#### Scenario: Multi-role user picks a role
- **WHEN** a human with caregiver and admin rows logs in and selects `admin`
- **THEN** subsequent requests resolve to the admin user row and its entitlements only

#### Scenario: No binding blocks protected routes
- **WHEN** a multi-role login has not yet posted a role selection
- **THEN** protected routes return 409 role-selection-required, not data

#### Scenario: Role switch is audited and immediate
- **WHEN** a bound session posts a new role selection
- **THEN** the binding is rewritten, the switch is audit-logged with both roles, and the next request acts as the new role without re-login

### Requirement: Actor resolution honours the binding
`resolve_actor_from_request` SHALL resolve cookie → Kratos whoami → identity → session binding → user row. Revoking the Kratos session invalidates the binding implicitly (whoami fails first); a binding pointing at a deactivated user row MUST resolve to 401. (REQ-NON-3)

#### Scenario: Deactivated bound row rejected
- **WHEN** the user row a session is bound to is deactivated
- **THEN** the next request resolves 401 even though the Kratos session is alive
