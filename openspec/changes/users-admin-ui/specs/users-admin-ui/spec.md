## ADDED Requirements

### Requirement: Admin can create users with atomic Practitioner materialisation

The backend SHALL expose `POST /users` (admin-only, `# AUTH-HARDEN`-marked) accepting a body `UserCreate { email, display_name, role, qualification?, is_active? }`. Email uniqueness is tenant-scoped (existing constraint from `user-base`). When `role == caregiver`, the handler SHALL — in the same database transaction as the User insert — call `PractitionerService.create` to materialise a Practitioner row with `family_name` / `given_name` derived from `display_name` and the optional `qualification`. If the Practitioner insert fails, the entire transaction SHALL roll back; no orphan User without Practitioner row may persist.

#### Scenario: Caregiver creation materialises Practitioner atomically

- **WHEN** an admin posts `{"email": "x@y", "display_name": "Dr. Smith", "role": "caregiver", "qualification": "MD"}`
- **THEN** the response is `201 Created` with the new `UserRow`, AND a `practitioners` row exists with `user_id = response.id` and `qualification = "MD"`

#### Scenario: Practitioner insert failure rolls back User insert

- **WHEN** `POST /users` with `role=caregiver` is called and the Practitioner insert raises (e.g. forced unique violation in a test)
- **THEN** no `users` row with that email exists after the failed request, and the response is a 5xx surfaced through the standard error envelope

#### Scenario: Admin creation does NOT create a Practitioner

- **WHEN** an admin posts `{"role": "admin", ...}`
- **THEN** the response is `201 Created` and no `practitioners` row is created for that user

#### Scenario: Duplicate email surfaces 409

- **WHEN** an admin posts an email that already exists in their tenant
- **THEN** the response is `409 Conflict` with `ErrorResponse{ code: "conflict.user.email_exists" }`

### Requirement: Admin can edit user demographics and active status, but not self-deactivate

The backend SHALL expose `PATCH /users/{user_id}` (admin-only, `# AUTH-HARDEN`-marked) accepting body `UserUpdate { display_name?, is_active? }`. Cross-tenant targets SHALL return `403`. An admin SHALL NOT deactivate their own account through this endpoint; that request SHALL return `409 Conflict` with `ErrorResponse{ code: "conflict.user.self_deactivate" }`. Role changes remain on `PATCH /users/{user_id}/role` (existing `user-base` endpoint).

#### Scenario: Display name edit succeeds

- **WHEN** an admin PATCHes `display_name: "New Name"` for another user in the same tenant
- **THEN** the response is `200` with the updated `UserRow` and a follow-up GET reflects the change

#### Scenario: Self-deactivation rejected

- **WHEN** an admin PATCHes `is_active: false` against their own `user_id`
- **THEN** the response is `409 Conflict` with `ErrorResponse{ code: "conflict.user.self_deactivate" }`

#### Scenario: Cross-tenant edit rejected

- **WHEN** an admin PATCHes a user belonging to a different tenant
- **THEN** the response is `403 Forbidden` with `ErrorResponse{ code: "forbidden.user.cross_tenant" }`

### Requirement: Admin user list page composes shared list scaffolding

The orchestrator SHALL render at `/_auth/admin/users` a `<UserListPage>` composing `<FilterableListPage<UserRow>>` (from `caregiver-shell`) around `<DataTable<UserRow>>`. The page SHALL ride `usePaginatedQuery('/users', state)` and the shared `ListQuery` envelope. Columns (left-to-right; first sticky):

1. **Naam** — `display_name`, sortable, sticky.
2. **Email** — sortable.
3. **Rol** — badge: `Admin | Caregiver | External`. Filterable via single-select.
4. **Actief** — badge: `Ja | Nee`. Filterable via toggle.
5. **Aangemaakt** — `dd MMM HH:mm` (locale `nl-NL`), sortable.

