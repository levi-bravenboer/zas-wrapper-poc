# Pretty Tables — DataTable + Toolbar refresh

**Date:** 2026-05-17
**Branch:** `fix/pretty-tables`
**Status:** Draft for review

## Goals

1. **Inline filter strip** — every filter visible as a prefixed pill in the toolbar (no single "Filters" dropdown gate).
2. **Decompose monoliths** — split `DataTable.tsx` (776 LOC) and `DataTableToolbar.tsx` (565 LOC) into hooks + primitives + a convenience wrapper. Each file under ~200 LOC.
3. **Visual refresh** — align the table chrome with the existing orchestrator design language (ZAS teal, opaque rounded-xl cards, mint accents, tracking-tight, hairline borders, Geist).

## Non-goals

- Server-side pagination / sort / filter contract is unchanged. State hooks (`useRouteSearchTableState`, `useLocalTableState`) are unchanged.
- `<DataTablePagination>` API is unchanged. Visual restyle only (table footer layout per mockup).
- `<BulkBar>` API is unchanged; restyled to match.
- `FilterableListPage` keeps its slot shape.
- No virtualisation, no column resize, no column visibility toggles (out of scope).

## Filter UX

### Layout

Toolbar row sits **above** the table card (per `FilterableListPage`). Single row:

```
[ 🔍 Search …………… ]  [Role: Admin ×] [Status: Active ×] [Created ▾] [+N more ▾] [Clear all]      [+ New user]
```

