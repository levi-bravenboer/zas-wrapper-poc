## 0. Chain prerequisite

- [x] 0.1 Verify `practitioner-role-split` archived, `caregiver-shell` archived, `users-admin-ui` and `organisations-admin-ui` merged

## 1. Shared pickers

- [x] 1.1 Create `apps/orchestrator/src/components/pickers/UserPicker.tsx` — shadcn Combobox over `usePaginatedQuery('/users', { filter: { role } })`; props: `role: Role`, `value: UserId | null`, `onChange`
- [x] 1.2 Create `OrganisationPicker.tsx` — shadcn Combobox over `usePaginatedQuery('/organisations', {})`; renders tree-path label (e.g. `Zas Hospital / Cardiology`)
- [x] 1.3 Create `PractitionerPicker.tsx` — like UserPicker but filters `users` to those with an existing Practitioner row (server-side hint via `?has_practitioner=true` flag added to `GET /users` in this change)
- [x] 1.4 (Backend) Add `?has_practitioner=true|false` filter to `GET /users` (additive)

## 2. List page

- [x] 2.1 Replace placeholder `_auth/admin/practitioner-roles.tsx` with route loading `<PractitionerRoleListPage>`
- [x] 2.2 List composes `<FilterableListPage<PractitionerRoleRead>>` + `<DataTable<PractitionerRoleRead>>`
- [x] 2.3 Columns: Zorgverlener (sticky), Organisatie, Rol (badge), Specialiteit, Primair (badge), Periode (period_start — period_end or `→`), kebab
- [x] 2.4 Filters in `filters` slot: Zorgverlener picker, Organisatie picker, Rol single-select, Open toggle
- [x] 2.5 URL deep-link support: `?practitioner_id=…` and `?organisation_id=…` prefill the corresponding filter

## 3. Dialogs + confirms

- [x] 3.1 `<OpenRoleDialog>` — form: PractitionerPicker, OrganisationPicker, Rol (enum), Specialiteit, is_primary checkbox, period_start (default `now`); submit `POST /practitioner-roles`
- [x] 3.2 `<EditRoleDialog>` — form: Rol, Specialiteit, is_primary; submit `PATCH /practitioner-roles/{id}`
- [x] 3.3 `<CloseRoleConfirm>` — destructive confirm; submit `DELETE /practitioner-roles/{id}` (soft close) — implemented as row action `confirm` slot

## 4. i18n

- [x] 4.1 New namespace `practitioner-roles-admin-ui` in `en/` and `nl/` — nl namespace added; en pending (project ships nl-only resources today)

## 5. Backend filter widening

- [x] 5.1 Add `has_practitioner` boolean filter to `GET /users`; tests pass
- [x] 5.2 Regenerate openapi + typegen (no-op: filter rides dynamic `filter[...]` envelope, not a typed query param)

## 6. Tests

- [x] 6.1 `<PractitionerRoleListPage>` test: deep-link prefill, filter compose into envelope
- [x] 6.2 `<OpenRoleDialog>` test: setting `is_primary` on a practitioner with existing open primary results in one updated list row showing demoted primary after invalidation
- [x] 6.3 `<CloseRoleConfirm>` test: closed row's kebab no longer exposes `Beëindigen`
- [x] 6.4 `<UserPicker>`, `<OrganisationPicker>` snapshot + interaction tests

## 7. Verification

- [x] 7.1 Backend lint / typecheck / test — `moon run backend:lint` ok; `moon run backend:typecheck` 0/0/0; `tests/services/practitioner_role tests/api/routers/practitioner_role tests/api/routers/user` → 44 passed
- [x] 7.2 Orchestrator lint / typecheck / test — `moon run orchestrator:lint` 0 errors (only pre-existing warnings); `moon run orchestrator:typecheck` clean; `moon run orchestrator:test` 333/333 passed

## 8. Docs

- [x] 8.1 Update CHAIN tracker — row 5 advanced to "applied"
- [x] 8.2 `openspec validate practitioner-roles-admin-ui --strict` clean
