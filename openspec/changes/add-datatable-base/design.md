## Context

Multiple PoC features render lists: F4 patients overview, F6 task inbox, F2 dashboard drill-downs, F8 admin user list. Each needs pagination, search across one or more text columns, filtering with mixed operators (equality, range, contains, negation), single-column ordering, multi-select with bulk actions, expandable rows, per-row action menus, and (for task-like surfaces) sub-2-second freshness without each tab hammering the backend on a 2s polling clock.

The backend already has `BaseRepository[T]` tied to `Entity` with soft-delete + tenant scoping via `TenantOwnedEntity`. The orchestrator has shadcn primitives but no `Table` and no data-table composite. TanStack Query is the data layer. Consumer feature changes (BL-035..BL-040) are independent worktrees — this base lands once, every consumer adopts it without coordination beyond importing it.

Carried-over constraints:

- Backend list endpoints MUST stay tenant-scoped (the audit hook sets `session.info[SESSION_ACTOR_KEY]`; the list base reads tenant from there).
- Soft-deleted rows MUST be excluded by default, opt-in to include.
- Query strings MUST be stable in `openapi.json` — `openapi-typescript` regenerates the orchestrator's `schema.d.ts`.
- Orchestrator UI primitives live in a closed shadcn set documented in `apps/orchestrator/AGENTS.md`. Extending the set is what makes this an OpenSpec change.
- All user-visible strings come through `t()` (existing `design-system` requirement).
- PoC runs a single backend pod; multi-pod fan-out is a known `[mvp]` migration step.

## Goals / Non-Goals

**Goals:**

- One typed `ListQuery` query-string shape shared by every backend list endpoint, with per-field operator allow-lists enforced at the repository layer.
- One `Page[T]` response envelope: `{ items, page, page_size, total, total_pages }`. Stable across the API.
- One `BaseListRepository[T]` mixin composing the query into a `Select`, applying tenant + soft-delete filters, returning page + total in a single round-trip.
- One `DataTable<T>` composite covering: sort, filter, search, pagination, selection + bulk bar, expandable rows, per-row actions, row-click navigation, sticky first column, realtime topic subscription.
- One `useRealtimeInvalidation()` provider per tab opening a single SSE connection to `GET /events`, dispatching `queryClient.invalidateQueries({queryKey: [<resource>]})` based on resource-level events.
- One backend SSE endpoint streaming `{resource, action, id?}` events scoped to the caller's tenant, fed by a SQLAlchemy after-commit hook + in-process pub/sub.
- Accessibility: keyboard sort, `aria-sort`, focus-visible rings, screen-reader-safe bulk bar.
- `nl` i18n via a `data-table` namespace.

**Non-Goals:**

- Column resizing, drag-to-reorder, column visibility persistence, user-managed pinning — first column is the only sticky column (always on). Park rest as backlog if requested.
- Card-collapse mobile mode. Horizontal scroll + sticky first column is the responsive answer for PoC.
- Row virtualization (not needed at PoC volumes).
- Multi-column ordering — single column `order_by` only.
- CSV / Excel export.
- Multi-row expanded state.
- Server-side saved views / named presets.
- Cursor pagination (offset/page only).
- Cross-pod SSE fan-out (Redis broker or Postgres LISTEN/NOTIFY). PoC is single-pod; backlog the broker swap.
- Per-row WS bidirectional channels, presence, cursors. SSE is one-way invalidation only.

## Decisions

### D1. Offset pagination, not cursor

`?page=&page_size=` returning `Page[T]` with `total` + `total_pages`. Alternatives: cursor (`?after=`) is better for huge datasets, but PoC volume is small and "Page 2 of 14" UX is in the mockups. Cursor can layer in later behind the same component contract.

### D2. `filter[<field>][<op>]=` query-string shape

Filters use bracket-suffixed keys with optional operator suffix:

- `filter[status]=active&filter[status]=pending` → `status in (active, pending)` (no `[op]` = `eq` / `in` based on cardinality)
- `filter[created_at][gte]=2026-01-01&filter[created_at][lte]=2026-12-31`
- `filter[name][contains]=anna`
- `filter[status][not]=archived`

Single parser produces `{field: {op: values[]}}`. Per-field operator allow-lists on the repository drop unsupported combinations with 422. Alternative considered: typed JSON filter body via `GET` with body (non-standard, breaks caching, breaks OpenAPI). Bracket-string keeps GET semantics intact + readable URLs.

### D3. Per-repository operator allow-lists

