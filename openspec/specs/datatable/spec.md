# datatable Specification

## Purpose
TBD - created by archiving change add-datatable-base. Update Purpose after archive.
## Requirements
### Requirement: `DataTable<T>` composite component

The orchestrator SHALL provide a `DataTable<T>` component at `src/components/data-table/DataTable.tsx` that renders tabular data backed by a `Page<T>` response envelope. The component SHALL accept a typed `columns: ColumnDef<T>[]` definition, `data: T[]`, `pagination` (`{ page, pageSize, totalPages, total }`), and optional `state` + `onStateChange` for controlled mode. The component MUST NOT live in `src/components/ui/` — `ui/` hosts the shadcn `Table` primitive only. `DataTable<T>` SHALL render with comfortable density (single row height) — no density toggle in PoC scope.

#### Scenario: Renders header + body from column definitions

- **WHEN** `<DataTable columns={[{id: "name", header: t('patients.column.name'), accessor: row => row.name}]} data={[{name: "Anna"}]} ... />` is rendered
- **THEN** the table MUST render a `<th>` with the resolved header text and a `<td>` with `Anna`

#### Scenario: Empty / loading / refetch / error composition

- **WHEN** `DataTable` is rendered with `data = []` and `isLoading = false`
- **THEN** it MUST render `EmptyState` from `src/components/states/EmptyState.tsx` with `data-table.empty.title` / `data-table.empty.body`

- **WHEN** `isLoading = true` and `data` is empty
- **THEN** it MUST render `Skeleton` placeholders sized to match the column count

- **WHEN** `data` is non-empty and `isFetching = true`
- **THEN** it MUST render `RefetchOverlay` over the table without unmounting rows

- **WHEN** a non-null `error` is passed
- **THEN** it MUST render `ErrorState` with the error's message

### Requirement: First column is always sticky

`DataTable<T>` SHALL render the first column as `position: sticky; left: 0` on both `<th>` and `<td>`. A subtle inset right shadow SHALL hint horizontal-scroll affordance when the table overflows its container. When the bulk-select checkbox column is present, that checkbox column SHALL be the first column and SHALL inherit the sticky behavior. When the expand chevron column is present alongside the checkbox, the checkbox stays leftmost; without a checkbox, the chevron is leftmost.

#### Scenario: First data column sticky in absence of leading columns

- **WHEN** the table renders without selection or expand columns
- **THEN** the first `ColumnDef` MUST render with `position: sticky; left: 0` and a leading shadow when scrolled horizontally

#### Scenario: Bulk checkbox column claims the sticky slot

- **WHEN** `selectable` is true
- **THEN** the leading checkbox column MUST be the sticky column and the first `ColumnDef` MUST NOT carry `position: sticky`

### Requirement: Sorting is column-controlled and a11y-correct

`DataTable<T>` SHALL allow declaring `sortKey: keyof T` and `enableSorting: true` on a `ColumnDef`. Clicking the column header SHALL toggle `asc` → `desc` → `none`. The `<th>` MUST carry `aria-sort` reflecting current state (`"ascending"`, `"descending"`, `"none"`). Keyboard activation (`Enter` / `Space`) MUST be equivalent to clicking. Only one column SHALL be sortable at a time.

#### Scenario: Cycling sort state via clicks

- **WHEN** a user clicks a sortable column header three times
- **THEN** the table state MUST cycle `{order_by: <key>, order: "asc"}` → `{order_by: <key>, order: "desc"}` → `{order_by: undefined, order: "asc"}`

#### Scenario: `aria-sort` reflects current state

- **WHEN** the table is sorted ascending by column `name`
- **THEN** the `name` column's `<th>` MUST have `aria-sort="ascending"` and other sortable headers MUST have `aria-sort="none"`

### Requirement: Toolbar uses compound-slot API

`DataTable<T>` SHALL expose its toolbar as compound slots: `<DataTable.Toolbar>` containing `<DataTable.Toolbar.Search>`, `<DataTable.Toolbar.Filters>`, and `<DataTable.Toolbar.Actions>`. Consumers compose the toolbar — DataTable does not render a default toolbar; the consumer chooses which slots to include. Custom buttons (e.g. "Voeg patiënt toe") slot into `<DataTable.Toolbar.Actions>` as children.

