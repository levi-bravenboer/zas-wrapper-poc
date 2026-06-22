# users-admin-ui Specification

## Purpose
TBD - created by archiving change users-admin-ui. Update Purpose after archive.
## Requirements
### Requirement: Admin can create users with atomic Practitioner materialisation

The backend SHALL expose `POST /users` (admin-only, `# AUTH-HARDEN`-marked) accepting a role-discriminated body:

- `role: admin` → `UserCreate { email, role, display_name }`.
- `role: caregiver` → `UserCreate { email, role, given_name, family_name, qualification? }`. The handler SHALL derive `user.display_name = f"{given_name} {family_name}"` server-side (clients do not send `display_name` for caregivers).

Pydantic SHALL reject payloads that mix branches (e.g. an admin payload carrying `given_name`, or a caregiver payload carrying `display_name`) with `422`. Email uniqueness is tenant-scoped (existing constraint from `user-base`). When `role == caregiver`, the handler SHALL — in the same database transaction as the User insert — call `PractitionerService.create` to materialise a Practitioner row with `family_name`, `given_name`, and the optional `qualification` taken directly from the payload. If the Practitioner insert fails, the entire transaction SHALL roll back; no orphan User without Practitioner row may persist. Initial credentials are out of scope of `UserCreate` — `UserService.create` SHALL provision a placeholder `password_hash` (random token, hashed); admins onboard credentials via the separate auth-hardening track.

#### Scenario: Caregiver creation materialises Practitioner atomically

- **WHEN** an admin posts `{"email": "x@y", "role": "caregiver", "given_name": "Sanne", "family_name": "Jansen", "qualification": "Huisarts"}`
- **THEN** the response is `201 Created` with `UserRow.display_name == "Sanne Jansen"`, AND a `practitioners` row exists with `user_id = response.id`, `given_name = "Sanne"`, `family_name = "Jansen"`, `qualification = "Huisarts"`

#### Scenario: Practitioner insert failure rolls back User insert

- **WHEN** `POST /users` with `role=caregiver` is called and the Practitioner insert raises (e.g. forced unique violation in a test)
- **THEN** no `users` row with that email exists after the failed request, and the response is a 5xx surfaced through the standard error envelope

#### Scenario: Admin creation does NOT create a Practitioner

- **WHEN** an admin posts `{"email": "bo@y", "role": "admin", "display_name": "Bo de Vries"}`
- **THEN** the response is `201 Created` and no `practitioners` row is created for that user

#### Scenario: Mixed-branch payload rejected

- **WHEN** an admin posts `{"role": "admin", "display_name": "X", "given_name": "X"}` (or any other cross-branch field combo)
- **THEN** the response is `422 Unprocessable Entity`; no row is created

#### Scenario: Duplicate email surfaces 409

- **WHEN** an admin posts an email that already exists in their tenant
- **THEN** the response is `409 Conflict` with `ErrorResponse{ code: "conflict.user.email_exists" }`

### Requirement: Admin can edit user demographics, but not self-deactivate

The backend SHALL expose `PATCH /users/{user_id}` (admin-only, `# AUTH-HARDEN`-marked) accepting body `UserUpdate { display_name? }`. Cross-tenant targets SHALL return `403`. Editing caregiver clinical fields (`given_name`, `family_name`, `qualification`) lives on the Practitioner update endpoint, not here — `UserUpdate` carries `display_name` only. For caregivers, the UI SHALL lock these fields (with a Lock icon + helper text pointing at the Practitioner page); the form payload sent to PATCH is always `{ display_name }`. Role changes remain on `PATCH /users/{user_id}/role` (existing `user-base` endpoint). Active flips remain on `PATCH /users/{user_id}/active` (existing `user-base` endpoint, which already rejects self-deactivation with `409 conflict.user.self_deactivate`).

#### Scenario: Display name edit succeeds

- **WHEN** an admin PATCHes `display_name: "New Name"` for another user in the same tenant
- **THEN** the response is `200` with the updated `UserRow` and a follow-up GET reflects the change

#### Scenario: Cross-tenant edit rejected

- **WHEN** an admin PATCHes a user belonging to a different tenant
- **THEN** the response is `403 Forbidden` with `ErrorResponse{ code: "forbidden.user.cross_tenant" }`

### Requirement: Admin user list page composes shared list scaffolding

The orchestrator SHALL render at `/_auth/admin/users` a `<UserListPage>` composing `<FilterableListPage<UserRow>>` (from `caregiver-shell`) around `<DataTable<UserRow>>`. The page SHALL ride `usePaginatedQuery('/users', state)` and the shared `ListQuery` envelope. Columns (left-to-right; first sticky):

