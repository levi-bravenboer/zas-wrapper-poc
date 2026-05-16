## MODIFIED Requirements

### Requirement: Admin user router exposes list and role-update endpoints

The backend SHALL expose a router under `app/api/routers/user/` tagged `users` providing:

- `GET /users` — operation id `list_tenant_users`. Returns `list[UserRow]` (id, email, display_name, role, is_active, created_at). Tenant-scoped to `current_user.tenant_id`. Admin-only. Accepts optional `?active=true|false`, `?role=<Role>`, `?q=<text>`, and `?has_practitioner=true|false` query filters.
- `PATCH /users/{user_id}/role` — operation id `update_user_role`. Body: `AssignRoleRequest { role: Role }`. Returns the updated `UserRow`. Admin-only. Cross-tenant targets return 403. Self-targets are permitted and return 200 with the updated row.

Both endpoints MUST be guarded with `Depends(require_role(Role.ADMIN))`.

#### Scenario: Caregiver cannot list users

- **WHEN** an authenticated caregiver requests `GET /users`
- **THEN** the response is 403 with `ErrorResponse{ code: "forbidden.auth.role" }`

#### Scenario: Admin can list users in own tenant

- **WHEN** an authenticated admin requests `GET /users` against a freshly seeded database
- **THEN** the response is 200 with a body containing both seeded users (admin + caregiver) and no users from any other tenant

#### Scenario: Admin updates caregiver role

- **WHEN** an admin sends `PATCH /users/<caregiver_id>/role` with body `{"role": "external"}`
- **THEN** the response is 200 with the updated `UserRow` showing `role = "external"`

#### Scenario: Admin attempts cross-tenant role update

- **WHEN** an admin sends `PATCH /users/<other_tenant_user_id>/role` with body `{"role": "caregiver"}`
- **THEN** the response is 403 with `ErrorResponse{ code: "forbidden.user.cross_tenant" }`

#### Scenario: Admin self role update permitted

- **WHEN** an admin sends `PATCH /users/<own_id>/role` with body `{"role": "caregiver"}`
- **THEN** the response is 200 with the updated `UserRow` showing `role = "caregiver"`

#### Scenario: has_practitioner filter scopes the list

- **WHEN** an admin calls `GET /users?has_practitioner=true`
- **THEN** the response MUST include only users whose `Practitioner` row exists (joined on `practitioners.user_id`), excluding any admin or caregiver with no Practitioner materialised
