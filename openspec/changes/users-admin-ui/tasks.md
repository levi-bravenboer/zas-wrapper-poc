## 0. Chain prerequisite

- [x] 0.1 Verify `practitioner-role-split`, `caregiver-shell`, and `entity-page-scaffolding` all `archived`; bail if not
- [x] 0.2 Confirm `<FilterableListPage>` is exported, the `_auth/admin` route group exists, and `<EntityDetailPage>` / `<EntityFormPage>` / `useEntityForm` / `useDirtyGuard` / `useEntityDelete` are exported under `apps/orchestrator/src/components/entity/` + `apps/orchestrator/src/hooks/entity/`

## 1. Backend writes

- [x] 1.1 Add `app/schemas/user/user.py` role-discriminated `UserCreate` (admin → `{ email, role, display_name }`; caregiver → `{ email, role, given_name, family_name, qualification? }`; mixed-branch payloads rejected via `model_validator`) and `UserUpdate { display_name? }`. Active flips stay on existing `SetActiveRequest`.
- [x] 1.2 Add `UserService.create(actor, payload)` — admin-only; tenant-scoped; derives `user.display_name` from given+family for caregivers; provisions a placeholder hashed password (random token); if `role == caregiver`, materialises Practitioner row in the same transaction (delegates to `PractitionerService.create`)
- [x] 1.3 Add `UserService.update_demographics(actor, user_id, payload)` — admin-only; tenant-scoped; updates `display_name`
- [x] 1.4 Add `POST /users` and `PATCH /users/{user_id}` handlers with `# AUTH-HARDEN` + `Depends(require_role(Role.ADMIN))`. POST returns `201` w/ `UserRow`; PATCH returns `200` w/ `UserRow`
- [x] 1.5 `GET /users` already exposes `role` filter + `q` (via `searchable_fields`) through `BaseListRepository` — no widening needed; verify with a test
- [x] 1.6 Tests: `tests/api/test_user_admin_create.py` (admin creates caregiver → Practitioner row exists w/ given/family/qualification AND user.display_name == "{given} {family}"; mixed-branch payload → 422; cross-tenant rejected; duplicate email surfaces 409), `tests/api/test_user_admin_update.py` (display_name edit succeeds; cross-tenant rejected 403), `tests/services/test_user_service_create_atomic.py` (forced Practitioner failure rolls back the User insert)

## 2. Frontend: list page

- [x] 2.0 **Prototype pass**: scaffold `UserListPage` with hardcoded `mockUsers` array (5 rows incl. one admin, 3 caregivers — one self, one inactive, one with multiple PractitionerRole rows; one external). Mark every TODO with `// TODO(wire): replace with usePaginatedQuery` etc. Run `moon run orchestrator:dev`, navigate to `/_auth/admin/users`, eyeball spacing/copy/widths; adjust until happy before §2.1
- [x] 2.1 Replace placeholder `apps/orchestrator/src/routes/_auth/admin/users/index.tsx` with route loading `<UserListPage>`
- [x] 2.2 Create `apps/orchestrator/src/modules/user/components/UserListPage.tsx` composing `<FilterableListPage<UserRow>>` + `<DataTable<UserRow>>`
- [x] 2.3 Columns: Naam (sticky, sort), Email (sort), Rol (badge), Actief (badge), Aangemaakt (sort), kebab `Bewerken | Deactiveren`
- [x] 2.4 Filters: rol single-select, actief toggle, `q` search
- [x] 2.5 Primary CTA `Gebruiker toevoegen` is a `<Link to="/_auth/admin/users/new">`; row kebab `Bewerken` links to `/_auth/admin/users/$userId/edit`
- [x] 2.6 Empty state copy: `"Nog geen gebruikers in dit tenant."`
- [x] 2.7 Row kebab `Deactiveren` opens an inline AlertDialog (via `useEntityDelete`-adapted helper or local state) → `PATCH /users/{id}/active` with `{ is_active: false }` (existing endpoint via `setUserActive` in `modules/user/api.ts`) → toast + invalidate list query; disabled when `row.id === currentSession.user.id`

## 3. Frontend: detail page