1. **Naam** — `display_name`, sortable, sticky.
2. **Email** — sortable.
3. **Rol** — badge: `Admin | Caregiver`. Filterable via single-select.
4. **Actief** — badge: `Ja | Nee`. Filterable via toggle.
5. **Aangemaakt** — `dd MMM HH:mm` (locale `nl-NL`), sortable.

The page SHALL provide a search input (`q` over `display_name + email`), a `Rol`-filter single-select, an `Actief`-filter toggle, and a primary CTA `Gebruiker toevoegen` linking to `/_auth/admin/users/new`. Each row's kebab SHALL expose `Bewerken` (linking to `/_auth/admin/users/$userId/edit`) and `Deactiveren` (destructive confirm; calls `PATCH /users/{id}/active` with `{ is_active: false }`). The `Deactiveren` action SHALL be disabled when `row.id === currentSession.user.id`. The empty state copy SHALL be `"Nog geen gebruikers in dit tenant."`. The route SHALL be reachable only via the admin route group's existing layout gate.

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

The orchestrator SHALL render at `/_auth/admin/users/$userId` a `<UserDetailPage>` built on `<EntityDetailPage>` chrome (header: title=display_name, subtitle=role badge + email, back link to `/_auth/admin/users`, actions slot = Bewerken + Deactiveren). The body SHALL use `<EntityDetailSingleColumn>` containing:

1. **Demographics card**: `Naam`, `Email`, `Rol`, `Actief`, `Aangemaakt`.
2. **Practitioner card** (only when `user.role === 'caregiver'` and `GET /practitioners/{userId}` returns 200): `family_name`, `given_name`, `qualification`, and a small table of `PractitionerRole` rows showing `code`, `organisation.name`, `period_start`, `period_end` (em-dash when open), `is_primary` badge.

The header `Bewerken` action SHALL navigate to `/_auth/admin/users/$userId/edit`. The header `Deactiveren` action SHALL use `useEntityDelete` semantics adapted for soft-deactivate: AlertDialog confirm → `PATCH /users/{id}/active` with `{ is_active: false }` → toast + invalidate the detail query; disabled when target is the current admin. Loading state SHALL render `<EntityDetailSkeleton>`. Missing resource (404) SHALL render `<EntityNotFound>` with back link to the list.

Affiliation editing SHALL NOT be exposed from this page — each PractitionerRole row's chip MAY link to the (placeholder until `practitioner-roles-admin-ui` ships) `/_auth/admin/practitioner-roles?practitioner_id=…` route.

#### Scenario: Admin role hides Practitioner section

- **WHEN** the detail page loads for a user with `role === 'admin'`
- **THEN** no `Practitioner section` MUST render; the API request to `/practitioners/{userId}` MUST NOT be issued

#### Scenario: Caregiver detail surfaces open and closed roles

- **WHEN** the detail page loads for a caregiver with two open PractitionerRole rows and one closed
- **THEN** the Practitioner section MUST render all three rows ordered by `is_primary DESC, period_start DESC`, with closed rows visually distinguished (e.g. muted text and a `Beëindigd` chip)

### Requirement: Create + Edit pages compose entity-page chrome with field-level errors

The orchestrator SHALL render Create at `/_auth/admin/users/new` and Edit at `/_auth/admin/users/$userId/edit`. Both routes SHALL render a single `<UserFormPage>` parameterised by `mode: 'create' | 'edit'` and SHALL compose `<EntityFormPage>` (sticky footer with Cancel + Save) driven by `useEntityForm` against a Zod schema. The form body SHALL be organised into two cards:

1. **Identiteit**: name fields (role-discriminated — see below), `email`, `role`.
2. **Praktijk** (rendered only when `role === 'caregiver'`): `qualification`.

The name fields SHALL be role-discriminated:

- `role === 'admin'` → single `display_name` input.
- `role === 'caregiver'` → two inputs (`given_name`, `family_name`) rendered as a two-column grid. `user.display_name` is NOT a form field; the backend derives it from given+family.

In **create** mode, all role-relevant required fields SHALL be editable; switching `role` SHALL swap the name field set without losing the user's other inputs. In **edit** mode, `email`, `role`, and (for caregivers) `given_name` / `family_name` / `qualification` SHALL be locked (displayed disabled with a `Lock` icon + a helper line pointing to the Practitioner page for the caregiver clinical fields). Only `display_name` (admin) flows through PATCH.

Validation SHALL use a single Zod schema with role-conditional requireds enforced via `superRefine`. Validators SHALL run on blur and on submit (via `useEntityForm`). Required-field UX:

