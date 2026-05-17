**Tier**: chain — orchestrator-admin-ux #3

## Why

`user-base` ships only `GET /users` and `PATCH /users/{id}/role`. An admin cannot today create a caregiver, edit their display name, deactivate an account, or see what affiliations a user has — all of which are required for the ZAS demo (external caregivers join the system; admins onboard them).

`caregiver-shell` registered the placeholder route `/_auth/admin/users` and gated the entire `_auth/admin/*` group on `role === 'admin'`. `practitioner-role-split` shipped the `Practitioner` + `PractitionerRole` tables. `entity-page-scaffolding` (#2.5) shipped the shared `<EntityDetailPage>` + `<EntityFormPage>` chrome and the `useEntityForm` / `useDirtyGuard` / `useEntityDelete` hooks. Now we land the actual admin UI: list with filters, full-page create + edit routes composing the entity-page chrome, detail page (user demographics + linked Practitioner + open + closed PractitionerRole rows), deactivate action.

This change is **#3 of the orchestrator-admin-ux chain**. It MAY ship in parallel with `#4 organisations-admin-ui` and `#6 patient-profile-ui` (independent worktrees, independent merges).

## What Changes

- **Add capability `users-admin-ui`** covering:
  - List route `/_auth/admin/users` composing `<FilterableListPage<UserRow>>` + `<DataTable<UserRow>>`. Columns: Naam, Email, Rol, Actief, Aangemaakt, kebab actions (Bewerken → edit page, Deactiveren).
  - Filters: rol (admin/caregiver), actief (true/false), search (`q` over `display_name + email`).
  - Detail route `/_auth/admin/users/$userId` built on `<EntityDetailPage>` + `<EntityDetailSingleColumn>` with two Card sections: user demographics + (for caregivers) embedded Practitioner panel (display name, qualification, list of roles with code + organisation + period). Header actions: Bewerken (navigates to edit page), Deactiveren (AlertDialog confirm via `useEntityDelete`-adapted soft-deactivate). Affiliation editing is deferred to `practitioner-roles-admin-ui`.
  - Create route `/_auth/admin/users/new` and Edit route `/_auth/admin/users/$userId/edit` both rendering a single `<UserFormPage mode>` component built on `<EntityFormPage>` + `useEntityForm` (Zod-validated). Form is role-discriminated: `admin` shows a single `display_name`; `caregiver` shows `given_name` + `family_name` (two-column) and the Praktijk card with `qualification`. `email` + `role` live in the Identiteit card. In edit mode, `email`, `role`, and (for caregivers) clinical fields are locked. Required fields render a red `*`; validation messages are i18n-keyed (`form.error.*`) and resolved via `t()`. Activation flips stay on the existing `PATCH /users/{id}/active` triggered from the kebab/header action via AlertDialog. `useDirtyGuard` blocks in-app navigation while dirty.
- **Add backend admin endpoints** under `/users` (admin-only, `# AUTH-HARDEN` markers):
  - `POST /users` — create a new user; on creation of a `caregiver`, ALSO materialise a Practitioner row (delegating to the practitioner service) in the same transaction. Body is role-discriminated:
    - `admin` → `{ email, role: "admin", display_name }`
    - `caregiver` → `{ email, role: "caregiver", given_name, family_name, qualification? }` — backend derives `user.display_name = f"{given} {family}"` and writes the Practitioner row with given/family/qualification taken directly from the payload.
    - Pydantic rejects mixed-branch payloads with 422.
    - Initial credentials are out of scope: service provisions a placeholder hashed password; real onboarding happens through the separate auth-hardening track.
  - `PATCH /users/{user_id}` — edit `display_name` only; role + active flips stay on the existing `/users/{id}/role` and `/users/{id}/active` endpoints. For caregivers, clinical fields (given/family/qualification) live on the Practitioner update endpoint, not here.
  - The existing `GET /users` requirement is unchanged in shape; its filter set MAY widen to include `role` and `q` (search) on top of the existing `is_active` filter without breaking callers.
- **MODIFIES `user-base`**: documents the new admin write endpoints under `users-admin-ui` capability; `user-base` proper sees a search-filter widening on `GET /users` (additive, no behaviour change for existing callers).
- **Regenerate OpenAPI + typed client.**

## Capabilities

### New Capabilities

- `users-admin-ui`: admin list + detail + create + edit + deactivate UI plus the backend writes needed to support it.

### Modified Capabilities

- `user-base`: `GET /users` filter widening (additive: `q`, `role`).

## Impact

- **Chain prerequisites**: `practitioner-role-split`, `caregiver-shell`, and `entity-page-scaffolding` all archived.
- **Code**:
  - Backend: `app/api/routers/user/user_router.py` — add `POST /users`, `PATCH /users/{id}`; widen list filters.
  - Backend: `app/services/user/user_service.py` — `create`, `update_demographics`, plus practitioner auto-materialisation hook on caregiver create.
  - Backend: `app/schemas/user/user.py` — add `UserCreate`, `UserUpdate`.
  - Frontend: `apps/orchestrator/src/routes/_auth/admin/users/index.tsx`, `apps/orchestrator/src/routes/_auth/admin/users/new.tsx`, `apps/orchestrator/src/routes/_auth/admin/users/$userId/index.tsx`, `apps/orchestrator/src/routes/_auth/admin/users/$userId/edit.tsx`.
  - Frontend: `apps/orchestrator/src/modules/user/components/UserListPage.tsx`, `UserDetailPage.tsx`, `UserFormPage.tsx` (single create/edit component parameterised by `mode`).
  - Frontend: `apps/orchestrator/src/lib/i18n/locales/nl/users-admin-ui.json`.
- **APIs**: 2 new endpoints; 1 widened list filter.
- **DB**: no schema changes (Practitioner table already in place from `#1`).
- **Demo**: admin can onboard a new external GP end-to-end, deactivate users, edit display names.
- **Chain position**: change #3 of the orchestrator-admin-ux chain (parallel with #4 + #6).

## Risks and mitigations

- **R1 — caregiver creation should atomically create Practitioner.** A half-materialised User without Practitioner makes downstream visibility predicates flaky. **Mitigation**: `POST /users` with `role=caregiver` MUST commit User + Practitioner in the same transaction; tests assert no orphan User-without-Practitioner after a failed Practitioner insert.
- **R2 — admin deactivates themselves.** Recoverable but confusing. **Mitigation**: the `Deactiveren` kebab is disabled when `user.id === currentSession.user.id`; backend additionally rejects self-deactivation with `409 Conflict`.
- **R3 — email uniqueness.** Already tenant-scoped at the DB level (existing in `user-base`). **Mitigation**: surface the unique-violation cleanly through the form with field-level error copy.
- **R4 — split name vs single name.** Different roles want different shapes (admins have no clinical name; caregivers need given/family for Practitioner). **Mitigation**: role-discriminated payload, server-derived `user.display_name` for caregivers, single source of truth on Practitioner for clinical names.
- **R5 — initial credentials.** `UserCreate` does not accept a password. **Mitigation**: backend writes a random hashed placeholder; real credential onboarding (invite-link/IdP) is on the separate auth-hardening track and out of scope here.

## Out of scope

- Affiliation editing (creating/updating PractitionerRole rows) — `#5 practitioner-roles-admin-ui`.
- Password / IdP reset flows — out of chain, separate auth-hardening track.
- Bulk import — backlog.
- Audit log surface — backlog.