- [x] 3.0 **Prototype pass**: scaffold `UserDetailPage` with hardcoded `mockUser` (caregiver with 2 open + 1 closed PractitionerRole rows) and a second fixture (`mockAdminUser` — should hide Practitioner card). Browse `/_auth/admin/users/:id`; eyeball card spacing, header actions row, role badge placement; adjust before §3.1
- [x] 3.1 Add route `_auth/admin/users/$userId/index.tsx` rendering `<UserDetailPage>`
- [x] 3.2 `<UserDetailPage>` composes `<EntityDetailPage>` (title=display_name, subtitle=role badge + email, back=list, actions=Bewerken + Deactiveren) wrapping `<EntityDetailSingleColumn>` with two `<Card>` sections: demographics + Practitioner panel
- [x] 3.3 Demographics card: Naam, Email, Rol, Actief, Aangemaakt
- [x] 3.4 Practitioner card (only when `user.role === 'caregiver'` and `GET /practitioners/{userId}` returns 200): family_name, given_name, qualification, table of open + closed PractitionerRole rows (sort `is_primary DESC, period_start DESC`); closed rows muted + `Beëindigd` chip
- [x] 3.5 Header actions: `Bewerken` links to `$userId/edit`; `Deactiveren` opens AlertDialog → `PATCH /users/{id}/active` (existing endpoint) → toast + invalidate detail query; disabled for current admin's own row
- [x] 3.6 Loading → `<EntityDetailSkeleton>`; 404 → `<EntityNotFound backTo={{ to: '/_auth/admin/users' }} />`; error → `<EntityErrorCard onRetry={refetch} />`
- [x] 3.7 PractitionerRole table rows include a chip linking to `_auth/admin/practitioner-roles?practitioner_id=…` when that route exists; today's placeholder is fine

## 4. Frontend: create + edit form page

- [x] 4.0 **Prototype pass**: scaffold `UserFormPage` with mocked `defaultValues` (edit) + mocked submit `(values) => console.log + sleep 300ms + resolve`. Browse `/_auth/admin/users/new` and `/_auth/admin/users/seed-uuid/edit`; eyeball field order, qualification toggle when role flips, sticky footer behavior on scroll, dirty-guard dialog copy. Adjust before §4.1
- [x] 4.1 Add route `_auth/admin/users/new.tsx` rendering `<UserFormPage mode="create">`
- [x] 4.2 Add route `_auth/admin/users/$userId/edit.tsx` rendering `<UserFormPage mode="edit" userId={...}>`
- [x] 4.3 Create `apps/orchestrator/src/modules/user/components/UserFormPage.tsx` — single component parameterised by `mode`; composes `<EntityFormPage>` driven by `useEntityForm` against a Zod schema; renders shadcn `Form` fields: email (create only), display_name, role (create only; default `caregiver`), qualification (only when `role === 'caregiver'`); edit mode only renders `display_name`
- [x] 4.4 Wire `useDirtyGuard` to the form's `isDirty`
- [x] 4.5 Create flow: on submit POST `/users`; on success navigate to `/_auth/admin/users/$newId` + success toast + invalidate list query; on validation error / 409 surface inline against the offending field, keep route mounted
- [x] 4.6 Edit flow: on submit PATCH `/users/{userId}`; on success navigate back to detail + success toast + invalidate detail + list query; 409 self-deactivate / 403 cross-tenant surface inline
- [x] 4.7 Cancel button → back navigation: edit returns to detail, create returns to list

## 5. i18n

- [x] 5.1 New namespace `users-admin-ui` registered (Dutch locale; en/ deferred per repo-wide pattern)
- [x] 5.2 No raw strings outside `t()` in the new features

## 6. OpenAPI + typed client

- [x] 6.1 `moon run backend:openapi` regenerate
- [x] 6.2 `moon run orchestrator:typegen`
- [x] 6.3 Contract test: the two new endpoints appear with expected shapes

## 7. Tests + verification

- [x] 7.1 `apps/orchestrator/src/modules/user/components/__tests__/UserListPage.test.tsx`: search + filter + kebab actions; Deactiveren disabled on self row
- [x] 7.2 `apps/orchestrator/src/modules/user/components/__tests__/UserFormPage.create.test.tsx`: qualification visibility tied to role; duplicate-email 409 surfaces inline + route stays mounted; success navigates to detail
- [x] 7.3 `apps/orchestrator/src/modules/user/components/__tests__/UserFormPage.edit.test.tsx`: self-deactivation 409 inline; dirty navigation triggers guard dialog
- [x] 7.4 `apps/orchestrator/src/modules/user/components/__tests__/UserDetailPage.test.tsx`: admin role hides Practitioner card; caregiver shows open + closed roles; Deactiveren disabled for current admin's own row
- [x] 7.5 `moon run backend:lint` `moon run backend:typecheck` `moon run backend:test`
- [x] 7.6 `moon run orchestrator:lint` `moon run orchestrator:typecheck` `moon run orchestrator:test`

## 8. Docs

- [x] 8.1 Update `CHAIN-orchestrator-admin-ux.md`: mark `users-admin-ui` `applied` after merge (chain doc not present in repo; skipped)
- [x] 8.2 `openspec validate users-admin-ui --strict` clean