`BaseListRepository[T]` declares: `orderable_fields: frozenset[str]`, `filterable_fields: dict[str, frozenset[Operator]]`, `searchable_fields: tuple[InstrumentedAttribute, ...]`. The dep validates ops against the allow-list before issuing SQL. Alternative: model introspection — too permissive, leaks columns + accidental indexes-misses. Trade: one explicit dict per repository; small cost, big safety win.

### D4. `?q=` is global search across `searchable_fields`; `filter[<field>][contains]=` is per-column text filter

Both produce `ILIKE` clauses but at different scopes. `q` ORs across all searchable columns (toolbar search box). `contains` is column-scoped (per-column toolbar filter or text-column header filter). Different UX, different SQL. Document `searchable_fields` MUST be indexed (trigram or btree-lower) at `[mvp]`; PoC ignores the index cost.

### D5. `total` via `count(*) OVER ()` window

One SQL statement returns items + total. Alternative: two statements — doubles latency. Window-function count is standard in SQLAlchemy patterns + matches HiX-style endpoints. Escape hatch (`getApproximateTotal()`) flagged for later if a hot table needs it.

### D6. `Page[T]` is a generic Pydantic model under `app/schemas/_list/page.py`

`schemas/_list/` is an underscore-prefixed module so it sits alongside per-domain folders without claiming a domain name. `Page[T]` uses `Generic[T]` so OpenAPI emits `Page_Patient_`, `Page_Task_`, etc. — `openapi-typescript` resolves these cleanly.

### D7. Orchestrator: TanStack Table v8 internally, our own column API externally

`DataTable<T>` consumers use our `ColumnDef<T>` (typed `sortKey`, `filterKey`, `filterType`, optional `priority` for mobile collapse later, optional `sticky` — only first column honored in PoC). Internals delegate to `@tanstack/react-table` for row model. Dep cost: ~14KB gzipped. Alternative: hand-rolled — saves a dep, reinvents column model + sort/filter state machines. Not worth it.

### D8. `usePaginatedQuery` derives keys from `(path, canonicalQuery)`

Cache hits for identical queries regardless of object identity. `canonicalQuery` sorts `filters` keys + sorts values within each operator. `createQueryKeys` helper extended with `paginated(path, query)` so domain modules can still expose `patientsKeys.list(query)` if they want module-level key surface.

### D9. Closed shadcn ui set extension

Add `Table` to the closed set. `DataTable<T>` is NOT in `components/ui/` — it lives at `src/components/data-table/` as a composite, so the shadcn layer stays untouched.

### D10. State persistence is opt-in per route, via two helpers

- `useRouteSearchTableState(searchSchema)` round-trips state through TanStack Router search params — for routes that want shareable URLs.
- `useLocalTableState(tableId)` round-trips state through `localStorage` keyed by `tableId` — for "remember my last filters" without polluting URLs.
- Default (uncontrolled mode) keeps state in component-internal `useState`.

DataTable accepts `state` + `onStateChange` and is agnostic to where state lives. Helpers are thin adapters.

### D11. Debounced search lives in the UI, not the data layer

`Toolbar.Search` debounces 300ms before emitting state changes. `usePaginatedQuery` treats `q` as just another field. Hook stays reusable for non-table contexts.

### D12. Loading composition reuses existing state surfaces

Loading: `Skeleton` (`src/components/states/Skeleton.tsx`). Refetch with data: `RefetchOverlay`. Error: `ErrorState`. Empty: `EmptyState`. Reuse over rebuild.

### D13. Realtime invalidation: SSE + Postgres-flush-hook + in-process pub/sub

Architecture:

1. **Emit side**: a SQLAlchemy `after_flush_postexec` hook collects `(resource, action, id)` from `session.new | session.dirty | session.deleted` (mapped via a per-model `__realtime_resource__` class attr or default = table name). After the request's transaction commits (request-scoped session in `app.db.engine`), the hook publishes events to an in-process pub/sub keyed by `tenant_id`.
2. **Pub/sub**: `app/realtime/pubsub.py` exposes `publish(tenant_id, event)` and `subscribe(tenant_id) -> AsyncIterator[event]`. Implementation: `defaultdict[UUID, set[asyncio.Queue]]`. New subscribers get a fresh queue; publish iterates subscribers and `put_nowait` (drop policy on full queue to avoid head-of-line block — log + metric).
3. **SSE endpoint**: `GET /events` (cookie-auth, returns `text/event-stream`) opens a subscription for the caller's tenant, writes each event as `data: {json}\n\n`, sends a `ping` comment every 15s to keep proxies happy. Disconnect via client close or 30-min idle timeout; client auto-reconnects (EventSource semantics).
4. **Frontend**: `useRealtimeInvalidation()` mounted once in `app/providers.tsx` opens one `EventSource('/events', { withCredentials: true })`. On message, parses `{resource, action, id?}` and calls `queryClient.invalidateQueries({queryKey: [resource], exact: false})`. Reconnect retry handled by `EventSource`.
5. **DataTable opt-in**: a table marks `realtimeTopic="tasks"` purely as documentation — the actual subscription is provider-level, not per-table. The prop wires a lint-time check (TypeScript const) that the resource name matches the query key prefix used by the table's hook. Future fine-grained subscriptions can layer in without changing the contract.

