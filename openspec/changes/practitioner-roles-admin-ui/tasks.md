## 0. Chain prerequisite

- [ ] 0.1 Verify `practitioner-role-split` archived, `caregiver-shell` archived, `users-admin-ui` and `organisations-admin-ui` merged

## 1. Shared pickers

- [ ] 1.1 Create `apps/orchestrator/src/components/pickers/UserPicker.tsx` — shadcn Combobox over `usePaginatedQuery('/users', { filter: { role } })`; props: `role: Role`, `value: UserId | null`, `onChange`
- [ ] 1.2 Create `OrganisationPicker.tsx` — shadcn Combobox over `usePaginatedQuery('/organisations', {})`; renders tree-path label (e.g. `Zas Hospital / Cardiology`)
- [ ] 1.3 Create `PractitionerPicker.tsx` — like UserPicker but filters `users` to those with an existing Practitioner row (server-side hint via `?has_practitioner=true` flag added to `GET /users` in this change)
- [ ] 1.4 (Backend) Add `?has_practitioner=true|false` filter to `GET /users` (additive)

## 2. List page

- [ ] 2.1 Replace placeholder `_auth/admin/practitioner-roles.tsx` with route loading `<PractitionerRoleListPage>`
- [ ] 2.2 List composes `<FilterableListPage<PractitionerRoleRead>>` + `<DataTable<PractitionerRoleRead>>`
- [ ] 2.3 Columns: Zorgverlener (sticky), Organisatie, Rol (badge), Specialiteit, Primair (badge), Periode (period_start — period_end or `→`), kebab
- [ ] 2.4 Filters in `filters` slot: Zorgverlener picker, Organisatie picker, Rol single-select, Open toggle
- [ ] 2.5 URL deep-link support: `?practitioner_id=…` and `?organisation_id=…` prefill the corresponding filter

## 3. Dialogs + confirms

- [ ] 3.1 `<OpenRoleDialog>` — form: PractitionerPicker, OrganisationPicker, Rol (enum), Specialiteit, is_primary checkbox, period_start (default `now`); submit `POST /practitioner-roles`
- [ ] 3.2 `<EditRoleDialog>` — form: Rol, Specialiteit, is_primary; submit `PATCH /practitioner-roles/{id}`
- [ ] 3.3 `<CloseRoleConfirm>` — destructive confirm; submit `DELETE /practitioner-roles/{id}` (soft close)

## 4. i18n

- [ ] 4.1 New namespace `practitioner-roles-admin-ui` in `en/` and `nl/`

## 5. Backend filter widening

- [ ] 5.1 Add `has_practitioner` boolean filter to `GET /users`; tests pass
- [ ] 5.2 Regenerate openapi + typegen

## 6. Tests

- [ ] 6.1 `<PractitionerRoleListPage>` test: deep-link prefill, filter compose into envelope
- [ ] 6.2 `<OpenRoleDialog>` test: setting `is_primary` on a practitioner with existing open primary results in one updated list row showing demoted primary after invalidation
- [ ] 6.3 `<CloseRoleConfirm>` test: closed row's kebab no longer exposes `Beëindigen`
- [ ] 6.4 `<UserPicker>`, `<OrganisationPicker>` snapshot + interaction tests

## 7. Verification

- [ ] 7.1 Backend lint / typecheck / test
- [ ] 7.2 Orchestrator lint / typecheck / test

## 8. Docs

- [ ] 8.1 Update CHAIN tracker
- [ ] 8.2 `openspec validate practitioner-roles-admin-ui --strict` clean