The page SHALL provide a search input (`q` over `display_name + email`), a `Rol`-filter single-select, an `Actief`-filter toggle, and a primary CTA `Gebruiker toevoegen` opening `<CreateUserDialog>`. Each row's kebab SHALL expose `Bewerken` (opens `<EditUserDialog>`) and `Deactiveren` (destructive confirm; calls `PATCH /users/{id}` with `is_active=false`). The `Deactiveren` action SHALL be disabled when `row.id === currentSession.user.id`. The empty state copy SHALL be `"Nog geen gebruikers in dit tenant."`. The route SHALL be reachable only via the admin route group's existing layout gate.

#### Scenario: Caregiver session cannot load the page

- **WHEN** a caregiver navigates to `/_auth/admin/users`
- **THEN** the admin route-group layout MUST redirect to `/_auth/` before the page mounts

#### Scenario: Self-deactivate kebab item disabled

- **WHEN** the admin's own row renders
- **THEN** the kebab's `Deactiveren` item MUST be visibly disabled (no click handler, aria-disabled)

#### Scenario: Filters compose into the shared envelope

- **WHEN** the admin picks `Rol = caregiver`, toggles `Actief = false`, and types `"jans"` in search
- **THEN** the next `GET /users` request MUST carry `filter[role][eq]=caregiver`, `filter[is_active][eq]=false`, and `q=jans`

### Requirement: Admin user detail page surfaces Practitioner + roles

The orchestrator SHALL render at `/_auth/admin/users/$userId` a `<UserDetailPage>` containing:

1. **Demographics section**: `Naam`, `Email`, `Rol`, `Actief`, `Aangemaakt`.
2. **Practitioner section** (only when `user.role === 'caregiver'` and `GET /practitioners/{userId}` returns 200): `family_name`, `given_name`, `qualification`, and a small table of `PractitionerRole` rows showing `code`, `organisation.name`, `period_start`, `period_end` (em-dash when open), `is_primary` badge.
3. **Page kebab**: `Bewerken` (opens `<EditUserDialog>`), `Deactiveren` (destructive confirm; disabled when target is the current admin).

Affiliation editing SHALL NOT be exposed from this page — each PractitionerRole row's chip MAY link to the (placeholder until `practitioner-roles-admin-ui` ships) `/_auth/admin/practitioner-roles?practitioner_id=…` route.

#### Scenario: Admin role hides Practitioner section

- **WHEN** the detail page loads for a user with `role === 'admin'`
- **THEN** no `Practitioner section` MUST render; the API request to `/practitioners/{userId}` MUST NOT be issued

#### Scenario: Caregiver detail surfaces open and closed roles

- **WHEN** the detail page loads for a caregiver with two open PractitionerRole rows and one closed
- **THEN** the Practitioner section MUST render all three rows ordered by `is_primary DESC, period_start DESC`, with closed rows visually distinguished (e.g. muted text and a `Beëindigd` chip)

### Requirement: Create + Edit dialogs use shadcn form primitives with field-level errors

The orchestrator SHALL provide `<CreateUserDialog>` and `<EditUserDialog>` components built on shadcn's `Dialog` + `Form` primitives. Both dialogs SHALL surface API field-level errors inline against the relevant form field (e.g. duplicate email → `email` field error). Submit SHALL invalidate the `/users` query key on success. The create dialog's `qualification` input SHALL only render when the selected `role === 'caregiver'`.

#### Scenario: Qualification input visibility tied to role

- **WHEN** the user picks `role: 'admin'` in `<CreateUserDialog>`
- **THEN** the `qualification` input MUST be hidden and its value MUST NOT be sent in the POST body

#### Scenario: Duplicate-email error surfaces inline

- **WHEN** the dialog submits an email already taken in the tenant
- **THEN** the `email` input MUST render the error copy from `ErrorResponse{ code: "conflict.user.email_exists" }`, and the dialog MUST stay open
