# auth-session Delta

> Stacks on `access-management-ory` (archived 2026-06-04).

## ADDED Requirements

### Requirement: Login surfaces role selection only when needed
The orchestrator login flow SHALL handle the `requires_role_selection` login response: present the available roles, post the choice to `POST /auth/session/role`, then proceed to the redirect target. Single-role users MUST see no new UI and follow the existing login contract unchanged. A 409 role-selection-required from any protected route SHALL route the user to the role picker, preserving the intended destination.

#### Scenario: Single-role login unchanged
- **WHEN** a single-role caregiver logs in
- **THEN** the flow is byte-identical to the existing contract (no picker, same redirects)

#### Scenario: Multi-role login picks then proceeds
- **WHEN** a multi-role user logs in at `/login?redirect=/patients` and picks a role
- **THEN** the app lands on `/patients` acting as the chosen role

#### Scenario: Active role visible and switchable
- **WHEN** a multi-role user opens the user menu
- **THEN** the active role is displayed and switching role re-binds the session without re-entering credentials
