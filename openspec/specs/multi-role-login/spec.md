# multi-role-login Specification

## Purpose
One human is one Kratos identity that may map to several role-scoped `users` rows (one per role). Login resolves the roster and binds the session to exactly one active user row — automatically for single-role humans, after explicit `requires_role_selection` otherwise — so that authorization, audit attribution and shielding audiences always flow from a single bound row, never from the identity. Mirrors a FHIR Practitioner holding multiple PractitionerRoles with one active context per session.
## Requirements
### Requirement: One human, one Kratos identity, many role-scoped user rows
A human SHALL be represented by exactly one Kratos identity (unique email) which MAY map to multiple local `users` rows — one per staff role plus, optionally, one patient row. Role identity on a `users` row SHALL be a NOT NULL `role_id` foreign key to the `roles` table (replacing the removed `Role` enum). Because patient/caregiver identity is derived from data (not from the role — `rbac-roles`), uniqueness SHALL be expressed with partial indexes rather than `(tenant_id, email, role_id)` alone:
- `UNIQUE (tenant_id, email, role_id) WHERE patient_id IS NULL` — at most one staff row per role for a human (e.g. one `admin` row and one `default`/clinical row may coexist).
- `UNIQUE (tenant_id, email) WHERE patient_id IS NOT NULL` — at most one patient row per human.

This lets the same human hold staff rows AND a patient row (e.g. a nurse treated at her own hospital) without collision, while a caregiver row (role `default`, `patient_id` NULL, with a `Practitioner` row) stays distinct from the patient row (role `default`, `patient_id` set). `external_identities` SHALL allow multiple user rows to share the same `(idp, external_subject)`. Authorization, audit attribution and shielding audiences SHALL always flow from a single bound user row, never from the identity. (REQ-NON-3, REQ-FUN-4)

#### Scenario: Import handles a patient-and-caregiver human
- **WHEN** the import processes two user rows sharing one email — one a caregiver (role `default`, `patient_id` NULL, Practitioner row) and one a patient (role `default`, `patient_id` set)
- **THEN** exactly one Kratos identity exists for that email, both rows link to it, and the partial unique indexes admit both

#### Scenario: Cross-facet information shielding is structural
- **WHEN** a human holds a patient row and a caregiver row, and data exists that only their patient row may see
- **THEN** a session bound to the caregiver row cannot access it (the caregiver user id holds no tuple for it)

### Requirement: Session binds to exactly one active role
Login SHALL resolve the identity's user-row roster: with one row the session binds automatically (no UX change); with several, the login response SHALL signal `requires_role_selection` listing the available rows (each labelled by its role slug, and distinguishing the patient facet), and `POST /auth/session/role` (authenticated by the fresh session) SHALL write a `session_role_bindings` row (kratos session id → user id). Protected routes MUST reject (409 role-selection-required) until a binding exists. Switching the active row SHALL reuse the same endpoint without re-authentication, rewriting the binding and audit-logging the change — the session then acts as the newly bound row (a different role/identity facet, "like a new user"). The login/session response's `role` field SHALL carry the bound row's role slug. (REQ-NON-3, REQ-FUN-4)

#### Scenario: Single-row user logs straight in
- **WHEN** a user whose email maps to one row logs in
- **THEN** the session is bound immediately and the response carries that row's role slug

#### Scenario: Dual patient/staff human picks a facet
- **WHEN** a human with a caregiver row and a patient row logs in and selects the caregiver facet
- **THEN** subsequent requests resolve to the caregiver row and its role's effective permissions only, with no patient-facet access

#### Scenario: Switch acts as the other facet
- **WHEN** the bound session posts a selection of the other available row
- **THEN** the binding is rewritten, the switch is audit-logged, and the next request acts as that row without re-login

#### Scenario: No binding blocks protected routes
- **WHEN** a multi-row login has not yet posted a selection
- **THEN** protected routes return 409 role-selection-required, not data

### Requirement: Actor resolution honours the binding
`resolve_actor_from_request` SHALL resolve cookie → Kratos whoami → identity → session binding → user row. Revoking the Kratos session invalidates the binding implicitly (whoami fails first); a binding pointing at a deactivated user row MUST resolve to 401. (REQ-NON-3)

#### Scenario: Deactivated bound row rejected
- **WHEN** the user row a session is bound to is deactivated
- **THEN** the next request resolves 401 even though the Kratos session is alive

