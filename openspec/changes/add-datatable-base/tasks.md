## 1. Backend — `ListQuery` + `Page[T]` schemas

- [x] 1.1 Create `apps/backend/app/schemas/_list/__init__.py`
- [x] 1.2 Add `apps/backend/app/schemas/_list/list_query.py` with `Operator` literal + `ListQuery` Pydantic model (page, page_size, q, order_by, order, filters)
- [x] 1.3 Validation: `page >= 1`, `page_size` clamp to `[1, max_page_size]`, `order` literal, whitespace-only `q` → `None`
- [x] 1.4 Add `apps/backend/app/schemas/_list/page.py` with generic `Page[T]` + `total_pages` field
- [x] 1.5 Unit tests for `ListQuery` validation edge cases (`tests/schemas/_list/test_list_query.py`)
- [x] 1.6 Unit tests for `Page[T]` envelope shape (`tests/schemas/_list/test_page.py`)

## 2. Backend — `ListQueryParamsDep` FastAPI dependency

- [x] 2.1 Add `list_query_params` factory in `apps/backend/app/api/deps.py` returning `Annotated[ListQuery, Depends(...)]`
- [x] 2.2 Implement bracket-key parsing of `filter[<field>]=v`, `filter[<field>][<op>]=v` via `Request.query_params.multi_items()`
- [x] 2.3 Distinguish `eq` (single value) vs `in` (multi value) when no operator suffix is given
- [x] 2.4 Reject unknown operators with HTTP 422
- [x] 2.5 Reject duplicate `order_by` with HTTP 422
- [x] 2.6 Allow per-route override of `default_page_size` / `max_page_size`
- [x] 2.7 Integration test on a dummy route under `tests/api/_list/test_list_query_params.py` (every operator + invalid combos)
- [ ] 2.8 Verify OpenAPI parameter docs reflect per-route overrides

## 3. Backend — `BaseListRepository[T]` mixin

- [x] 3.1 Extend `apps/backend/app/repositories/base.py` with `BaseListRepository[T]` subclassing `BaseRepository[T]`
- [x] 3.2 Class attrs: `orderable_fields: frozenset[str]`, `filterable_fields: dict[str, frozenset[Operator]]`, `searchable_fields: tuple[InstrumentedAttribute, ...]`
- [x] 3.3 Implement `list_page(query: ListQuery) -> Page[T]` using `select(...).add_columns(func.count().over().label("__total"))`
- [x] 3.4 Apply soft-delete filter (`deleted_at IS NULL`) automatically
- [x] 3.5 Apply tenant filter automatically when model is `TenantOwnedEntity` subclass (read tenant id from `session.info[SESSION_ACTOR_KEY]`)
- [x] 3.6 Operator translators: `eq`/`in` → `IN`, `gte`/`lte` → comparison, `contains` → `lower(col) LIKE %%q%%`, `not` → `NOT IN`
- [x] 3.7 Per-field operator allow-list validation at the dep layer + defensive assert in repository
- [x] 3.8 Apply `q` via `OR(*[func.lower(col).ilike(f"%{q.lower()}%") for col in searchable_fields])`
- [x] 3.9 Apply `order_by` + `order` with NULLS LAST default
- [x] 3.10 Apply LIMIT / OFFSET from `page` + `page_size`
- [x] 3.11 Compute `total_pages = ceil(total / page_size)` (0 when total == 0)
- [x] 3.12 Block subclass override of root `Select` — expose `_extra_filters(query) -> Sequence[ColumnElement]` extension point

## 4. Backend — list-base integration tests