- Search left, max width 320, flex-grow.
- Filter pills middle, wrap to next line when toolbar overflows.
- First 3 filter defs render as inline pills. Defs beyond 3 collapse into a **`+N more ▾`** popover (multi-select list — click a row to open that filter's editor inline in the popover, click X next to active to clear).
- **Clear all** appears only when ≥ 1 filter active.
- Primary action sits right-aligned via `FilterableListPage`'s existing slot.

### Pill states

| State        | Style                                                        | Example          |
|--------------|--------------------------------------------------------------|------------------|
| Empty        | `bg-background/60 border border-border text-foreground-muted` + caret | `Role ▾`         |
| Hovered      | `border-accent-mint text-primary`                            | (hover state)    |
| Active       | `bg-primary-subtle border-accent-mint text-primary-pressed`  | `Role: Admin ×`  |
| Overflow     | `+2 more ▾` — same as empty pill, opens popover              |                  |

Clicking an empty pill opens its editor popover (same editors as today: Select / Multi / DateRange / Text). Clicking the `×` on an active pill clears that filter.

### Active filter signaling

The pill itself is the chip. **No separate chip row.** This removes the current `buildChips` duplication: editors and chips are the same UI element.

### Search

Stays as today (debounced 300ms, `<Input type="search">`), but restyled with a leading `⌕` icon inside the input, focus ring uses `--color-ring` (teal).

## Visual refresh

### Tokens used

All values pulled from `apps/orchestrator/src/styles/tokens.css`. No new tokens introduced.

- Card surface: `bg-background`, `border-border`, `rounded-lg` (12px), `shadow-xs`
- Toolbar pills: `rounded-md` (8px)
- Header row: `bg-surface-1`, `text-foreground-muted`, uppercase, `text-xs`, `tracking-wider`
- Row hover: `bg-primary-subtle/50`
- Avatar: gradient `from-primary-soft to-accent-mint`, `text-primary-pressed`
- Badges: `bg-primary-subtle text-primary border-primary-soft` (admin) · `bg-muted text-foreground-muted border-border` (caregiver)
- Status dot: `bg-success` with `ring-success/15` halo (active) · `bg-border` (inactive)
- Table footer: `bg-surface-1`, `border-t border-border`, `text-xs text-foreground-muted`

### Density

**Comfy** (default): `py-3` rows, matches detail-page rhythm. Switch to `py-2` (tight) is a one-line change; spec calls comfy.

### Page hero accent

Optional mint blur orb above the toolbar row (mirrors `UserHero` pattern). Decided per-page by consumer via a `<FilterableListPage>` `accent` slot — opt-in, not default, to avoid noise on every list.

## Architecture

### File layout

```
apps/orchestrator/src/components/data-table/
  index.ts                            # re-exports
  types.ts                            # unchanged
  columns.ts                          # unchanged
  bulk-bar-context.ts                 # unchanged
  BulkBar.tsx                         # restyle only (no API change)
  DataTablePagination.tsx             # restyle only (no API change)

  hooks/
    use-table-selection.ts            # cross-page + page reconcile
    use-table-expansion.ts            # single-row expand
    use-table-sort.ts                 # asc → desc → unset cycle
    use-sticky-horizontal-scroll.ts   # data-scrolled flag

  primitives/
    Table.tsx                         # Root, Header, HeaderRow, Body, Row, Cell, HeaderCell
    SortHeader.tsx                    # sortable column header (button + chevron)
    SelectionCell.tsx                 # row + header checkboxes
    ExpandToggle.tsx
    RowActions.tsx                    # menu + confirm dialog (existing RowActionsMenu)
    LoadingRows.tsx
    EmptyRow.tsx

  DataTable.tsx                       # convenience wrapper (current API), ~150 LOC

  toolbar/
    Toolbar.tsx                       # Root, Search slot, Filters slot, Actions slot
    DebouncedSearch.tsx
    FilterPill.tsx                    # the pill + popover wrapper
    FilterOverflow.tsx                # "+N more" popover
    editors/
      SelectEditor.tsx
      MultiEditor.tsx
      DateRangeEditor.tsx
      TextEditor.tsx
    chips.ts                          # buildChips helper (consumed by FilterPill labelling)

  DataTableToolbar.tsx                # convenience wrapper (filterDefs API), ~100 LOC
```

### Public surface (`index.ts`)

```ts
// Convenience (current consumers)
export { DataTable } from './DataTable'
export { DataTablePagination } from './DataTablePagination'
export { DataTableToolbar, Toolbar } from './DataTableToolbar'
export { BulkBar } from './BulkBar'

// Primitives (new — opt-in composition)
export * as TablePrimitives from './primitives/Table'
export { SortHeader } from './primitives/SortHeader'
export { SelectionCell, SelectionHeader } from './primitives/SelectionCell'
export { ExpandToggle } from './primitives/ExpandToggle'
export { RowActions } from './primitives/RowActions'
export { LoadingRows } from './primitives/LoadingRows'
export { EmptyRow } from './primitives/EmptyRow'

// Toolbar primitives
export { Toolbar as ToolbarRoot } from './toolbar/Toolbar'
export { DebouncedSearch } from './toolbar/DebouncedSearch'
export { FilterPill } from './toolbar/FilterPill'
export { FilterOverflow } from './toolbar/FilterOverflow'
export * as FilterEditor from './toolbar/editors'

// Hooks
export { useTableSelection } from './hooks/use-table-selection'
export { useTableExpansion } from './hooks/use-table-expansion'
export { useTableSort } from './hooks/use-table-sort'

// Existing
export { defineColumn } from './columns'
export type * from './types'
export type { DataTableFilter } from './toolbar/Toolbar'
```

### Hook contracts

```ts
useTableSelection<T>({
  data, getRowId, selectable,
  controlled?: { selectedIds, onSelectionChange },
  filterIdentity, page,
}): {
  selectedIds: ReadonlySet<string>
  toggleRow(id: string): void
  togglePage(): void
  pageSelectionState: 'all' | 'some' | 'none'
  cancel(): void
}

useTableExpansion(): {
  expandedId: string | null
  toggle(id: string): void
}

useTableSort({ state, setSort }): {
  cycle(sortKey: string): void
  iconState(sortKey: string): 'asc' | 'desc' | null
  ariaSort(sortKey: string): 'ascending' | 'descending' | 'none'
}
```

Each hook owns one concern, can be tested independently, and is what the new primitives consume internally.

### Consumer migration (all three)

Per the agreed scope, all three current consumers migrate to primitive composition to validate the API:

- `apps/orchestrator/src/routes/_auth/users.tsx`
- `apps/orchestrator/src/routes/_auth/patients/index.tsx`
- `apps/orchestrator/src/modules/user/components/UserListPage.tsx`

Each becomes a thin composition:

```tsx
<Toolbar.Root>
  <Toolbar.Search value={state.q} onChange={dispatch.setSearch} />
  {filterDefs.map((def) => <FilterPill key={def.key} def={def} value={state.filters[def.key]} onChange={...} />)}
  <FilterOverflow defs={overflowDefs} ... />
  {anyActive && <Toolbar.ClearAll onClick={dispatch.clearAll} />}
</Toolbar.Root>

<Table.Root>
  <Table.Header>
    <Table.HeaderRow>
      {columns.map((c) => c.sortKey
        ? <SortHeader key={c.id} ...sort />
        : <Table.HeaderCell key={c.id}>{c.header}</Table.HeaderCell>)}
      <Table.HeaderCell aria-hidden /> {/* actions */}
    </Table.HeaderRow>
  </Table.Header>
  <Table.Body>
    {rows.map((row) => (
      <Table.Row key={getRowId(row)} onClick={() => onRowClick(row)}>
        {columns.map((c) => <Table.Cell key={c.id}>{c.cell(row)}</Table.Cell>)}
        <Table.Cell><RowActions actions={rowActions(row)} /></Table.Cell>
      </Table.Row>
    ))}
  </Table.Body>
</Table.Root>
```

The `<DataTable>` convenience wrapper continues to exist and is built on the same primitives — useful for callers who don't need composition.

### Duplicate route flag

`apps/orchestrator/src/routes/_auth/users.tsx` and `apps/orchestrator/src/modules/user/components/UserListPage.tsx` both render a user list independently. **Out of scope to consolidate here**, but the spec calls it out for follow-up. Both get migrated to the new API in lockstep so behavior matches.

## Testing strategy

Existing tests live in `src/components/data-table/*.test.tsx` (DataTable.sort / selection / rowClick / rowActions / expand / integration, plus Toolbar.search / Toolbar.filters / Pagination). All currently pass.

Approach:

1. **Keep existing tests as black-box checks against the convenience wrapper** — they prove the public API is unchanged.
2. **Add unit tests per hook** — `use-table-selection.test.ts`, `use-table-expansion.test.ts`, `use-table-sort.test.ts`. Direct hook testing replaces internal coverage we lose by splitting.
3. **Add primitive composition test** — one integration test rendering `<Table.Root>` directly to prove primitives work standalone.
4. **Add toolbar inline-strip test** — assert pills render visible (not in dropdown), overflow appears beyond N, popover editor flow.

Update existing `DataTableToolbar.filters.test.tsx` to drive pills directly rather than the old `FilterDropdown` trigger.

`tests-lint` rules: existing rules block raw `<table>` imports from `@/components/ui/table`. Keep those; the new primitives become the sanctioned wrappers.

## Error handling

Unchanged. `<DataTable>` still routes `error` to `ErrorState`, `isLoading` to `LoadingRows`, `data.length === 0` to `EmptyState`. Primitives expose `<LoadingRows>` and `<EmptyRow>` as standalone for primitive consumers.

## i18n

Existing `data-table` namespace keys all reused. New keys:

- `toolbar.filters.more` — `"+{{count}} more"` (overflow pill)
- `toolbar.filters.pill.empty` — `"{{label}}"` (empty pill label, just the field name)
- `toolbar.filters.pill.active` — `"{{label}}: {{value}}"` (active pill label)
- `toolbar.filters.pill.clear.aria` — `"Remove {{label}} filter"` (× button aria)

Existing `toolbar.filters.button` ("Filters") becomes unused — remove after migration.

## Migration / rollout

Single PR, single change. No flag, no shim. Consumers move with the API change so there's no transitional state.

## Open questions

- **Density**: spec assumes comfy. Switch to tight = single `py-3` → `py-2` change in primitives.
- **Hero accent slot on FilterableListPage**: spec says opt-in. Confirm.

## Verification

- `moon run orchestrator:lint`
- `moon run orchestrator:typecheck`
- `moon run orchestrator:test -- src/components/data-table src/modules/user src/modules/patient src/routes/_auth/users src/routes/_auth/patients`
- Manual: dev server, navigate to `/admin/users` and `/patients`, exercise search, all filters, overflow popover, clear-all, row click, row actions, pagination.