- Every required, editable input SHALL render a red asterisk (`*`) immediately after its label.
- Locked inputs SHALL NOT render an asterisk (the value is immutable in this surface).
- Validation messages SHALL be authored as i18n keys under `form.error.*` (e.g. `form.error.required`, `form.error.email_invalid`, `form.error.too_long`) and resolved at render via `t()`; raw Zod default copy MUST NOT leak to the UI.

Submit payload SHALL be built role-conditionally:

- admin create → `{ email, role: 'admin', display_name }`
- caregiver create → `{ email, role: 'caregiver', given_name, family_name, qualification? }` (qualification omitted when empty)
- admin edit → `{ display_name }`
- caregiver edit → `{ display_name: derived }` — but since clinical fields are locked, the only mutation surface is when the *admin's own* display_name is edited; caregiver display_name is server-derived from given/family on the Practitioner page.

In **edit** mode the form SHALL hydrate from the live user before exposing inputs: it fetches the user via `GET /users/{user_id}` and, for caregivers (any non-admin role), the Practitioner via `GET /practitioners/{user_id}`, seeding `email` / `role` / `display_name` from the user and `given_name` / `family_name` / `qualification` from the Practitioner. The form MUST NOT seed from placeholder or mock defaults. While the user (or, for caregivers, the practitioner) query is pending, the page SHALL render `<EntityDetailSkeleton>`; a `404` on the user fetch SHALL render `<EntityNotFound>` (back link to the list) and any other fetch error SHALL render `<EntityErrorCard>` (retry). Create mode hydrates from empty defaults and performs no fetch. The practitioner fetch and its query key SHALL be shared with the detail page (single source), not re-declared per screen.

Cancel SHALL navigate back to the source (detail for edit, list for create). On success: create POSTs `/users`, navigates to the new detail page, fires a success toast; edit PATCHes `/users/{id}`, navigates back to detail, fires a success toast. Both flows SHALL invalidate the `/users` list query key on success. API field-level errors SHALL surface inline against the relevant field (e.g. duplicate email → `email` field error). `useDirtyGuard` SHALL block in-app navigation while the form is dirty.

#### Scenario: Name fields swap with role

- **WHEN** the user opens `<UserFormPage mode="create">` (defaults to `role = caregiver`) and flips the Rol select to `admin`
- **THEN** the `given_name` + `family_name` inputs MUST disappear, a single `display_name` input MUST appear, and the eventual POST body MUST NOT carry `given_name` / `family_name` / `qualification`

#### Scenario: Required asterisks render on required editable fields

- **WHEN** `<UserFormPage mode="create">` is mounted with `role = caregiver`
- **THEN** the `email`, `given_name`, and `family_name` labels MUST render a red asterisk; the `qualification` label MUST NOT; flipping to `role = admin` MUST move the asterisk from given/family to `display_name`

#### Scenario: Locked fields do not render asterisks

- **WHEN** the edit page loads for a caregiver
- **THEN** `email`, `role`, `given_name`, `family_name`, and `qualification` MUST render with a Lock icon + locked-helper copy AND MUST NOT render an asterisk; `display_name` is not exposed (caregiver display_name is server-derived)

#### Scenario: Edit form hydrates from live user + practitioner

- **WHEN** the edit page loads for a caregiver whose `GET /users/{id}` returns its `display_name` / `email` / `role` and `GET /practitioners/{id}` returns `given_name = "Sanne"`, `family_name = "Jansen"`, `qualification = "Huisarts"`
- **THEN** the hero MUST show the real name + email (NOT the `Nieuwe gebruiker` / `naam@voorbeeld.nl` placeholder), and the `given_name` / `family_name` / `qualification` inputs MUST be populated from the Practitioner

#### Scenario: Edit form loading and missing states

- **WHEN** the user (or caregiver practitioner) query is pending
- **THEN** `<EntityDetailSkeleton>` MUST render; AND WHEN `GET /users/{id}` resolves `404` THEN `<EntityNotFound>` MUST render with a back link to the list

#### Scenario: Validation errors render localised copy

- **WHEN** the user blurs `email` with an invalid string
- **THEN** the field error line MUST render the resolved `form.error.email_invalid` copy (Dutch: `"Vul een geldig e-mailadres in."`), NOT the raw Zod message

#### Scenario: Duplicate-email error surfaces inline

- **WHEN** the create form submits an email already taken in the tenant
- **THEN** the `email` input MUST render the error copy from `ErrorResponse{ code: "conflict.user.email_exists" }`, the route MUST NOT navigate away, and the form state MUST be preserved

#### Scenario: Dirty navigation triggers guard

- **WHEN** the user edits any field in `<UserFormPage>` and clicks the back link or a sidebar item before saving
- **THEN** the dirty-guard AlertDialog MUST open; choosing Discard completes navigation, Cancel keeps the user on the form