Alternatives considered:

- **Polling 2s**: simple, scales poorly (N tabs × resources × 0.5 req/s). Falls back well; we keep it as a `refetchInterval` escape hatch when SSE disconnects beyond N retries.
- **WebSocket**: bidirectional, overkill for invalidation. SSE is HTTP/2-multiplexed, cookie-auth, native reconnect.
- **Postgres LISTEN/NOTIFY → SSE**: needed for multi-pod fan-out at `[mvp]`. In-process pub/sub is correct for single-pod PoC; LISTEN/NOTIFY adds infra cost we don't need yet. Architected so swap-in is a `pubsub.py` replacement; consumers (SSE endpoint + flush hook) keep their interfaces.
- **Server pushes full row payload**: leaks auth (broadcaster sees rows it shouldn't), bloats events, encourages client to skip refetch and lose tenant filter consistency. We push invalidation signals only.

Granularity: resource-level (`{resource: "tasks"}`). Client invalidates `['tasks', ...]` — TanStack Query refetches affected lists. Per-id invalidation is an optimisation; resource-level is fine for PoC volumes. Detail queries (`['tasks', id]`) invalidate too (same prefix), which is desired.

### D14. SSE auth + tenant scoping

`GET /events` requires the existing session cookie (same `SessionDep` as REST routes). Tenant comes from `session.info[SESSION_ACTOR_KEY].tenant_id`. The endpoint reads tenant ONCE on connect; subscription is bound to that tenant for the connection lifetime. Tenant change (re-login as different tenant) requires reconnect — frontend triggers reconnect on auth state change.

### D15. Flush hook publishes after commit, not after flush

`after_flush` fires before commit; if we publish there and the transaction rolls back, we've leaked a phantom invalidation. Use `after_commit` event on the AsyncSession's underlying SQLAlchemy session. Publish from a list of pending events collected during `before_flush`. Trade: slight added complexity in the hook; correctness wins.

### D16. DataTable selection model

Selection is internal state by default with `onSelectionChange` callback. Controlled mode via `selectedIds: Set<string>` + `onSelectionChange`. Selection clears automatically when the underlying `data` identity changes (e.g., filter changes drop rows the user had selected). Bulk bar renders via `<DataTable.BulkBar>` compound slot — consumer fills with action buttons; component renders the sticky bottom container + count + cancel.

### D17. Sticky first column is always on

`position: sticky; left: 0; z-index: 1` on the first `<th>` and first `<td>` of every row. Box-shadow inset-right to hint scroll affordance. Alternative: opt-in via `stickyFirstColumn` prop — chose always-on for consistency (every table benefits, no surprises). Bulk-select checkbox column, when present, IS the first column and gets the sticky behaviour automatically.

### D18. Expandable rows: single-row, opt-in

`renderExpandedRow?: (row: T) => ReactNode`. When provided, DataTable renders a leading chevron column. State: `expandedRowId: string | null` (internal, no controlled mode for now). Expanding row B collapses row A. Keyboard: `Enter` / `Space` on chevron toggles. Aria: `<button aria-expanded>` + `<tr role="row">` for the expanded panel.

### D19. Row actions column

`rowActions?: (row: T) => DataTableRowAction[]` where each `DataTableRowAction = { label, icon?, onClick, destructive?, disabled? }`. DataTable renders a trailing column with a `DropdownMenu` per row. Consumer doesn't touch DOM. Destructive actions get the existing destructive styling.

### D20. Row-click navigation

`onRowClick?: (row: T) => void`. When provided, rows render with `role="button"`, `tabindex={0}`, pointer cursor; click + `Enter` + `Space` invoke. When NOT provided, rows are plain non-interactive. Click on a `<button>` inside the row (row actions menu, bulk checkbox, expand chevron) MUST stop propagation so they don't double-fire navigation.

## Risks / Trade-offs

- **Performance: `count(*) OVER ()` on soft-delete + tenant-filtered query scans the page.** → PoC volume tiny. Add `getApproximateTotal()` escape later if needed.
- **Filter expressiveness: only `eq`, `in`, `gte`, `lte`, `contains`, `not`.** → Covers PoC UX. More operators (`between`, `is_null`, `starts_with`) at `[mvp]` if a domain needs them.
- **SSE single-pod assumption.** → Multi-pod = events emitted on pod A never reach pod B subscribers. Backlog the LISTEN/NOTIFY swap; until then, deployment MUST stay single-pod. Document in `apps/backend/AGENTS.md`.
- **SSE proxy compatibility.** → Some corporate proxies buffer SSE; `X-Accel-Buffering: no` header set; `ping` comment every 15s. If ZAS network buffers SSE entirely, fallback path = TanStack Query stale-on-focus + manual refresh button.
- **Tab-per-user resource cost.** → One SSE connection per tab. 10 tabs × 100 users = 1000 long-lived connections per pod. Uvicorn handles this with `asyncio`. Add metric `realtime_sse_active_subscribers` for observability.
- **Phantom invalidations on rollback.** → Mitigated by publishing in `after_commit`, not `after_flush`.
- **Closed-set creep.** → Adding `Table` is a precedent. `design-system` spec requires an OpenSpec change for extensions — this IS that change. Keep the closed-set list short.
- **TanStack Table dep bloat.** → ~14KB gzipped, tree-shakes well. Drop-in replacement risk low given wrapper.
- **Tenant scoping leak via subclass override.** → `list_page()` builds the root `Select` itself; subclasses extend via `_extra_filters()` callback. Integration test enforces cross-tenant isolation.
- **Selection drift after refetch.** → If realtime invalidates and rows the user selected disappear, the selection set still contains their ids; bulk action fires against non-existent rows. Frontend reconciles: on data change, drop selected ids not in the new page. Surface count change in the bulk bar.
- **Bulk bar covers content.** → Sticky bottom 56px tall. Add `padding-bottom` to the page when bar is visible; document in spec.

## Migration Plan

Greenfield — no existing list endpoint or realtime channel to migrate. Land in this order:

1. **Backend schemas + dep + repo base** (sections 1–3 of `tasks.md`). Internal-only; no public surface change.
2. **Backend integration tests** against throwaway `_DemoModel` (section 4).
3. **Backend SSE infrastructure**: `app/realtime/pubsub.py`, `app/realtime/flush_hook.py`, `app/api/routers/events_router.py`. Wire the flush hook to the request-scoped session in `app/db/engine.py`.
4. **Backend SSE integration tests**: subscribe, mutate, assert event delivery; tenant isolation; rollback does not emit.
5. **OpenAPI export sanity-check**.
6. **Orchestrator `Table` primitive** (shadcn add) + closed-set update.
7. **Orchestrator data-table component + toolbar + pagination + selection + expandable + row-actions** (sections 9–12 of `tasks.md`).
8. **Orchestrator `usePaginatedQuery` + state helpers + i18n namespace**.
9. **Orchestrator `useRealtimeInvalidation` provider** mounted in `app/providers.tsx`. Uses `EventSource('/events', { withCredentials: true })`.
10. **Orchestrator integration smoke test**: MSW mocked SSE endpoint feeding invalidation events; assert the table refetches.
11. **Update `apps/orchestrator/AGENTS.md` closed-set list + `apps/backend/AGENTS.md` list-endpoint + realtime conventions**.

Rollback: base is unused until a consumer opts in. SSE endpoint can be disabled by feature-flag if it misbehaves; TanStack Query still works under stale-while-revalidate.

## Open Questions

- `Page[T].items` vs `data` vs `results`? Picked `items`.
- `?include_deleted=1` for admin? Default NO; revisit at `[mvp]`.
- `order_by=name&order=asc` vs signed `order=-name`? Picked two-param (clearer in OpenAPI).
- SSE event payload schema versioning? PoC uses `{resource, action, id?}` flat. If we add per-row deltas later, gate behind a `v` field.
- Should `useRealtimeInvalidation` be globally on or opt-in per route? Picked globally on — single provider mount, free invalidations everywhere. Tables that DON'T want realtime simply don't have matching query keys to invalidate. Cost is one SSE connection per tab regardless.
