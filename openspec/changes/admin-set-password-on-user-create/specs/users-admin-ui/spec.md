## MODIFIED Requirements

### Requirement: Admin can create users with atomic Practitioner materialisation

The backend SHALL expose `POST /users` (admin-only, `# AUTH-HARDEN`-marked) accepting a role-discriminated body:

- `role: admin` → `UserCreate { email, role, display_name, password }`.
- `role: caregiver` → `UserCreate { email, role, given_name, family_name, qualification?, password }`. The handler SHALL derive `user.display_name = f"{given_name} {family_name}"` server-side (clients do not send `display_name` for caregivers).

`password` is REQUIRED on both branches and SHALL be at least 8 characters; Pydantic SHALL reject a shorter or missing password with `422`. Pydantic SHALL reject payloads that mix branches (e.g. an admin payload carrying `given_name`, or a caregiver payload carrying `display_name`) with `422`. Email uniqueness is tenant-scoped (existing constraint from `user-base`). When `role == caregiver`, the handler SHALL — in the same database transaction as the User insert — call `PractitionerService.create` to materialise a Practitioner row with `family_name`, `given_name`, and the optional `qualification` taken directly from the payload. If the Practitioner insert fails, the entire transaction SHALL roll back; no orphan User without Practitioner row may persist.

`UserService.create` SHALL provision the user's credential from the supplied `password`: it hashes the password with the Argon2id `PasswordHasher` and imports that hash into Kratos as the login credential (and stores it in `users.password_hash`). No random placeholder credential is generated. When a Kratos identity already exists for the email (one human, multiple role rows), the existing identity's credential is authoritative and the supplied password is NOT re-applied to Kratos. The plaintext password SHALL never be returned in a response or written to logs.

#### Scenario: Caregiver creation materialises Practitioner atomically

- **WHEN** an admin posts `{"email": "x@y", "role": "caregiver", "given_name": "Sanne", "family_name": "Jansen", "qualification": "Huisarts", "password": "s3cret-pw"}`
- **THEN** the response is `201 Created` with `UserRow.display_name == "Sanne Jansen"`, AND a `practitioners` row exists with `user_id = response.id`, `given_name = "Sanne"`, `family_name = "Jansen"`, `qualification = "Huisarts"`

#### Scenario: Created user can log in with the typed password

- **WHEN** an admin creates a user with `password = "s3cret-pw"` and that user then authenticates via the password login flow with `"s3cret-pw"`
- **THEN** authentication MUST succeed (the typed password is the working Kratos credential)

#### Scenario: Password shorter than 8 chars rejected

- **WHEN** an admin posts a create payload with `password` shorter than 8 characters (or omits `password`)
- **THEN** the response is `422 Unprocessable Entity`; no `users` row and no Kratos identity are created

#### Scenario: Password is not echoed in the response

- **WHEN** an admin creates a user
- **THEN** the `201` `UserRow` body MUST NOT contain the password or its hash

#### Scenario: Practitioner insert failure rolls back User insert

- **WHEN** `POST /users` with `role=caregiver` is called and the Practitioner insert raises (e.g. forced unique violation in a test)
- **THEN** no `users` row with that email exists after the failed request, and the response is a 5xx surfaced through the standard error envelope

#### Scenario: Admin creation does NOT create a Practitioner

- **WHEN** an admin posts `{"email": "bo@y", "role": "admin", "display_name": "Bo de Vries", "password": "s3cret-pw"}`
- **THEN** the response is `201 Created` and no `practitioners` row is created for that user

#### Scenario: Mixed-branch payload rejected

- **WHEN** an admin posts `{"role": "admin", "display_name": "X", "given_name": "X", "password": "s3cret-pw"}` (or any other cross-branch field combo)
- **THEN** the response is `422 Unprocessable Entity`; no row is created

#### Scenario: Duplicate email surfaces 409

- **WHEN** an admin posts an email that already exists in their tenant
- **THEN** the response is `409 Conflict` with `ErrorResponse{ code: "conflict.user.email_exists" }`

### Requirement: Create + Edit pages compose entity-page chrome with field-level errors

The orchestrator SHALL render Create at `/_auth/admin/users/new` and Edit at `/_auth/admin/users/$userId/edit`. Both routes SHALL render a single `<UserFormPage>` parameterised by `mode: 'create' | 'edit'` and SHALL compose `<EntityFormPage>` (sticky footer with Cancel + Save) driven by `useEntityForm` against a Zod schema. The form body SHALL be organised into two cards:

1. **Identiteit**: name fields (role-discriminated — see below), `email`, `role`, and — in **create** mode only — `password`.
2. **Praktijk** (rendered only when `role === 'caregiver'`): `qualification`.

The name fields SHALL be role-discriminated:

