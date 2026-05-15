**Tier**: [poc]

## Why

PoC features F4 (patients overview), F6 (task inbox), F2 (dashboard drill-downs), and F8 (admin user list) all render lists that need pagination, filtering (eq/in + ranges + contains + not), search, ordering, multi-select with bulk actions, expandable rows, per-row actions, and (for task-like surfaces) sub-2-second freshness. Without a shared base, every feature will reinvent its own envelope, query parser, table component, and refresh model — and we will end up polling the backend to death.

Establish the shared base once: a typed backend list contract + a reusable `DataTable<T>` + a Postgres-LISTEN/NOTIFY → SSE → TanStack Query invalidation channel that lets every list feel live. The per-feature changes (BL-035..BL-040) plug in by declaring allow-lists and column definitions.

## What Changes

**Backend — list-query base**

- Add typed `ListQuery` schema (page, page_size, q, order_by, order, filters) parsed from query string via a FastAPI dependency. Bracket-keyed filters with per-operator suffix: `filter[<field>]=v` (eq/in), `filter[<field>][gte]=`, `filter[<field>][lte]=`, `filter[<field>][contains]=`, `filter[<field>][not]=`.
- Add generic `Page[T]` response envelope (`items`, `page`, `page_size`, `total`, `total_pages`).
- Add `BaseListRepository[T]` extending `BaseRepository[T]`. Class-level allow-lists declare what is sortable, filterable, and which operators each field accepts. Soft-delete + tenant scoping automatic. `count(*) OVER ()` for single-round-trip total.

**Backend — realtime invalidation**

- Add SSE endpoint `GET /events` (cookie-auth, tenant-scoped) that streams JSON invalidation messages `{resource, action, id?}` to subscribed clients.
- Add in-process pub/sub (`asyncio.Queue` per tenant) consumed by the SSE endpoint. Single-pod PoC scope; multi-pod broadcaster swap-in tracked as `[mvp]` backlog.
- Add SQLAlchemy session-flush hook that, after a successful transaction, emits one invalidation message per resource touched in that transaction.

**Backend — bulk action shape**

- Add shared `BulkResult` schema under `apps/backend/app/schemas/_bulk/`: `{succeeded: list[UUID], failed: list[{id, code, message}]}`. Every bulk endpoint follows `POST /<resource>/<action> { ids: UUID[] }` returning `BulkResult`.

**Orchestrator — datatable component**

- Add `Table` to closed shadcn ui set (`src/components/ui/table.tsx`).
- Add `DataTable<T>` composite at `src/components/data-table/`:
  - Compound toolbar slots: `Toolbar.Search`, `Toolbar.Filters`, `Toolbar.Actions`.
  - Comfortable density only (no toggle).
  - Sortable headers (single column), filter controls (select / multi / date range / text contains), debounced search (300ms).
  - Pagination footer (previous/next + page indicator + page-size selector).
  - **Opt-in per instance**:
    - `onRowClick` → row navigation.
    - `rowActions` ColumnDef → trailing actions menu (DropdownMenu per row).
    - `selectable` → checkbox column + sticky-bottom `BulkActionBar` slide-up bar + `onSelectionChange`. Internal selection state default; controlled via `selectedIds` + `onSelectionChange`.
    - `renderExpandedRow` → chevron column + inline expanded panel. Single row expanded at a time.
    - `realtimeTopic` → subscribes to SSE invalidations for that resource.
  - **Always on**:
    - First column sticky (`position: sticky; left: 0`) so horizontal scroll keeps row identity visible.
    - Native `<table>` semantics via shadcn `Table` primitive (`aria-sort`, `<th scope="col">`, keyboard sort).
- Add `usePaginatedQuery<T>` hook binding openapi-fetch + TanStack Query to `Page<T>` envelope. Canonicalised cache keys.
- Add `useDataTableState` + URL-search-param helper for opt-in route round-trip, and a `useLocalDataTableState` for opt-in localStorage persistence.
- Add `useRealtimeInvalidation()` provider mounted in `app/providers.tsx` (single SSE connection per tab, dispatches `queryClient.invalidateQueries({queryKey: [<resource>]})`).
- Add i18n namespace `data-table` (`nl`).

**Conventions + enforcement**

- Codify list / bulk / realtime / table rules in `apps/backend/AGENTS.md` and `apps/orchestrator/AGENTS.md` (7 rules each).
- Add ESLint rules: block raw `<table>` outside `ui/table.tsx`, block `@tanstack/react-table` import outside `data-table/`, block direct `Table` primitive import outside `data-table/`, flag suspected raw-`useQuery`-on-list-endpoint usage.
- Add backend pytest conformance tests: every `Page[*]` route uses `ListQueryParamsDep` + `GET /<resource>` URL; every bulk endpoint matches `POST /<resource>/<action> { ids } -> BulkResult`; every `TenantOwnedEntity` subclass declares `__realtime_resource__`.

## Capabilities

### New Capabilities

- `list-query-base`: backend shared contract for list endpoints — `ListQuery` input, `Page[T]` envelope, repository helpers with per-operator filter allow-lists, tenant + soft-delete scoping.
- `realtime-invalidation`: backend SSE invalidation channel + frontend provider wiring TanStack Query cache invalidation off resource-level events.
- `datatable`: orchestrator reusable `DataTable<T>` + `usePaginatedQuery` + state helpers, with selection / bulk-bar / row-actions / row-click / expandable-row / realtime-topic opt-ins.

### Modified Capabilities

- `design-system`: extend closed `src/components/ui/` set to include `table`; document `DataTable` composite as the canonical list surface.

## Impact

- **Backend**: new `app/schemas/_list/`, `app/repositories/base.py` (extend), `app/api/deps.py` (`ListQueryParamsDep`), `app/api/routers/events_router.py` (SSE), `app/realtime/` (pub/sub + flush hook). New dependency: `sse-starlette` (FastAPI SSE helper). No existing endpoint changes shape; consumers opt in.
- **Orchestrator**: new `components/ui/table.tsx`, new `components/data-table/`, new `hooks/usePaginatedQuery.ts`, new `hooks/useRealtimeInvalidation.ts`, new `lib/query/paginated.ts`, new i18n namespace. Adds `@tanstack/react-table` dependency.
- **Specs**: new `openspec/specs/list-query-base/spec.md`, new `openspec/specs/datatable/spec.md`, new `openspec/specs/realtime-invalidation/spec.md`, delta on `openspec/specs/design-system/spec.md`.
- **OpenAPI**: `Page` + `ListQuery` reusable schemas appear once any domain consumes them. SSE endpoint excluded from typed client (`openapi-typescript` has no SSE handling — wired manually via `EventSource`).
- **Future backlog**: column visibility / resize / reorder / pin (beyond first-column sticky), card-collapse mobile mode, CSV export, multi-row expand, server-side saved views, cursor pagination, multi-pod SSE broadcaster (Redis/Postgres LISTEN/NOTIFY for cross-pod fan-out at `[mvp]`).
