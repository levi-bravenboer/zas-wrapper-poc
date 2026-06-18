**Tier**: [poc]
**Relates to**: `BL-069` (Access audit log + admin dashboard, `[mvp]`) — this change is the minimal `[poc]` slice carved out of it: a read-only viewer onto the audit data we already store. The heavyweight dashboard (export, retention, tamper-evidence, suspicious-action alerts) stays in `BL-069`.
**Builds on**: `backend-audit-event-logging` + `pathway-audit` (the `audit_events` store and `GET /audit-events` read API already exist).

## Why

The backend now records a unified audit trail — logins, user/patient changes, and pathway authoring + access events — but **there is no way to look at it** without querying the database directly. The data is captured and queryable (`GET /audit-events`, admin-only, paginated, filterable), yet invisible to the people who need it. A minimal read-only admin view makes the trail demoable and usable: "show me everything that happened to this pathway / everything Dr. X did / every failed login."

This is the frontend companion to the audit backend work, and the original intent of the `feat/audit-logging-view` branch.

## What Changes

- **New admin-only page** `/_auth/admin/audit-log` (inherits the existing `/_auth/admin/*` role guard), read-only, with a nav entry under "Beheer".
- **A filterable, paginated audit list** built on the standard `DataTable<AuditEventRead>` stack (`usePaginatedQuery` + `useRouteSearchTableState` + `DataTableToolbar` + `DataTablePagination`, wrapped in `FilterableListPage`) — mirroring the existing admin list pages.
- **Columns**: Time · Actor · Action · Resource · Result. Sorted by Time (`created_at` desc) — the only orderable field.
- **Filters**: Action (multi-select), Result, Resource type, and a `created_at` date range — all backed by existing `GET /audit-events` filter support.
- **Expanded-row detail**: click a row to reveal the raw `context` + `changes` JSON and `request_id`.
- **New Dutch i18n namespace** `audit-admin-ui` (title, subtitle, column/filter labels, action + result enum labels).
- **`scope.md` note**: record that the minimal read-only audit viewer is `[poc]` while the full `BL-069` dashboard remains `[mvp]`.

### Out of scope (v1 — these remain the `BL-069` `[mvp]` dashboard)

- Resolving `resource_id` to a human name / linking to the resource (open the pathway/user).
- Actor user-picker filter; free-text search (backend has no `searchable_fields` for audit).
- Realtime / SSE auto-refresh (`audit_events` is not a realtime resource).
- CSV/JSON export, configurable retention, tamper-evidence, near-real-time suspicious-action alerts.
- Keyset/cursor pagination; per-type humanized summary column.

## Capabilities

### New Capabilities
- `audit-log-ui`: the admin audit-log list view — route, admin-only placement + nav, the columns, the filter set, the expanded-row raw detail, pagination behaviour, and the Dutch copy.

### Modified Capabilities
- _None._ This is a pure frontend consumer of the existing `audit-trail-base` read API; no backend requirement changes.

## Impact

- **Pure frontend** (`apps/orchestrator`). No backend changes — no new endpoint, no `searchable_fields`, no realtime emission.
- **New files**: `src/routes/_auth/admin/audit-log.tsx` (route, `// surface-opt-out: app-only`); `src/modules/audit/keys.ts`; `src/modules/audit/components/AuditListPage.tsx`; `src/modules/audit/components/AuditEventDetail.tsx`; `src/lib/i18n/locales/nl/audit-admin-ui.json`.
- **Edited files**: `src/components/layout/navItems.ts` (nav entry under Beheer, admin-gated); nl namespace registration.
- **Consumes** the already-regenerated client types (`components['schemas']['AuditEventRead']`, the `/audit-events` path, `AuditAction` incl. `published`).
- **No conflict** with `GeschiedenisDrawer` (that is pathway-version history, a separate concern).