#### Scenario: Toolbar slots render in fixed visual order

- **WHEN** a consumer composes `<DataTable.Toolbar><DataTable.Toolbar.Actions>...<DataTable.Toolbar.Search />...</DataTable.Toolbar>`
- **THEN** the rendered DOM MUST place Search on the left, Filters in the middle, Actions on the right — regardless of JSX child order

#### Scenario: Missing slot renders nothing

- **WHEN** a consumer renders `<DataTable.Toolbar><DataTable.Toolbar.Search /></DataTable.Toolbar>` only
- **THEN** the toolbar MUST render only the search input, no empty placeholders

### Requirement: Filtering bound to declared filter columns

`<DataTable.Toolbar.Filters>` SHALL accept a `filters: DataTableFilter<T>[]` prop describing filterable columns (`{ key: keyof T, label, type: "select" | "multi" | "date-range" | "text", options?: { value, label }[] }`). The toolbar SHALL render filter controls and propagate selections into the `filters` map of table state. Components MUST NOT add ad-hoc filter UI outside the toolbar slot.

#### Scenario: Selecting a multi-select filter updates state

- **WHEN** the user opens the `status` filter and selects values `active` and `pending`
- **THEN** the state MUST emit `filters: { status: { in: ["active", "pending"] } }` and the URL MAY round-trip when the route opts in

#### Scenario: Date range filter emits gte/lte

- **WHEN** the user picks `2026-01-01` and `2026-12-31` in a `date-range` filter on `created_at`
- **THEN** the state MUST emit `filters: { created_at: { gte: ["2026-01-01"], lte: ["2026-12-31"] } }`

#### Scenario: Text filter emits contains

- **WHEN** the user types `anna` in a `text` filter on `name`
- **THEN** the state MUST emit `filters: { name: { contains: ["anna"] } }` after the 300ms debounce

#### Scenario: Clear-all resets every filter

- **WHEN** the user clicks the toolbar "Wis filters" button
- **THEN** the state MUST emit `filters: {}` and any visible filter chips MUST disappear

### Requirement: Debounced global search

`<DataTable.Toolbar.Search>` SHALL render an `<input type="search">` whose value debounces (300ms) before propagating to the `q` field of table state. The hook layer SHALL NOT debounce — debouncing is a UI concern.

#### Scenario: Rapid typing emits a single state change

- **WHEN** the user types `anna` into the search input within 300ms
- **THEN** exactly one state change MUST be emitted with `q = "anna"`

#### Scenario: Clearing the search emits `q: undefined`

- **WHEN** the user empties the search input
- **THEN** the state MUST emit `q: undefined` after the debounce window

### Requirement: Pagination footer renders previous / next + indicator

`DataTable<T>` SHALL render a footer with previous and next buttons plus a localized `<page> / <total_pages>` indicator and a page-size selector. Disabled state SHALL apply when on the first or last page. `pageSizeOptions: number[]` prop SHALL default to `[10, 25, 50]`.

#### Scenario: Previous disabled on first page

- **WHEN** the table is on page `1`
- **THEN** the "Vorige" button MUST have `aria-disabled="true"`

#### Scenario: Next disabled on last page

- **WHEN** the table is on page `total_pages`
- **THEN** the "Volgende" button MUST have `aria-disabled="true"`

#### Scenario: Page-size change resets to page 1

- **WHEN** the user changes `page_size` from `25` to `10`
- **THEN** the state MUST emit `{page: 1, pageSize: 10}`

### Requirement: Multi-select with sticky bulk-action bar

