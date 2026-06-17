## 1. Module scaffolding

- [x] 1.1 Create `src/modules/audit/keys.ts` exporting `AUDIT_EVENTS_LIST_PATH = '/audit-events'`.
- [x] 1.2 Add the `AuditEventRead` type alias from the generated client (`components['schemas']['AuditEventRead']`) for use across the module.

## 2. i18n

- [x] 2.1 Add `src/lib/i18n/locales/nl/audit-admin-ui.json` with: `list` (title "Auditlog", subtitle, empty), `column` (created_at/actor/action/resource/result), `filter` (action/result/resource_type/created_at), `enum.action` (created/updated/deleted/login/published) and `enum.result` (success/failure), and `detail` (request_id/context/changes) labels.
- [x] 2.2 Register the `audit-admin-ui` namespace wherever nl namespaces are wired up (follow `users-admin-ui` / `practitioner-roles-admin-ui` registration).

## 3. List page

- [x] 3.1 Create `src/modules/audit/components/AuditListPage.tsx` mirroring `PractitionerRoleListPage`: `useRouteSearchTableState` + `usePaginatedQuery<AuditEventRead>(AUDIT_EVENTS_LIST_PATH, query)`, wrapped in `FilterableListPage`.
- [x] 3.2 Define columns (`defineColumn<AuditEventRead>`): Time (`created_at`, `sortKey: 'created_at'`, sticky, date+time formatted) | Actor (`actor_label` ?? parenthesised `actor_type`) | Action (badge, `t('enum.action.<action>')`) | Resource (`resource_type` + short `resource_id`; "—" when null) | Result (badge, failure-tinted, `t('enum.result.<result>')`).
- [x] 3.3 Default sort to `created_at` desc; do NOT set `sortKey` on action/resource/result columns (backend orderable is `created_at` only).
- [x] 3.4 Define `DataTableFilter` defs: Action (`type: 'multi'` → backend `in`), Result (`select`), Resource type (`select`: Pathway/User/Patient), Date range (`date-range` on `created_at`). No search box, no actor picker.
- [x] 3.5 Wire `DataTableToolbar` (filters only, no `searchPlaceholder`), `DataTable` (`getRowId={r => r.id}`, `selectable={false}`, `renderExpandedRow`), and `DataTablePagination` (default 25; options 10/25/50).
- [x] 3.6 Handle loading / empty / error states via the standard `DataTable` props.

## 4. Detail row

- [x] 4.1 Create `src/modules/audit/components/AuditEventDetail.tsx`: renders `request_id`, full `resource_type`/`resource_id`, and pretty-printed raw `context` + `changes` JSON in `<pre>` blocks.
- [x] 4.2 Pass it to `DataTable` via `renderExpandedRow={(row) => <AuditEventDetail event={row} />}`.

## 5. Route + nav

- [x] 5.1 Create `src/routes/_auth/admin/audit-log.tsx` with the `// surface-opt-out: app-only` marker, `staticData: { breadcrumb: 'Auditlog' }`, rendering `AuditListPage`. (Regenerate the route tree if the project requires it.)
- [x] 5.2 Add an "Auditlog" entry to `src/components/layout/navItems.ts` under the "Beheer" group, admin-gated, with an appropriate icon and order after practitioner-roles.

## 6. scope.md + backlog note

- [x] 6.1 Add a one-line note to `openspec/scope.md` (F8 Admin row / PoC column) that a minimal read-only audit viewer is `[poc]` while the full audit dashboard stays `[mvp]` (`BL-069`).
- [x] 6.2 Update the `BL-069` note in `openspec/backlog.md` to record that the minimal read-only viewer was carved out as `[poc]` via `audit-log-view` (keep the dashboard scope parked).

## 7. Tests + verification

- [x] 7.1 Add a component test for `AuditListPage` (mirror the existing admin list-page test pattern): renders rows from a mocked `GET /audit-events`, shows the action/result badges, expands a row to reveal context JSON, and applies an action filter.
- [ ] 7.2 Run `/verify` for the orchestrator (lint + typecheck + tests) and confirm green. (Note: the branch has pre-existing, unrelated orchestrator typecheck failures in tasks-routing/charts; confirm this change introduces no new errors.)
- [ ] 7.3 Launch the app and confirm the audit log renders for an admin: rows visible, a filter narrows results, a row expands to raw JSON, pagination works.