- `role === 'admin'` → single `display_name` input.
- `role === 'caregiver'` → two inputs (`given_name`, `family_name`) rendered as a two-column grid. `user.display_name` is NOT a form field; the backend derives it from given+family.

The `password` input SHALL render in **create** mode only, as a required field (red asterisk) with `type="password"` and `autoComplete="new-password"`. It SHALL NOT render in **edit** mode; credentials are not editable through this surface.

In **create** mode, all role-relevant required fields SHALL be editable; switching `role` SHALL swap the name field set without losing the user's other inputs. In **edit** mode, `email`, `role`, and (for caregivers) `given_name` / `family_name` / `qualification` SHALL be locked (displayed disabled with a `Lock` icon + a helper line pointing to the Practitioner page for the caregiver clinical fields). Only `display_name` (admin) flows through PATCH.

Validation SHALL use a Zod schema with role-conditional requireds enforced via `superRefine`; the create schema additionally requires `password` (min 8, message key `form.error.password_too_short`) while the edit schema omits it. Validators SHALL run on blur and on submit (via `useEntityForm`). Required-field UX:

- Every required, editable input SHALL render a red asterisk (`*`) immediately after its label.
- Locked inputs SHALL NOT render an asterisk (the value is immutable in this surface).
- Validation messages SHALL be authored as i18n keys under `form.error.*` (e.g. `form.error.required`, `form.error.email_invalid`, `form.error.too_long`, `form.error.password_too_short`) and resolved at render via `t()`; raw Zod default copy MUST NOT leak to the UI.

Submit payload SHALL be built role-conditionally:

- admin create → `{ email, role: 'admin', display_name, password }`
- caregiver create → `{ email, role: 'caregiver', given_name, family_name, qualification?, password }` (qualification omitted when empty)
- admin edit → `{ display_name }`
- caregiver edit → `{ display_name: derived }` — but since clinical fields are locked, the only mutation surface is when the *admin's own* display_name is edited; caregiver display_name is server-derived from given/family on the Practitioner page.

In **edit** mode the form SHALL hydrate from the live user before exposing inputs: it fetches the user via `GET /users/{user_id}` and, for caregivers (any non-admin role), the Practitioner via `GET /practitioners/{user_id}`, seeding `email` / `role` / `display_name` from the user and `given_name` / `family_name` / `qualification` from the Practitioner. The form MUST NOT seed from placeholder or mock defaults. While the user (or, for caregivers, the practitioner) query is pending, the page SHALL render `<EntityDetailSkeleton>`; a `404` on the user fetch SHALL render `<EntityNotFound>` (back link to the list) and any other fetch error SHALL render `<EntityErrorCard>` (retry). Create mode hydrates from empty defaults (including an empty `password`) and performs no fetch. The practitioner fetch and its query key SHALL be shared with the detail page (single source), not re-declared per screen.

Cancel SHALL navigate back to the source (detail for edit, list for create). On success: create POSTs `/users`, navigates to the new detail page, fires a success toast; edit PATCHes `/users/{id}`, navigates back to detail, fires a success toast. Both flows SHALL invalidate the `/users` list query key on success. API field-level errors SHALL surface inline against the relevant field (e.g. duplicate email → `email` field error). `useDirtyGuard` SHALL block in-app navigation while the form is dirty.

#### Scenario: Password field renders in create mode only

- **WHEN** `<UserFormPage mode="create">` is mounted
- **THEN** a required `password` input (`type="password"`) MUST render in the Identiteit card; AND WHEN `<UserFormPage mode="edit">` loads THEN no password input MUST render

#### Scenario: Password length validation surfaces localised copy

- **WHEN** the create form submits with a `password` shorter than 8 characters
- **THEN** the `password` input MUST render the resolved `form.error.password_too_short` copy, the POST MUST NOT fire, and the form state MUST be preserved

#### Scenario: Create payload carries the password

- **WHEN** the create form is submitted with a valid password
- **THEN** the `POST /users` body MUST include the `password` field

#### Scenario: Name fields swap with role

- **WHEN** the user opens `<UserFormPage mode="create">` (defaults to `role = caregiver`) and flips the Rol select to `admin`
- **THEN** the `given_name` + `family_name` inputs MUST disappear, a single `display_name` input MUST appear, and the eventual POST body MUST NOT carry `given_name` / `family_name` / `qualification`

#### Scenario: Required asterisks render on required editable fields

- **WHEN** `<UserFormPage mode="create">` is mounted with `role = caregiver`
- **THEN** the `email`, `given_name`, `family_name`, and `password` labels MUST render a red asterisk; the `qualification` label MUST NOT; flipping to `role = admin` MUST move the asterisk from given/family to `display_name`

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