`DataTable<T>` SHALL accept a `selectable?: boolean` prop. When `selectable = true`, the table SHALL render a leading checkbox column plus a header checkbox that toggles all rows on the current page. Selected row ids SHALL accumulate across page changes. Selection state SHALL be internal by default with an `onSelectionChange?: (selectedIds: Set<string>) => void` callback; controlled mode SHALL be available via `selectedIds: Set<string>` + `onSelectionChange`. When the selection set is non-empty, the component SHALL render `<DataTable.BulkBar>` as a sticky bottom bar that slides up. The bar SHALL contain a selection-count label, a "Annuleer" button that clears selection, and a consumer-supplied child slot for action buttons. The page SHALL receive bottom padding equal to the bar height so content is never obscured.

#### Scenario: Header checkbox toggles current page

- **WHEN** the user clicks the header checkbox while no row is selected
- **THEN** all visible row ids on the current page MUST be added to the selection set

- **WHEN** the user clicks the header checkbox while every visible row is selected
- **THEN** only the visible row ids MUST be removed from the selection set (selections from other pages MUST persist)

#### Scenario: Bulk bar slides up on first selection

- **WHEN** the user checks the first row
- **THEN** `<DataTable.BulkBar>` MUST mount with a sticky position at the bottom of the viewport, a count label `1 geselecteerd`, and a translate-Y transition from `100%` to `0`

#### Scenario: Selection-bar requires consumer-supplied actions

- **WHEN** `selectable = true` is set but no `<DataTable.BulkBar.Actions>` children are provided
- **THEN** the bar MUST still render with only the count + cancel button

#### Scenario: Selection survives page change

- **WHEN** the user selects 3 rows on page 1, navigates to page 2, and selects 2 more rows
- **THEN** the selection set MUST contain 5 ids and the bar count MUST read `5 geselecteerd`

#### Scenario: Selection clears when filter changes

- **WHEN** the user has selections active and changes a filter or search term
- **THEN** the selection set MUST clear to empty and the bulk bar MUST slide out

#### Scenario: Selection drift after realtime invalidation

- **GIVEN** the user has selected ids `[a, b, c]`
- **WHEN** a realtime invalidation refetches the page and ids `b` and `c` no longer match the current query
- **THEN** the selection set MUST be reduced to `[a]` and the bar count MUST update accordingly

#### Scenario: Cancel button clears selection and removes bar

- **WHEN** the user clicks the "Annuleer" button in `<DataTable.BulkBar>`
- **THEN** the selection set MUST clear to empty and the bar MUST animate out

#### Scenario: Page bottom padding while bar visible

- **WHEN** the bulk bar is visible
- **THEN** the table's nearest scroll container MUST receive `padding-bottom` equal to the bar height so the last row is reachable

### Requirement: Per-row actions menu

`DataTable<T>` SHALL accept a `rowActions?: (row: T) => DataTableRowAction[]` prop. When supplied, the component SHALL render a trailing column whose cell hosts a `<DropdownMenu>` (from `@/components/ui/dropdown-menu`) with one menu item per returned action. `DataTableRowAction = { label: string, icon?: ReactNode, onClick: (row: T) => void, destructive?: boolean, disabled?: boolean }`. Destructive actions SHALL receive the existing destructive styling. The trailing actions column MUST NOT participate in row-click navigation — clicking the action trigger MUST stop propagation.

#### Scenario: Trailing actions column renders only when prop set

- **WHEN** `rowActions` is undefined
- **THEN** no trailing actions column MUST render

#### Scenario: Menu item count matches returned actions

- **WHEN** `rowActions(row)` returns 3 entries
- **THEN** opening the dropdown for that row MUST show 3 `MenuItem`s with matching labels and icons

#### Scenario: Disabled action is unclickable

- **WHEN** an action returns `disabled: true`
- **THEN** its `MenuItem` MUST be rendered with `aria-disabled="true"` and clicking it MUST NOT invoke `onClick`

#### Scenario: Action click does not navigate the row

- **WHEN** `onRowClick` is set and the user opens the row actions menu
- **THEN** clicking the trigger or any menu item MUST NOT invoke `onRowClick`

### Requirement: Row-click navigation

