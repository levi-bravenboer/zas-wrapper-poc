## 0. Chain prerequisite

- [ ] 0.1 Verify `practitioner-role-split` and `caregiver-shell` both `archived`; bail if not
- [ ] 0.2 Confirm `<FilterableListPage>` is exported and the admin route group exists

## 1. Backend writes

- [ ] 1.1 Add `app/schemas/user/user.py` types `UserCreate { email, display_name, role, qualification?, is_active? }` and `UserUpdate { display_name?, is_active? }`
- [ ] 1.2 Add `UserService.create(actor, payload)` — admin-only; tenant-scoped; if `role == caregiver`, materialises Practitioner row in the same transaction (delegates to `PractitionerService.create`)
- [ ] 1.3 Add `UserService.update_demographics(actor, user_id, payload)` — admin-only; tenant-scoped; rejects self-deactivation
- [ ] 1.4 Add `POST /users` and `PATCH /users/{user_id}` handlers with `# AUTH-HARDEN` + `Depends(require_role(Role.ADMIN))`
- [ ] 1.5 Widen `GET /users` filterable fields to include `role` and `q` (over `display_name + email`)
- [ ] 1.6 Tests: `tests/api/test_user_admin_create.py` (admin creates caregiver → Practitioner row exists; cross-tenant rejected; duplicate email surfaces 409), `tests/api/test_user_admin_update.py` (self-deactivate rejected with 409), `tests/services/test_user_service_create_atomic.py` (forced Practitioner failure rolls back the User insert)

## 2. Frontend: list page

- [ ] 2.1 Replace placeholder `apps/orchestrator/src/routes/_auth/admin/users.tsx` with route loading `<UserListPage>`
- [ ] 2.2 Create `apps/orchestrator/src/features/users/UserListPage.tsx` composing `<FilterableListPage<UserRow>>` + `<DataTable<UserRow>>`
- [ ] 2.3 Columns: Naam (sticky, sort), Email (sort), Rol (badge), Actief (badge), Aangemaakt (sort), kebab `Bewerken | Deactiveren`
- [ ] 2.4 Filters: rol single-select, actief toggle, `q` search
- [ ] 2.5 Primary CTA `Gebruiker toevoegen` opens `<CreateUserDialog>`
- [ ] 2.6 Empty state copy: `"Nog geen gebruikers in dit tenant."`

## 3. Frontend: detail page

- [ ] 3.1 Add route `_auth/admin/users/$userId.tsx` rendering `<UserDetailPage>`
- [ ] 3.2 `<UserDetailPage>` sections: demographics (Naam, Email, Rol, Actief, Aangemaakt), Practitioner panel (display name, qualification, open + closed PractitionerRole rows in a small table)
- [ ] 3.3 Kebab on the page: `Bewerken` (opens `<EditUserDialog>`), `Deactiveren` (destructive confirm)
- [ ] 3.4 PractitionerRole table rows include a chip linking to `_auth/admin/practitioner-roles?practitioner_id=…` when that route exists; today's placeholder is fine

## 4. Frontend: dialogs

- [ ] 4.1 Create `<CreateUserDialog>` form: email, display_name, role (default `caregiver`), qualification (only when role === caregiver). On submit POST `/users`; on field-level errors surface via shadcn form
- [ ] 4.2 Create `<EditUserDialog>` form: display_name, is_active. PATCH `/users/{user_id}`. Self-deactivation 409 surfaces as inline error.

## 5. i18n

- [ ] 5.1 New namespace `users-admin-ui` in both `en/` and `nl/`
- [ ] 5.2 No raw strings outside `t()` in the new features

## 6. OpenAPI + typed client

- [ ] 6.1 `moon run backend:openapi` regenerate
- [ ] 6.2 `moon run orchestrator:typegen`
- [ ] 6.3 Contract test: the two new endpoints appear with expected shapes

## 7. Tests + verification

- [ ] 7.1 `apps/orchestrator/src/features/users/__tests__/UserListPage.test.tsx`: search + filter + kebab actions
- [ ] 7.2 `apps/orchestrator/src/features/users/__tests__/CreateUserDialog.test.tsx`: caregiver create surfaces Practitioner panel on the next detail load
- [ ] 7.3 `apps/orchestrator/src/features/users/__tests__/EditUserDialog.test.tsx`: self-deactivation guard
- [ ] 7.4 `moon run backend:lint` `moon run backend:typecheck` `moon run backend:test`
- [ ] 7.5 `moon run orchestrator:lint` `moon run orchestrator:typecheck` `moon run orchestrator:test`

## 8. Docs

- [ ] 8.1 Update `CHAIN-orchestrator-admin-ux.md`: mark `users-admin-ui` `applied` after merge
- [ ] 8.2 `openspec validate users-admin-ui --strict` clean