- [x] 4.1 Add `tests/repositories/_list/conftest.py` with a `_DemoModel` (`TenantOwnedEntity` subclass) + Alembic-managed fixture migration in `tests/_fixtures/`
- [x] 4.2 Test: pagination boundaries (page=0 rejected, oversize page returns empty items + correct total)
- [x] 4.3 Test: soft-delete filter active by default
- [x] 4.4 Test: tenant isolation (rows from another tenant never returned)
- [x] 4.5 Test: `order_by` outside allow-list rejected (HTTP 422 via dep)
- [x] 4.6 Test: filter field outside allow-list rejected (HTTP 422)
- [x] 4.7 Test: filter operator outside per-field allow-list rejected (HTTP 422)
- [x] 4.8 Test: each operator (`eq`, `in`, `gte`, `lte`, `contains`, `not`) produces the correct SQL
- [x] 4.9 Test: `q` ILIKE OR across multiple searchable columns
- [x] 4.10 Test: SQL log captures exactly one statement per `list_page` call (window-function count)

## 5. Backend — realtime: pub/sub + flush hook

- [x] 5.1 Add dependency `sse-starlette` to `apps/backend/pyproject.toml` (uv add)
- [x] 5.2 Create `apps/backend/app/realtime/__init__.py`
- [x] 5.3 Add `apps/backend/app/realtime/events.py` with `RealtimeEvent` Pydantic model (`resource`, `action: Literal["upsert","delete"]`, `id: str | None`, `v: int = 1`)
- [x] 5.4 Add `apps/backend/app/realtime/pubsub.py`: `publish(tenant_id, event)`, `subscribe(tenant_id) -> AsyncIterator[event]`, in-memory `defaultdict[UUID, set[Queue]]`, drop-on-full policy + counter, metrics (`active_subscribers` gauge, `published_events_total` counter, `dropped_events_total` counter)
- [x] 5.5 Add `apps/backend/app/realtime/flush_hook.py`:
  - `before_flush` collects `(resource, action, id, tenant_id)` from `session.new | session.dirty | session.deleted`
  - Soft-delete (`deleted_at` set in this flush) → `action="upsert"`; hard delete → `action="delete"`
  - `after_commit` publishes collected events
  - `after_rollback` discards them
- [x] 5.6 Wire the hook in `apps/backend/app/db/engine.py` for the request-scoped session
- [x] 5.7 Class attr `__realtime_resource__: str | None = None` on `Entity` base; per-model override sets the resource name. Models with `None` produce no events.
- [x] 5.8 Unit tests: `pubsub` fan-out + tenant isolation + drop policy (`tests/realtime/test_pubsub.py`)
- [x] 5.9 Integration tests with the `_DemoModel`: commit emits, rollback does not, soft-delete vs hard-delete actions, multi-row commit fans out per row (`tests/realtime/test_flush_hook.py`)
- [x] 5.10 Test: tenant id of the row drives fan-out, NOT the actor's tenant (admin cross-tenant write)

## 6. Backend — `/events` SSE router