`DataTable<T>` SHALL accept an `onRowClick?: (row: T) => void` prop. When provided, the `<tr>` SHALL render as `role="button"`, `tabIndex={0}`, with pointer cursor; click, `Enter`, and `Space` SHALL each invoke `onRowClick`. Clicks on nested interactive elements (checkbox cell, actions menu trigger, expand chevron) MUST stop propagation so `onRowClick` is not invoked. When `onRowClick` is not provided, rows MUST be non-interactive (no `tabIndex`, no pointer cursor).

#### Scenario: Row click invokes handler

- **WHEN** `onRowClick` is set and the user clicks anywhere in the row outside interactive children
- **THEN** `onRowClick(row)` MUST be invoked exactly once

#### Scenario: Enter / Space activate row

- **WHEN** `onRowClick` is set and the row has focus, and the user presses `Enter`
- **THEN** `onRowClick(row)` MUST be invoked

#### Scenario: Checkbox click does not navigate

- **WHEN** the user clicks the leading bulk-select checkbox
- **THEN** the selection state MUST update and `onRowClick` MUST NOT fire

### Requirement: Expandable rows (single-row, opt-in)

`DataTable<T>` SHALL accept a `renderExpandedRow?: (row: T) => ReactNode` prop. When supplied, the component SHALL render a leading chevron column with a `<button aria-expanded>` per row. Clicking the chevron SHALL toggle the row's expanded state; expanding row B SHALL collapse row A (single-row mode). When a row is expanded, the component SHALL render an additional `<tr>` directly below it whose single `<td colspan>` hosts the result of `renderExpandedRow(row)`. Expansion state SHALL be internal — no controlled mode in PoC scope.

#### Scenario: Chevron column renders only when prop set

- **WHEN** `renderExpandedRow` is undefined
- **THEN** no leading chevron column MUST render

#### Scenario: Expanding one row collapses any other

- **GIVEN** row A is currently expanded
- **WHEN** the user clicks row B's chevron
- **THEN** row A MUST collapse and row B MUST expand

#### Scenario: Expanded panel uses `colspan`

- **WHEN** a row is expanded in a table with 6 columns
- **THEN** the expanded panel's `<td>` MUST have `colspan="6"`

#### Scenario: Keyboard toggles expansion

- **WHEN** the chevron button is focused and the user presses `Enter` or `Space`
- **THEN** the row MUST toggle expansion exactly as clicking would

#### Scenario: Chevron click does not navigate row

- **WHEN** `onRowClick` is set and the user clicks the expand chevron
- **THEN** `onRowClick` MUST NOT fire — only the expansion state MUST change

### Requirement: Realtime topic opt-in

`DataTable<T>` SHALL accept a `realtimeTopic?: string` prop. The prop SHALL be a TypeScript const-checked resource name matching the `resource` field of `RealtimeEvent` payloads (e.g. `"tasks"`, `"patients"`). The prop is documentation — it does NOT itself open a subscription; the global `useRealtimeInvalidation()` provider handles event dispatch via `queryClient.invalidateQueries`. The table's `usePaginatedQuery` cache key MUST begin with the resource name so resource-level invalidation reaches it.

#### Scenario: Cache key starts with the resource name

- **WHEN** `usePaginatedQuery("/tasks", query)` runs for a table with `realtimeTopic="tasks"`
- **THEN** the derived TanStack Query key MUST start with `["tasks", ...]`

#### Scenario: Invalidation reaches the table

- **GIVEN** a table is mounted with `realtimeTopic="tasks"` and currently displays page 1 of `/tasks`
- **WHEN** the realtime provider receives `{resource: "tasks", action: "upsert", id: "..."}`
- **THEN** the table's `usePaginatedQuery` MUST refetch and `RefetchOverlay` MUST appear briefly

### Requirement: `usePaginatedQuery<T>` binds openapi-fetch to TanStack Query

The orchestrator SHALL provide `usePaginatedQuery<TPath>(path: TPath, query: ListQueryShape, options?)` in `src/hooks/usePaginatedQuery.ts` that returns `UseQueryResult<Page<T>>`. The hook SHALL derive the TanStack Query key from `(path, canonicalQuery)` using `lib/query/paginated.ts`. Canonicalisation SHALL sort `filters` keys, sort operator keys within each field, and sort value arrays. The hook SHALL accept an optional `queryKey` override for special cases.

