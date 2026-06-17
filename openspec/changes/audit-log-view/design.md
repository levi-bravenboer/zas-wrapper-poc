## Context

The audit backend is done: `audit_events` is populated (logins, user/patient changes, pathway authoring + access), and `GET /audit-events` is an admin-only, paginated, filterable read API. Nothing renders it. This change adds the minimal read-only admin view — the `feat/audit-logging-view` branch's intent.

The orchestrator has a mature list-page convention (`apps/orchestrator/AGENTS.md` §25): `DataTable<T>` + `usePaginatedQuery` + `useRouteSearchTableState` + `DataTableToolbar` + `DataTablePagination`, wrapped in `FilterableListPage`. Admin pages live under `src/routes/_auth/admin/*`, inherit the admin role guard, and register nav entries in `src/components/layout/navItems.ts`. The reference implementations are `PractitionerRoleListPage` and `UserListPage`. The generated client already exposes `AuditEventRead`, the `/audit-events` path, and `AuditAction` (incl. `published`).

Backend filter/sort surface (fixed, not changing here): filters `resource_type` / `resource_id` / `actor_id` / `action`(eq,in) / `result` / `created_at`(gte,lte); orderable `created_at` only; `Page` default size 25, max 100.

## Goals / Non-Goals

**Goals:**
- A read-only admin page that lists the system-wide audit trail, scannable by Time · Actor · Action · Resource · Result.
- Filter by action / result / resource type / date range; expand a row for the raw payload.
- Reuse the existing list stack verbatim — no new UI primitives, no backend changes.

**Non-Goals:**
- Resource-name resolution / links, actor user-picker, free-text search, realtime, export, retention, tamper-evidence, alerts, keyset pagination, per-type humanised summaries — all `BL-069` `[mvp]`.

## Decisions

### D1 — Pure frontend; reuse the list stack, no backend changes

The page is a thin consumer of `GET /audit-events`. It mirrors `PractitionerRoleListPage` exactly: `useRouteSearchTableState` for URL-persisted page/sort/filter state, `usePaginatedQuery<AuditEventRead>('/audit-events', query)` for data, `DataTable` + `DataTableToolbar` + `DataTablePagination` for UI.

**Why:** the conventions exist and are enforced (ESLint requires `usePaginatedQuery` for lists). Anything the view "wishes" the backend did (search, actor-by-name, realtime) is explicitly deferred, keeping this change frontend-only and small.

### D2 — Columns are display-only projections; only Time sorts

Time (`created_at`, default desc) · Actor (`actor_label` → "(systeem)"/"(anoniem)") · Action (badge) · Resource (`resource_type` + short `resource_id`, "—" when null) · Result (badge; failure tinted). Only the Time header is sortable because `created_at` is the sole backend orderable field; other headers render without sort affordances rather than offering a sort that 400s.

**Why short id, not a resolved name:** the backend returns `resource_type` + UUID, not a name. Resolving would need per-type lookups (extra queries / a resolve endpoint) — `BL-069` territory. The short id keeps the column cheap; the expanded row carries the meaningful detail.

### D3 — Filters map 1:1 onto backend support

Action → multi-select (`in`); Result → select (`eq`); Resource type → select over the emitted types (Pathway / User / Patient) (`eq`); Date range → `created_at` (`gte`/`lte`). No search box (no `searchable_fields` on the audit repo) and no actor picker (backend filters `actor_id` by UUID only; a friendly picker is deferred). `DataTableToolbar` filter defs drive these.

### D4 — Expanded row shows raw JSON

`renderExpandedRow` shows pretty-printed `context` + `changes` and `request_id`. No per-type humanisation in v1 — the column row already conveys who/what/which; the expansion is the "everything else" escape hatch.

**Alternative considered:** a humanised per-type summary column. Deferred — it needs per-type formatters and the user opted for the conventional, convention-matching v1.

### D5 — Standard pagination, offset-based

Reuse `DataTablePagination` (default 25; options 10/25/50). Offset pagination on an append-only, time-desc log can drift by a row under concurrent inserts; with no realtime and modest PoC volume this is acceptable. Keyset/cursor pagination is the documented future fix.

### D6 — Tier split recorded in scope.md

This minimal viewer is `[poc]`; the full `BL-069` dashboard (export, retention, tamper-evidence, alerts) stays `[mvp]`. The change adds a one-line note to `scope.md` (F8 row) so the ledger reflects the split, and updates the `BL-069` note to reference the carved-out viewer.

## Risks / Trade-offs

- **Offset-drift on a live log** → rows can shift by one between page loads under concurrent inserts. Mitigation: accepted for v1 (no realtime, low volume); keyset pagination deferred. Documented in the spec.
- **Unresolved resource ids** → "Pathway ·8a83" is less friendly than a name. Mitigation: the expanded row shows full ids + context; name resolution is `BL-069`.
- **No search/actor filter** → finding "everything user X did" needs the `actor_id` known (deep-linkable via URL). Mitigation: acceptable for v1; the friendly versions are deferred and listed as out-of-scope.
- **Resource-type select drift** → the select lists the currently-emitted types (Pathway/User/Patient); a newly-audited model wouldn't appear until the list is updated. Low risk (audited models change rarely); the date/action/result filters still cover those events.

## Migration Plan

Pure additive frontend. New route + module + locale namespace + one nav entry. No data migration, no backend change, no contract change (client types already regenerated). Rollback = remove the route/nav entry.

## Open Questions

- None blocking. The resource-type filter option list is a small constant to maintain as audited models grow; revisit if/when more models opt into auditing.