- [x] 6.1 Add `apps/backend/app/api/routers/events_router.py` with `GET /events` mounted under the existing API router
- [x] 6.2 Cookie-auth via existing `SessionDep`; HTTP 401 when no session
- [x] 6.3 Stream via `sse-starlette.EventSourceResponse`, scope to `actor.tenant_id`
- [x] 6.4 Send `: keep-alive` comment every 15s
- [x] 6.5 Response headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Connection: keep-alive`
- [x] 6.6 Idle disconnect after 30 min (configurable)
- [x] 6.7 Tests: 401 without session, message format `{resource, action, id, v}`, tenant isolation, keep-alive presence, headers correct (`tests/api/events/test_events_router.py`)

## 7. Backend — verification

- [x] 7.1 `moon run backend:lint`
- [x] 7.2 `moon run backend:format`
- [x] 7.3 `moon run backend:typecheck`
- [x] 7.4 `moon run backend:test -- tests/schemas/_list/ tests/api/_list/ tests/repositories/_list/ tests/realtime/ tests/api/events/`
- [x] 7.5 `moon run backend:openapi` and confirm `Page_DemoModel_` schema renders; `/events` excluded from typed client

## 8. Backend — docs

- [x] 8.1 Add "List endpoints" subsection to `apps/backend/AGENTS.md` documenting `ListQuery` + `Page[T]` + `BaseListRepository` usage
- [x] 8.2 Add "Realtime" subsection to `apps/backend/AGENTS.md`: single-pod invariant, `__realtime_resource__`, after-commit semantics, multi-pod backlog
- [x] 8.3 Add backlog entry `BL-NNN — Multi-pod realtime broadcaster` (tier `[mvp]`)

## 9. Orchestrator — `Table` shadcn primitive

- [x] 9.1 Add `@tanstack/react-table` to `apps/orchestrator/package.json` dependencies
- [x] 9.2 Run `npx shadcn add table` (or copy manually) → `apps/orchestrator/src/components/ui/table.tsx`
- [x] 9.3 Update `apps/orchestrator/components.json` if needed
- [x] 9.4 Update closed-set list in `apps/orchestrator/AGENTS.md` to include `Table`
- [x] 9.5 Snapshot / a11y test for `Table` primitive (semantic `<table>`, `<th scope="col">`)

## 10. Orchestrator — `data-table` i18n namespace

- [x] 10.1 Create `apps/orchestrator/src/lib/i18n/locales/nl/data-table.json` with keys:
  - `empty.title`, `empty.body`
  - `pagination.previous`, `pagination.next`, `pagination.indicator` (`"{{page}} / {{total}}"`), `pagination.pageSize`
  - `toolbar.search.placeholder`, `toolbar.filters.clear`, `toolbar.filters.button`
  - `sort.ariaAscending`, `sort.ariaDescending`, `sort.ariaNone`
  - `bulk.count.one`, `bulk.count.other` (`"{{count}} geselecteerd"`), `bulk.cancel`
  - `expand.toggle`
  - `actions.menu.aria` (per row)
  - `realtime.offline` (warning toast)
- [x] 10.2 Register namespace in `src/lib/i18n/index.ts`
- [x] 10.3 i18n smoke test that every key resolves

## 11. Orchestrator — `usePaginatedQuery` hook + key factory

- [x] 11.1 Add `apps/orchestrator/src/lib/query/paginated.ts` exporting `paginatedQueryKey(path, query)` (canonicalised: sorted filter keys, sorted operator keys, sorted value arrays)
- [x] 11.2 Add `apps/orchestrator/src/hooks/usePaginatedQuery.ts` wrapping `useQuery` + `openapi-fetch` GET, returning `UseQueryResult<Page<T>>`
- [x] 11.3 Type: derive `Page<T>` from `schema.d.ts` (`paths[P]["get"]["responses"]["200"]["content"]["application/json"]`)
- [x] 11.4 Tests: cache-hit equality across reordered filters + reference-different-equal queries
- [x] 11.5 Tests: cache-miss when any field differs

## 12. Orchestrator — realtime invalidation provider

- [x] 12.1 Add `apps/orchestrator/src/hooks/useRealtimeInvalidation.ts` opening a single `EventSource('/events', { withCredentials: true })`
- [x] 12.2 On message: parse `RealtimeEvent`, call `queryClient.invalidateQueries({ queryKey: [event.resource], exact: false })`
- [x] 12.3 Reconnect: rely on native `EventSource` retry; track consecutive failures within 60s
- [x] 12.4 5+ failures in 60s → `toastWarning('data-table.realtime.offline')` and ensure `refetchOnWindowFocus` enabled
- [x] 12.5 Close on logout (driven by auth state change)
- [x] 12.6 Mount once in `src/app/providers.tsx`
- [x] 12.7 Tests (MSW + `eventsource` polyfill): single connection, invalidation dispatch, reconnect warning, no connection when logged out

## 13. Orchestrator — `DataTable<T>` core

- [x] 13.1 Create `apps/orchestrator/src/components/data-table/DataTable.tsx` (uncontrolled default, controlled via `state` + `onStateChange`)
- [x] 13.2 Create `apps/orchestrator/src/components/data-table/columns.ts` exporting `ColumnDef<T>` brand + helpers (sortKey, filterKey, optional `sticky`, optional `priority`)
- [x] 13.3 Wire TanStack Table internally (manual pagination + sorting + filtering)
- [x] 13.4 Render sortable `<th>` as nested `<button>` with `aria-sort`, `Enter`/`Space` activation
- [x] 13.5 Single-column sort cycle: `asc` → `desc` → unset
- [x] 13.6 First column auto-sticky (`position: sticky; left: 0`) + scroll-hint shadow
- [x] 13.7 Empty / loading / refetch / error composition (`EmptyState`, `Skeleton`, `RefetchOverlay`, `ErrorState`)
- [x] 13.8 Accessible name via `aria-labelledby` or `<caption>` slot

## 14. Orchestrator — Toolbar compound

- [x] 14.1 `apps/orchestrator/src/components/data-table/DataTableToolbar.tsx` with `Toolbar`, `Toolbar.Search`, `Toolbar.Filters`, `Toolbar.Actions` (compound exports via attached statics)
- [x] 14.2 Fixed visual order regardless of JSX child order (Search left, Filters middle, Actions right)
- [x] 14.3 Search: debounced 300ms → emits `q`
- [x] 14.4 Filters: `select`, `multi`, `date-range`, `text` filter types backed by `DataTableFilter<T>` prop; renders chips; clear-all button
- [x] 14.5 `date-range` emits `{gte, lte}`; `text` emits `{contains}`; `multi` emits `{in}`; `select` emits `{eq}`

## 15. Orchestrator — Pagination

- [x] 15.1 `apps/orchestrator/src/components/data-table/DataTablePagination.tsx`
- [x] 15.2 Previous / next buttons with `aria-disabled` at bounds
- [x] 15.3 Page indicator using i18n key `pagination.indicator`
- [x] 15.4 Page-size selector with `pageSizeOptions` prop (default `[10, 25, 50]`)
- [x] 15.5 Page-size change resets `page` to 1

## 16. Orchestrator — Multi-select + BulkBar

- [x] 16.1 `selectable?: boolean` prop on `DataTable`
- [x] 16.2 Leading checkbox column + header checkbox (selects/deselects current page)
- [x] 16.3 Selection set as `Set<string>`; internal default; `selectedIds` + `onSelectionChange` for controlled mode
- [x] 16.4 Selection persists across page changes
- [x] 16.5 Selection auto-clears when `data` identity changes due to filter/search/sort change
- [x] 16.6 Selection reconciles after realtime refetch (drop ids no longer in result set)
- [x] 16.7 `<DataTable.BulkBar>` compound slot — sticky bottom, slide-up transition, count label, cancel button, consumer children slot
- [x] 16.8 Bar `role="region"` + `aria-live="polite"`
- [x] 16.9 Parent scroll container gets `padding-bottom` while bar visible
- [x] 16.10 Checkbox click stops propagation (no row navigation)

## 17. Orchestrator — Row actions menu

- [x] 17.1 `rowActions?: (row: T) => DataTableRowAction[]` prop
- [x] 17.2 Trailing actions column when prop set; per-row `<DropdownMenu>` from `ui/dropdown-menu`
- [x] 17.3 `DataTableRowAction` shape: `{ label, icon?, onClick, destructive?, disabled? }`
- [x] 17.4 Destructive styling reuses existing variant
- [x] 17.5 Trigger + menu item clicks stop propagation (no row navigation)
- [x] 17.6 Menu item `aria-disabled` when `disabled: true`

## 18. Orchestrator — Row-click navigation

- [x] 18.1 `onRowClick?: (row: T) => void` prop
- [x] 18.2 When set: `role="button"`, `tabIndex={0}`, pointer cursor on `<tr>`
- [x] 18.3 Click + `Enter` + `Space` invoke handler
- [x] 18.4 Propagation stop on nested interactive children (checkbox, actions menu, expand chevron)

## 19. Orchestrator — Expandable rows

- [x] 19.1 `renderExpandedRow?: (row: T) => ReactNode` prop
- [x] 19.2 Leading chevron column with `<button aria-expanded>` per row
- [x] 19.3 Single-row expand state (expanding B collapses A)
- [x] 19.4 Expanded panel rendered as a sibling `<tr><td colspan>` directly below
- [x] 19.5 Keyboard toggle (`Enter`/`Space`)
- [x] 19.6 Chevron click stops propagation (no row navigation)

## 20. Orchestrator — State persistence helpers

- [x] 20.1 `useDataTableState(initial?)` reducer producing `{page, pageSize, q, orderBy, order, filters}`
- [x] 20.2 `useRouteSearchTableState(searchSchema)` round-tripping through TanStack Router search params
- [x] 20.3 `useLocalTableState(tableId, initial?)` round-tripping through `localStorage` with 200ms debounced writes
- [x] 20.4 Type-safe overlap: localStorage fallback for fields not present in URL
- [x] 20.5 Tests for each helper

## 21. Orchestrator — Realtime topic prop wiring

- [x] 21.1 `realtimeTopic?: string` prop on `DataTable` (documentation only — no subscription is opened by the table)
- [x] 21.2 Lint-time check (TypeScript template type) that `realtimeTopic` matches the query-key prefix used by the table's hook
- [x] 21.3 Integration test: emit invalidation via mocked SSE, assert table refetches and overlay appears

## 22. Orchestrator — tests

- [x] 22.1 `DataTable.test.tsx`: header + body render, sticky first column, empty/loading/refetch/error states
- [x] 22.2 `DataTable.sort.test.tsx`: click cycle + `aria-sort` + keyboard
- [x] 22.3 `DataTableToolbar.search.test.tsx`: debounce, clearing
- [x] 22.4 `DataTableToolbar.filters.test.tsx`: select / multi / date-range / text filter behaviour, clear-all
- [x] 22.5 `DataTablePagination.test.tsx`: bounds + page-size reset
- [x] 22.6 `DataTable.selection.test.tsx`: header checkbox, cross-page persistence, selection drift on refetch, BulkBar slide-up + cancel
- [x] 22.7 `DataTable.rowActions.test.tsx`: menu render, disabled, destructive, propagation
- [x] 22.8 `DataTable.rowClick.test.tsx`: click + keyboard, propagation stop on nested controls
- [x] 22.9 `DataTable.expand.test.tsx`: chevron toggle, single-row mode, colspan correctness, keyboard
- [x] 22.10 `usePaginatedQuery.test.tsx`: cache key canonicalisation
- [x] 22.11 `useRealtimeInvalidation.test.tsx`: dispatch on message, reconnect warning, no connection when logged out
- [x] 22.12 End-to-end Vitest integration: MSW backs `/demo` + mocked `/events`; assert sort + filter + search + pagination + selection + realtime-driven refetch work

## 23. Orchestrator — verification

- [x] 23.1 `moon run orchestrator:typecheck`
- [x] 23.2 `moon run orchestrator:lint`
- [x] 23.3 `moon run orchestrator:format`
- [x] 23.4 `moon run orchestrator:test -- src/components/data-table src/hooks/usePaginatedQuery src/hooks/useRealtimeInvalidation src/lib/query`
- [x] 23.5 `moon run orchestrator:build`
- [x] 23.6 Scaffold scratch demo route at `apps/orchestrator/src/routes/_auth/demo/data-table.tsx` with example column defs, MSW handlers for `/demo` list + `/events` SSE in `src/mocks/handlers/demo.ts`, and a working `<DataTable />` composition (toolbar + pagination + bulk bar + expand + row actions). Route lives under `_auth/demo/` prefix so it is reachable only by direct URL and never linked from app nav.
- [x] 23.7 Manual browser smoke against `/demo/data-table`: verify sort, filter, search, pagination, selection + bulk bar, expand, row-click nav, row actions, sticky first column on horizontal scroll, realtime refetch

## 24. Backend AGENTS.md rules (codify list + bulk + realtime conventions)

- [x] 24.1 Add "List endpoints" subsection to `apps/backend/AGENTS.md` with all 7 rules:
  - All list endpoints MUST use `BaseListRepository.list_page` and return `Page[T]`. No bespoke pagination.
  - All list endpoints MUST consume `ListQueryParamsDep`. No manual query parsing.
  - Repositories MUST declare `orderable_fields`, `filterable_fields`, `searchable_fields`, and `default_order` explicitly. No model introspection.
  - Bulk endpoints follow `POST /<resource>/<action> { ids: UUID[] }` returning `BulkResult` (`{succeeded: UUID[], failed: [{id, code, message}]}`).
  - Every model that may surface in a list endpoint MUST declare `__realtime_resource__: str | None` explicitly (no defaults). `None` means "do not publish".
  - Introducing a new filter operator requires an OpenSpec change extending `list-query-base`.
  - List route URL: `GET /<resource>` (plural). Detail: `GET /<resource>/{id}`. No `/list` suffix.
- [x] 24.2 Add code example block showing a minimal compliant list endpoint (route + dep + repo + schema)
- [x] 24.3 Add "Realtime" subsection: single-pod invariant, `__realtime_resource__` examples, after-commit semantics, multi-pod backlog reference

## 25. Orchestrator AGENTS.md rules (codify table + state + realtime conventions)

- [x] 25.1 Update closed-set list in `apps/orchestrator/AGENTS.md` to include `Table` (also touched in 9.4 — keep consistent)
- [x] 25.2 Add "Lists & DataTable" subsection with all 7 rules:
  - All overviews MUST use `DataTable<T>`. No ad-hoc `<table>` outside `src/components/ui/table.tsx`. Enforced by ESLint.
  - All paginated lists MUST go through `usePaginatedQuery`. No hand-rolled TanStack Query wrappers around list endpoints.
  - Column definitions, filter definitions, and row-action definitions live at `src/modules/<name>/components/<Name>Columns.tsx`. Route file composes `<DataTable {...defs} />` only.
  - Pick URL persistence (`useRouteSearchTableState`) OR localStorage (`useLocalTableState`) OR neither — never both.
  - Bulk action UI MUST render inside `<DataTable.BulkBar>` slot. Bulk mutations live in `modules/<name>/api.ts`.
  - Lists wanting auto-refresh MUST declare `realtimeTopic` matching the backend `__realtime_resource__`. TypeScript type enforces match.
  - List user-visible strings MUST come from the `data-table` namespace or the module's own namespace. No inline literals.
- [x] 25.3 Add compliant-example code block showing: column defs file + route composition + bulk mutation
- [x] 25.4 Document `useRealtimeInvalidation` provider mount and the `realtimeTopic` opt-in pattern

## 26. ESLint custom rules

- [x] 26.1 Configure `no-restricted-syntax` in `apps/orchestrator/eslint.config.js` blocking JSX `<table>` element outside `src/components/ui/table.tsx` and `src/components/data-table/**`. Error message: "Use `DataTable<T>` for lists; raw `<table>` only allowed inside the `Table` primitive."
- [x] 26.2 Configure `no-restricted-imports` blocking `@tanstack/react-table` imports outside `src/components/data-table/**`. Error: "TanStack Table is an implementation detail of DataTable; import from `@/components/data-table` instead."
- [x] 26.3 Configure `no-restricted-imports` blocking `@/components/ui/table` imports outside `src/components/data-table/**` and tests. Error: "Import `DataTable` from `@/components/data-table`; the `Table` primitive is internal."
- [x] 26.4 Configure `no-restricted-syntax` blocking `useQuery` calls whose first arg matches a list-endpoint path literal (`/<resource>?page=` etc) — best effort heuristic flagging direct list-endpoint calls. Error: "Use `usePaginatedQuery` for paginated lists."
- [x] 26.5 ESLint integration tests under `apps/orchestrator/tests-lint/` exercising each rule
- [x] 26.6 Verify `moon run orchestrator:lint` fails on a deliberate violation example then passes after removal

## 27. Backend conformance tests

- [x] 27.1 Add `tests/_conformance/test_list_endpoint_conformance.py`:
  - Introspect every route in the FastAPI app whose `response_model` is a `Page[*]` subclass
  - Assert each declares `ListQueryParamsDep` (or factory result) as a parameter
  - Assert each is a `GET /<resource>` (plural noun, no `/list` suffix)
- [x] 27.2 Add `tests/_conformance/test_bulk_endpoint_conformance.py`:
  - Detect routes matching `POST /<resource>/<action>` shape where action is in a known verb set (`archive`, `delete`, `assign`, `complete`, etc — extensible list)
  - Assert request body Pydantic model has a single `ids: list[UUID]` field
  - Assert response model is `BulkResult` subclass
- [x] 27.3 Add `tests/_conformance/test_realtime_resource_declared.py`:
  - Walk every concrete subclass of `TenantOwnedEntity`
  - Assert each declares `__realtime_resource__` (value MAY be `None` but the attr MUST be present in the class body, not inherited as a default)
- [x] 27.4 Tests run as part of `moon run backend:test`

## 28. Shared `BulkResult` schema

- [x] 28.1 Add `apps/backend/app/schemas/_bulk/__init__.py` and `apps/backend/app/schemas/_bulk/bulk_result.py`
- [x] 28.2 Define `BulkResult` Pydantic model: `{succeeded: list[UUID], failed: list[BulkFailure]}` where `BulkFailure = {id: UUID, code: str, message: str}`
- [x] 28.3 Define `BulkRequest` generic `{ids: list[UUID]}` (or per-action body extending it with additional params)
- [x] 28.4 Tests for schema shape + OpenAPI naming (`BulkResult_<Resource>_` if generic)

## 29. Change closeout

- [x] 29.0 Remove demo scratch route + its MSW handlers before validating + committing: delete `apps/orchestrator/src/routes/demo/data-table.tsx` (and any sibling `demo/` files added for the smoke), drop any demo-only MSW handlers added under `src/test/msw/`, regenerate `routeTree.gen.ts`, re-run `moon run orchestrator:typecheck` + `moon run orchestrator:lint` + `moon run orchestrator:test`
- [x] 29.1 `openspec validate --changes add-datatable-base`
- [x] 29.2 Commit per logical unit (semantic, one-liner, ≤72 chars):
  - `feat(backend): add list-query schemas + page envelope`
  - `feat(backend): add list-query params dep`
  - `feat(backend): add base list repository`
  - `feat(backend): add bulk-result schema`
  - `feat(backend): add realtime pubsub + flush hook`
  - `feat(backend): add sse events router`
  - `feat(backend): add list + bulk + realtime conformance tests`
  - `docs(backend): codify list and realtime conventions`
  - `feat(orchestrator): add table primitive`
  - `feat(orchestrator): add datatable core + sticky first column`
  - `feat(orchestrator): add datatable toolbar slots`
  - `feat(orchestrator): add datatable pagination`
  - `feat(orchestrator): add datatable selection + bulk bar`
  - `feat(orchestrator): add datatable row actions`
  - `feat(orchestrator): add datatable row-click + expandable rows`
  - `feat(orchestrator): add usePaginatedQuery hook`
  - `feat(orchestrator): add table state persistence helpers`
  - `feat(orchestrator): add realtime invalidation provider`
  - `feat(orchestrator): add data-table i18n namespace`
  - `chore(orchestrator): add eslint rules for table + tanstack import boundaries`
  - `docs(orchestrator): codify list and datatable conventions`
- [ ] 29.3 Open PR (title: `feat: add datatable + list-query + realtime invalidation base`)