#### Scenario: Identical queries hit the same cache entry

- **WHEN** two components mount with the same `path` + the same `ListQuery` values regardless of object identity
- **THEN** TanStack Query MUST resolve them to the same cache entry (single network request)

#### Scenario: Query key reflects every meaningful field

- **WHEN** any of `page`, `pageSize`, `q`, `orderBy`, `order`, or any `filters` entry differs between two calls
- **THEN** the cache keys MUST differ

#### Scenario: Filter ordering does not affect cache identity

- **WHEN** one call uses `filters: {status: {in: ["a", "b"]}, role: {eq: ["c"]}}` and another uses `filters: {role: {eq: ["c"]}, status: {in: ["b", "a"]}}`
- **THEN** the cache keys MUST be equal

### Requirement: State persistence helpers (opt-in)

The orchestrator SHALL provide two helper hooks for state persistence, both opt-in per consumer:

- `useRouteSearchTableState(searchSchema)` round-trips DataTable state through TanStack Router search params. Consumer defines the route's `validateSearch` and passes the resulting `state` + `onStateChange` to DataTable.
- `useLocalTableState(tableId: string, initialState?)` round-trips DataTable state through `localStorage` keyed by `tableId`. Loaded on mount, written debounced (200ms) on every change.

The default uncontrolled mode SHALL keep state in component-internal `useState`. Consumers MAY combine helpers (URL takes precedence; localStorage as fallback for unspecified fields).

#### Scenario: Uncontrolled mode persists nothing

- **WHEN** a consumer renders `DataTable` without `state` / `onStateChange`
- **THEN** navigating away and back MUST reset table state to defaults

#### Scenario: URL helper round-trips state

- **WHEN** a route uses `useRouteSearchTableState` and the user sorts a column
- **THEN** the URL search params MUST update to encode the new state, and reloading the route MUST restore the same sort

#### Scenario: localStorage helper survives reload

- **WHEN** a consumer uses `useLocalTableState("patients-table")` and applies filters
- **THEN** reloading the page MUST restore the same filters from `localStorage`

#### Scenario: localStorage write is debounced

- **WHEN** the user rapidly toggles three filters within 200ms
- **THEN** at most one `localStorage.setItem` call SHALL occur for that burst

### Requirement: Localized strings via `data-table` i18n namespace

Every user-visible string rendered by `DataTable<T>`, its toolbar, pagination, bulk bar, and state surfaces SHALL come from a new `data-table` i18n namespace under `src/lib/i18n/locales/nl/data-table.json`. No literal Dutch strings MAY live in component source. Column header text MAY be supplied by the consumer as either an i18n key or a pre-localized string. The `realtime.offline` warning toast key MUST exist.

#### Scenario: Empty state uses namespace key

- **WHEN** the table renders its empty state
- **THEN** the rendered title and body MUST resolve via `t('data-table.empty.title')` and `t('data-table.empty.body')`

#### Scenario: Lint forbids literal Dutch in data-table source

- **WHEN** `moon run orchestrator:lint` runs
- **THEN** no component file under `src/components/data-table/` MUST contain a hard-coded Dutch user-visible string

### Requirement: Accessible table semantics

`DataTable<T>` SHALL render a native `<table>` (via the shadcn `Table` primitive) with `<thead>`, `<tbody>`, `<tr>`, `<th scope="col">`, and `<td>` semantics. Sortable headers SHALL be `<button>` elements nested inside `<th>` with `aria-sort` on the `<th>`. The table SHALL carry an accessible name via `aria-labelledby` pointing to a consumer-supplied heading id, or a `<caption>` slot when no heading id is provided.

#### Scenario: Sortable header is a real button

- **WHEN** a screen reader navigates to a sortable column header
- **THEN** it MUST announce the header text plus the current sort state via `aria-sort`, and the header MUST be reachable by `Tab`

#### Scenario: Bulk bar announces selection count

- **WHEN** the user selects rows
- **THEN** the bulk bar MUST be a `role="region"` with `aria-live="polite"` so screen readers announce the changing count
