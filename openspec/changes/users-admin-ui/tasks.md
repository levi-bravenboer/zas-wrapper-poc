## 0. Chain prerequisite

- [ ] 0.1 Verify `practitioner-role-split`, `caregiver-shell`, and `entity-page-scaffolding` all `archived`; bail if not
- [ ] 0.2 Confirm `<FilterableListPage>` is exported, the `_auth/admin` route group exists, and `<EntityDetailPage>` / `<EntityFormPage>` / `useEntityForm` / `useDirtyGuard` / `useEntityDelete` are exported under `apps/orchestrator/src/components/entity/` + `apps/orchestrator/src/hooks/entity/`

## 1. Backend writes

- [ ] 1.1 Add `app/schemas/user/user.py` types `UserCreate { email, display_name, role, qualification?, is_active? }` and `UserUpdate { display_name?, is_active? }`
- [ ] 1.2 Add `UserService.create(actor, payload)` — admin-only; tenant-scoped; if `role == caregiver`, materialises Practitioner row in the same transaction (delegates to `PractitionerService.create`)
- [ ] 1.3 Add `UserService.update_demographics(actor, user_id, payload)` — admin-only; tenant-scoped; rejects self-deactivation
- [ ] 1.4 Add `POST /users` and `PATCH /users/{user_id}` handlers with `# AUTH-HARDEN` + `Depends(require_role(Role.ADMIN))`
- [ ] 1.5 Widen `GET /users` filterable fields to include `role` and `q` (over `display_name + email`)
- [ ] 1.6 Tests: `tests/api/test_user_admin_create.py` (admin creates caregiver → Practitioner row exists; cross-tenant rejected; duplicate email surfaces 409), `tests/api/test_user_admin_update.py` (self-deactivate rejected with 409), `tests/services/test_user_service_create_atomic.py` (forced Practitioner failure rolls back the User insert)

## 2. Frontend: list page

- [ ] 2.1 Replace placeholder `apps/orchestrator/src/routes/_auth/admin/users/index.tsx` with route loading `<UserListPage>`
- [ ] 2.2 Create `apps/orchestrator/src/features/users/UserListPage.tsx` composing `<FilterableListPage<UserRow>>` + `<DataTable<UserRow>>`
- [ ] 2.3 Columns: Naam (sticky, sort), Email (sort), Rol (badge), Actief (badge), Aangemaakt (sort), kebab `Bewerken | Deactiveren`
- [ ] 2.4 Filters: rol single-select, actief toggle, `q` search
- [ ] 2.5 Primary CTA `Gebruiker toevoegen` is a `<Link to="/_auth/admin/users/new">`; row kebab `Bewerken` links to `/_auth/admin/users/$userId/edit`
- [ ] 2.6 Empty state copy: `"Nog geen gebruikers in dit tenant."`
- [ ] 2.7 Row kebab `Deactiveren` opens an inline AlertDialog (via `useEntityDelete`-adapted helper or local state) → `PATCH /users/{id}` with `is_active=false` → toast + invalidate list query; disabled when `row.id === currentSession.user.id`

## 3. Frontend: detail page

- [ ] 3.1 Add route `_auth/admin/users/$userId/index.tsx` rendering `<UserDetailPage>`
- [ ] 3.2 `<UserDetailPage>` composes `<EntityDetailPage>` (title=display_name, subtitle=role badge + email, back=list, actions=Bewerken + Deactiveren) wrapping `<EntityDetailSingleColumn>` with two `<Card>` sections: demographics + Practitioner panel
- [ ] 3.3 Demographics card: Naam, Email, Rol, Actief, Aangemaakt
- [ ] 3.4 Practitioner card (only when `user.role === 'caregiver'` and `GET /practitioners/{userId}` returns 200): family_name, given_name, qualification, table of open + closed PractitionerRole rows (sort `is_primary DESC, period_start DESC`); closed rows muted + `Beëindigd` chip
- [ ] 3.5 Header actions: `Bewerken` links to `$userId/edit`; `Deactiveren` opens AlertDialog → `PATCH /users/{id}` is_active=false → toast + invalidate detail query; disabled for current admin's own row
- [ ] 3.6 Loading → `<EntityDetailSkeleton>`; 404 → `<EntityNotFound backTo={{ to: '/_auth/admin/users' }} />`; error → `<EntityErrorCard onRetry={refetch} />`
- [ ] 3.7 PractitionerRole table rows include a chip linking to `_auth/admin/practitioner-roles?practitioner_id=…` when that route exists; today's placeholder is fine

## 4. Frontend: create + edit form page

- [ ] 4.1 Add route `_auth/admin/users/new.tsx` rendering `<UserFormPage mode="create">`
- [ ] 4.2 Add route `_auth/admin/users/$userId/edit.tsx` rendering `<UserFormPage mode="edit" userId={...}>`
- [ ] 4.3 Create `apps/orchestrator/src/features/users/UserFormPage.tsx` — single component parameterised by `mode`; composes `<EntityFormPage>` driven by `useEntityForm` against a Zod schema; renders shadcn `Form` fields: email (create only), display_name, role (create only; default `caregiver`), qualification (only when `role === 'caregiver'`), is_active (edit only)
- [ ] 4.4 Wire `useDirtyGuard` to the form's `isDirty`
- [ ] 4.5 Create flow: on submit POST `/users`; on success navigate to `/_auth/admin/users/$newId` + success toast + invalidate list query; on validation error / 409 surface inline against the offending field, keep route mounted
- [ ] 4.6 Edit flow: on submit PATCH `/users/{userId}`; on success navigate back to detail + success toast + invalidate detail + list query; 409 self-deactivate / 403 cross-tenant surface inline
- [ ] 4.7 Cancel button → back navigation: edit returns to detail, create returns to list

## 5. i18n

- [ ] 5.1 New namespace `users-admin-ui` in both `en/` and `nl/`
- [ ] 5.2 No raw strings outside `t()` in the new features

## 6. OpenAPI + typed client

- [ ] 6.1 `moon run backend:openapi` regenerate
- [ ] 6.2 `moon run orchestrator:typegen`
- [ ] 6.3 Contract test: the two new endpoints appear with expected shapes

## 7. Tests + verification

- [ ] 7.1 `apps/orchestrator/src/features/users/__tests__/UserListPage.test.tsx`: search + filter + kebab actions; Deactiveren disabled on self row
- [ ] 7.2 `apps/orchestrator/src/features/users/__tests__/UserFormPage.create.test.tsx`: qualification visibility tied to role; duplicate-email 409 surfaces inline + route stays mounted; success navigates to detail
- [ ] 7.3 `apps/orchestrator/src/features/users/__tests__/UserFormPage.edit.test.tsx`: self-deactivation 409 inline; dirty navigation triggers guard dialog
- [ ] 7.4 `apps/orchestrator/src/features/users/__tests__/UserDetailPage.test.tsx`: admin role hides Practitioner card; caregiver shows open + closed roles; Deactiveren disabled for current admin's own row
- [ ] 7.5 `moon run backend:lint` `moon run backend:typecheck` `moon run backend:test`
- [ ] 7.6 `moon run orchestrator:lint` `moon run orchestrator:typecheck` `moon run orchestrator:test`

## 8. Docs

- [ ] 8.1 Update `CHAIN-orchestrator-admin-ux.md`: mark `users-admin-ui` `applied` after merge
- [ ] 8.2 `openspec validate users-admin-ui --strict` clean
