## 0. Chain prerequisite

- [ ] 0.1 Verify `practitioner-role-split` is `archived` in `openspec/changes/archive/`; bail if not
- [ ] 0.2 Confirm typed client speaks `Practitioner` / `PractitionerRole` shapes (presence of generated types in `apps/orchestrator/src/api/types.ts`)

## 1. Nav inventory + role gating

- [ ] 1.1 Extend `apps/orchestrator/src/components/nav/sidebar-items.ts` with the hybrid inventory: top `Dashboard | Patiënten | Inbox`, bottom `Beheer { Gebruikers, Organisaties, Affiliaties }`, pinned `Instellingen`
- [ ] 1.2 Add `requiresRole?: Role[]` per inventory entry; `Beheer` group requires `Role.ADMIN`
- [ ] 1.3 Edit `Sidebar.tsx` to filter inventory by `session.user.role` and render the `Beheer` group as a collapsible section
- [ ] 1.4 Update active-route highlighting to match nested admin paths (`/_auth/admin/*`)

## 2. Admin route group

- [ ] 2.1 Create `apps/orchestrator/src/routes/_auth/admin/route.tsx` — layout that gates on `session.user.role === 'admin'`, otherwise navigates to `/_auth/`
- [ ] 2.2 Create placeholder routes under `_auth/admin/`: `users.tsx`, `organisations.tsx`, `practitioner-roles.tsx` — render "Komt binnenkort — wordt geleverd door <spec>"
- [ ] 2.3 Register routes; verify tanstack router type-safety after `pnpm dev`

## 3. Landing / dashboard

- [ ] 3.1 Replace existing `_auth/index.tsx` redirect with route that renders `<DashboardLanding>`
- [ ] 3.2 Create `apps/orchestrator/src/features/dashboard/DashboardLanding.tsx` with KPI tiles: Open care teams, Patients in your reach, Recent assignments, plus four quick-link cards (Patiënten, Beheer-Gebruikers, Beheer-Organisaties, Beheer-Affiliaties)
- [ ] 3.3 Wire KPI tiles to existing list endpoints (`page_size=1` to fetch `total`); use `<Suspense>` with skeleton fallback; render em-dash on error
- [ ] 3.4 Admin-only quick-link cards: hide non-admin links to admin surfaces

## 4. Shared filterable list scaffolding

- [ ] 4.1 Create `apps/orchestrator/src/components/list/FilterableListPage.tsx` exporting `<FilterableListPage<T>>` with named slots: `title`, `description`, `primaryAction`, `filters`, `table`, `emptyState`
- [ ] 4.2 Type signature: generic `<T>` is for parity with the `<DataTable<T>>` that consumers compose inside; the scaffolding itself does not own data
- [ ] 4.3 Layout: title row + description, secondary row with filter chips + primary CTA right-aligned, then `table` slot, then optional `emptyState` slot used when `table` reports empty
- [ ] 4.4 Refactor `_auth/patients/index.tsx` to compose `<FilterableListPage>` around the existing `<DataTable<PatientRead>>`; behaviour MUST be byte-identical to today (URL keys, default sort, row click, kebab actions)

## 5. i18n

- [ ] 5.1 Add namespaces `caregiver-shell` (nav labels, Beheer group label, admin-only badge) and `dashboard` (KPI labels, quick-link copy) to `apps/orchestrator/src/i18n/en/` and `nl/`
- [ ] 5.2 Update i18n config to register the new namespaces (`i18n.ts`)
- [ ] 5.3 Ensure no Dutch strings leak outside `t()` (lint via existing eslint rule)

## 6. Tests

- [ ] 6.1 `apps/orchestrator/src/components/nav/__tests__/Sidebar.test.tsx`: caregiver session does NOT render `Beheer` group; admin session does
- [ ] 6.2 `apps/orchestrator/src/routes/_auth/admin/__tests__/route.test.tsx`: caregiver hitting `/_auth/admin/users` is redirected to `/_auth/`
- [ ] 6.3 `apps/orchestrator/src/features/dashboard/__tests__/DashboardLanding.test.tsx`: tile counts derive from `Page.total`; error path renders em-dash
- [ ] 6.4 `apps/orchestrator/src/components/list/__tests__/FilterableListPage.test.tsx`: slots compose; empty-state slot renders only when table reports empty
- [ ] 6.5 `apps/orchestrator/src/routes/_auth/patients/__tests__/index.test.tsx` (regression): URL state, default sort, row click, kebab actions unchanged from pre-refactor

## 7. Verification

- [ ] 7.1 `moon run orchestrator:lint`
- [ ] 7.2 `moon run orchestrator:typecheck`
- [ ] 7.3 `moon run orchestrator:test`
- [ ] 7.4 `moon run orchestrator:build` — bundle size should not grow more than 5% vs main

## 8. Docs + follow-ups

- [ ] 8.1 Update `openspec/changes/CHAIN-orchestrator-admin-ux.md`: mark `caregiver-shell` `applied` after merge
- [ ] 8.2 Open follow-up: real Inbox surface — BL-064
- [ ] 8.3 `openspec validate caregiver-shell --strict` clean
