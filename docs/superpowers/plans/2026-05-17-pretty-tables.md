# Pretty Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `DataTable` + `DataTableToolbar` monoliths into hooks + primitives, surface every filter as an inline pill in the toolbar (no single "Filters" dropdown), and restyle to match the existing orchestrator chrome (ZAS teal, opaque rounded-xl cards, mint accents, hairline borders, Geist).

**Architecture:** Split each monolith into focused files (each <200 LOC): one file per hook (`use-table-selection`, `use-table-expansion`, `use-table-sort`, `use-sticky-horizontal-scroll`), one file per primitive (Table, SortHeader, SelectionCell, ExpandToggle, RowActions, LoadingRows, EmptyRow), one file per filter editor (Select / Multi / DateRange / Text), plus a `FilterPill` + `FilterOverflow` for the inline strip. The existing `<DataTable>` and `<DataTableToolbar>` survive as thin convenience wrappers composed of the new primitives. All three current consumers migrate to primitive composition in lockstep.

**Tech Stack:** React 19, TypeScript, TanStack Table 8, TanStack Router/Query, Tailwind 4 with ZAS tokens, shadcn primitives (Radix), Vitest + Testing Library, moon task runner, react-i18next.

**Reference spec:** `docs/superpowers/specs/2026-05-17-pretty-tables-design.md`

**Conventions:**
- Test command: `moon run orchestrator:test -- <path or -t "name">`
- Type/lint: `moon run orchestrator:typecheck` · `moon run orchestrator:lint`
- All file paths relative to repo root.
- All new files live under `apps/orchestrator/src/components/data-table/`.
- Commit message style: lowercase semantic, ≤72 chars, no period, no AI attribution.

---

## File map

**New files (created by this plan):**

```
apps/orchestrator/src/components/data-table/
  hooks/
    use-table-selection.ts                   # selection + page reconcile
    use-table-selection.test.ts
    use-table-expansion.ts                   # single-row expand
    use-table-expansion.test.ts
    use-table-sort.ts                        # asc → desc → unset cycle helpers
    use-table-sort.test.ts
    use-sticky-horizontal-scroll.ts          # data-scrolled flag
    use-sticky-horizontal-scroll.test.ts

  primitives/
    Table.tsx                                # Root + structural pieces
    Table.test.tsx
    SortHeader.tsx
    SortHeader.test.tsx
    SelectionCell.tsx                        # row + header checkboxes
    SelectionCell.test.tsx
    ExpandToggle.tsx
    ExpandToggle.test.tsx
    RowActions.tsx                           # menu + confirm dialog
    RowActions.test.tsx
    LoadingRows.tsx
    EmptyRow.tsx

  toolbar/
    Toolbar.tsx                              # Root + slots
    Toolbar.test.tsx
    DebouncedSearch.tsx
    DebouncedSearch.test.tsx
    FilterPill.tsx                           # inline pill + popover wrapper
    FilterPill.test.tsx
    FilterOverflow.tsx                       # "+N more" popover
    FilterOverflow.test.tsx
    ClearAll.tsx                             # tiny — "Clear all" button
    chips.ts                                 # buildChips helper (label/value derivation)
    chips.test.ts
    editors/
      SelectEditor.tsx
      MultiEditor.tsx
      DateRangeEditor.tsx
      TextEditor.tsx
      editors.test.tsx                       # all four editors, one file
      index.ts                               # re-exports

  styles.ts                                  # shared className constants
```

**Files modified:**

```
apps/orchestrator/src/components/data-table/
  index.ts                                   # add primitive + hook exports
  DataTable.tsx                              # rebuilt on primitives (~150 LOC, public API unchanged)
  DataTableToolbar.tsx                       # rebuilt on toolbar primitives (~100 LOC, API unchanged but inline-strip behavior)
  BulkBar.tsx                                # restyle only
  DataTablePagination.tsx                    # restyle only
  bulk-bar-context.ts                        # unchanged

apps/orchestrator/public/locales/<lang>/data-table.json
                                             # add 4 new keys, remove 1 obsolete key (per locale)

apps/orchestrator/src/components/list/
  FilterableListPage.tsx                     # add optional `accent` slot (opt-in mint orb)

apps/orchestrator/src/routes/_auth/users.tsx
apps/orchestrator/src/routes/_auth/patients/index.tsx
apps/orchestrator/src/modules/user/components/UserListPage.tsx
                                             # migrate to primitive composition + new filter API
```

**Files deleted:**

```
apps/orchestrator/src/components/data-table/DataTable.tsx       # rewritten in place — not deleted, but body replaced
apps/orchestrator/src/components/data-table/DataTableToolbar.tsx # rewritten in place
```

**Tests preserved as-is (act as regression suite against unchanged convenience-wrapper API):**

```
DataTable.test.tsx
DataTable.sort.test.tsx
DataTable.selection.test.tsx
DataTable.rowClick.test.tsx
DataTable.rowActions.test.tsx
DataTable.expand.test.tsx
DataTable.integration.test.tsx
DataTablePagination.test.tsx
```

**Tests rewritten (filter UX changed):**

```
DataTableToolbar.search.test.tsx             # mostly intact, replace dropdown trigger asserts with inline-pill asserts
DataTableToolbar.filters.test.tsx            # rewrite — assert pills render visible, popover-per-pill flow, overflow
```

---

## Phase 0 — Setup

### Task 0: Verify baseline

**Files:** none

- [ ] **Step 1:** Confirm working dir is `/Users/levibravenboer/Desktop/reaktor/zas-wrapper/.worktrees/fix-pretty-tables`.

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `fix/pretty-tables`

- [ ] **Step 2:** Confirm tests pass on baseline.

Run: `moon run orchestrator:test -- src/components/data-table`
Expected: all suites pass.

- [ ] **Step 3:** Confirm typecheck passes.

Run: `moon run orchestrator:typecheck`
Expected: 0 errors.

Do **not** commit anything in this task.

---

## Phase 1 — Shared styles + i18n stub

### Task 1: Add shared className constants

**Files:**
- Create: `apps/orchestrator/src/components/data-table/styles.ts`

- [ ] **Step 1:** Create `styles.ts` with all repeated classNames extracted from current DataTable + toolbar. This is the single source for the visual refresh — all primitives import from here.

```ts
// apps/orchestrator/src/components/data-table/styles.ts
export const tableCard =
  'overflow-hidden rounded-lg border border-border bg-background shadow-xs'

export const tableEl = 'w-full caption-bottom text-sm'

export const headerRow = 'bg-surface-1'
export const headerCell =
  'h-10 px-4 text-left text-xs font-medium uppercase tracking-wider text-foreground-muted border-b border-border'

export const bodyRow =
  'border-b border-border/60 last:border-b-0 transition-colors hover:bg-primary-subtle/40 data-[state=selected]:bg-primary-subtle/60'
export const bodyRowClickable = 'cursor-pointer'
export const bodyCell = 'px-4 py-3 align-middle text-foreground'

export const stickyFirst =
  'sticky left-0 z-10 bg-background data-[scrolled=true]:shadow-[inset_-8px_0_8px_-8px_rgba(16,24,40,0.08)]'

export const scrollContainer = 'relative w-full overflow-auto'

// toolbar
export const toolbarRoot =
  'flex flex-wrap items-center gap-2 py-3'
export const toolbarSearchBox = 'relative min-w-[240px] max-w-[320px] flex-1'
export const toolbarSearchInput =
  'w-full rounded-md border border-input bg-background/70 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20'

export const pillEmpty =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground-muted hover:border-accent-mint hover:text-primary'
export const pillActive =
  'inline-flex items-center gap-1.5 rounded-md border border-accent-mint bg-primary-subtle py-1 pl-2.5 pr-1 text-xs font-medium text-primary-pressed'
export const pillX =
  'inline-flex h-4 w-4 items-center justify-center rounded text-primary hover:bg-primary/10'

export const clearAllBtn =
  'text-xs text-foreground-muted hover:text-primary px-1.5 py-1 rounded-md'

// table footer / pagination chrome
export const tableFooter =
  'flex items-center justify-between gap-3 border-t border-border bg-surface-1 px-4 py-2 text-xs text-foreground-muted'
```

- [ ] **Step 2:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/styles.ts
git commit -m "feat(data-table): add shared style constants module"
```

---

### Task 2: Add new i18n keys

**Files:**
- Modify: `apps/orchestrator/public/locales/en/data-table.json`
- Modify: `apps/orchestrator/public/locales/nl/data-table.json` (and any other locale files present)

- [ ] **Step 1:** Inspect existing keys.

Run: `cat apps/orchestrator/public/locales/en/data-table.json`

- [ ] **Step 2:** Add keys to each locale file:

```jsonc
{
  // ...existing keys...
  "toolbar": {
    // ...existing toolbar keys...
    "filters": {
      // keep existing keys, add:
      "more": "+{{count}} more",
      "pill": {
        "empty": "{{label}}",
        "active": "{{label}}: {{value}}",
        "clearAria": "Remove {{label}} filter"
      }
    }
  }
}
```

Dutch values:
- `more`: `"+{{count}} meer"`
- `clearAria`: `"Verwijder filter {{label}}"`

Keep `toolbar.filters.button` for now — removed in a later task.

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/public/locales
git commit -m "feat(i18n): add filter pill keys for data-table"
```

---

## Phase 2 — Hooks (TDD, one at a time)

### Task 3: `use-table-sort` hook

**Files:**
- Create: `apps/orchestrator/src/components/data-table/hooks/use-table-sort.ts`
- Test: `apps/orchestrator/src/components/data-table/hooks/use-table-sort.test.ts`

The hook returns helpers for the asc → desc → unset cycle and derived ARIA + icon state.

- [ ] **Step 1:** Write failing tests.

```ts
// use-table-sort.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTableSort } from './use-table-sort'

describe('useTableSort', () => {
  it('first click on a column → asc', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: null, order: 'asc' }, setSort }),
    )
    act(() => result.current.cycle('name'))
    expect(setSort).toHaveBeenCalledWith('name', 'asc')
  })

  it('second click on same column → desc', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'asc' }, setSort }),
    )
    act(() => result.current.cycle('name'))
    expect(setSort).toHaveBeenCalledWith('name', 'desc')
  })

  it('third click on same column → unset', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'desc' }, setSort }),
    )
    act(() => result.current.cycle('name'))
    expect(setSort).toHaveBeenCalledWith(null, 'asc')
  })

  it('iconState returns active dir for current column, null otherwise', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'desc' }, setSort }),
    )
    expect(result.current.iconState('name')).toBe('desc')
    expect(result.current.iconState('email')).toBeNull()
  })

  it('ariaSort returns proper a11y value', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'asc' }, setSort }),
    )
    expect(result.current.ariaSort('name')).toBe('ascending')
    expect(result.current.ariaSort('email')).toBe('none')
  })
})
```

- [ ] **Step 2:** Run — expect FAIL (module missing).

Run: `moon run orchestrator:test -- src/components/data-table/hooks/use-table-sort`

- [ ] **Step 3:** Implement.

```ts
// use-table-sort.ts
import { useCallback } from 'react'

export interface UseTableSortParams {
  state: { orderBy: string | null; order: 'asc' | 'desc' }
  setSort: (orderBy: string | null, order: 'asc' | 'desc') => void
}

export interface UseTableSortApi {
  cycle: (sortKey: string) => void
  iconState: (sortKey: string) => 'asc' | 'desc' | null
  ariaSort: (sortKey: string) => 'ascending' | 'descending' | 'none'
}

export function useTableSort({ state, setSort }: UseTableSortParams): UseTableSortApi {
  const cycle = useCallback(
    (sortKey: string) => {
      if (state.orderBy !== sortKey) setSort(sortKey, 'asc')
      else if (state.order === 'asc') setSort(sortKey, 'desc')
      else setSort(null, 'asc')
    },
    [setSort, state.order, state.orderBy],
  )
  const iconState = useCallback(
    (sortKey: string) => (state.orderBy === sortKey ? state.order : null),
    [state.order, state.orderBy],
  )
  const ariaSort = useCallback(
    (sortKey: string) =>
      state.orderBy !== sortKey
        ? ('none' as const)
        : state.order === 'asc'
          ? ('ascending' as const)
          : ('descending' as const),
    [state.order, state.orderBy],
  )
  return { cycle, iconState, ariaSort }
}
```

- [ ] **Step 4:** Run — expect PASS.

Run: `moon run orchestrator:test -- src/components/data-table/hooks/use-table-sort`

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/hooks/use-table-sort.ts apps/orchestrator/src/components/data-table/hooks/use-table-sort.test.ts
git commit -m "feat(data-table): extract useTableSort hook"
```

---

### Task 4: `use-table-expansion` hook

**Files:**
- Create: `apps/orchestrator/src/components/data-table/hooks/use-table-expansion.ts`
- Test: `apps/orchestrator/src/components/data-table/hooks/use-table-expansion.test.ts`

- [ ] **Step 1:** Write failing tests.

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTableExpansion } from './use-table-expansion'

describe('useTableExpansion', () => {
  it('starts with no expansion', () => {
    const { result } = renderHook(() => useTableExpansion())
    expect(result.current.expandedId).toBeNull()
  })

  it('toggle sets the id', () => {
    const { result } = renderHook(() => useTableExpansion())
    act(() => result.current.toggle('row-1'))
    expect(result.current.expandedId).toBe('row-1')
  })

  it('toggle same id collapses', () => {
    const { result } = renderHook(() => useTableExpansion())
    act(() => result.current.toggle('row-1'))
    act(() => result.current.toggle('row-1'))
    expect(result.current.expandedId).toBeNull()
  })

  it('toggle different id switches (single-row expansion)', () => {
    const { result } = renderHook(() => useTableExpansion())
    act(() => result.current.toggle('row-1'))
    act(() => result.current.toggle('row-2'))
    expect(result.current.expandedId).toBe('row-2')
  })
})
```

- [ ] **Step 2:** Run — expect FAIL.

Run: `moon run orchestrator:test -- src/components/data-table/hooks/use-table-expansion`

- [ ] **Step 3:** Implement.

```ts
// use-table-expansion.ts
import { useCallback, useState } from 'react'

export interface UseTableExpansionApi {
  expandedId: string | null
  toggle: (id: string) => void
}

export function useTableExpansion(): UseTableExpansionApi {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])
  return { expandedId, toggle }
}
```

- [ ] **Step 4:** Run — PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/hooks/use-table-expansion.ts apps/orchestrator/src/components/data-table/hooks/use-table-expansion.test.ts
git commit -m "feat(data-table): extract useTableExpansion hook"
```

---

### Task 5: `use-sticky-horizontal-scroll` hook

**Files:**
- Create: `apps/orchestrator/src/components/data-table/hooks/use-sticky-horizontal-scroll.ts`
- Test: `apps/orchestrator/src/components/data-table/hooks/use-sticky-horizontal-scroll.test.ts`

- [ ] **Step 1:** Write failing tests.

```ts
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useRef, type RefObject } from 'react'

import { useStickyHorizontalScroll } from './use-sticky-horizontal-scroll'

function Probe() {
  const ref = useRef<HTMLDivElement>(null)
  const scrolled = useStickyHorizontalScroll(ref as RefObject<HTMLElement>)
  return (
    <div ref={ref} data-testid="scroller" data-scrolled={scrolled ? 'true' : 'false'}>
      <div style={{ width: 9999 }} />
    </div>
  )
}

describe('useStickyHorizontalScroll', () => {
  it('reports false initially', () => {
    render(<Probe />)
    expect(screen.getByTestId('scroller').dataset.scrolled).toBe('false')
  })

  it('reports true after scrollLeft > 0', () => {
    render(<Probe />)
    const el = screen.getByTestId('scroller')
    Object.defineProperty(el, 'scrollLeft', { value: 10, configurable: true })
    fireEvent.scroll(el)
    expect(el.dataset.scrolled).toBe('true')
  })
})
```

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Implement.

```ts
// use-sticky-horizontal-scroll.ts
import { useEffect, useState, type RefObject } from 'react'

export function useStickyHorizontalScroll(ref: RefObject<HTMLElement>): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScrolled(el.scrollLeft > 0)
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [ref])
  return scrolled
}
```

- [ ] **Step 4:** Run — PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/hooks/use-sticky-horizontal-scroll.ts apps/orchestrator/src/components/data-table/hooks/use-sticky-horizontal-scroll.test.ts
git commit -m "feat(data-table): extract useStickyHorizontalScroll hook"
```

---

### Task 6: `use-table-selection` hook

**Files:**
- Create: `apps/orchestrator/src/components/data-table/hooks/use-table-selection.ts`
- Test: `apps/orchestrator/src/components/data-table/hooks/use-table-selection.test.ts`

This hook owns the cross-page selection + page-reconcile + filter-identity-reset logic currently inside `DataTable.tsx`. Read `DataTable.tsx` lines 200–311 in the current code for the reference behaviour.

- [ ] **Step 1:** Write failing tests covering: controlled vs internal mode, cross-page persistence, page-reconcile drops vanished rows, filter-identity change clears selection, header `pageSelectionState`, `togglePage`, `toggleRow`, `cancel`.

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTableSelection } from './use-table-selection'

interface Row { id: string }

const page1: Row[] = [{ id: 'a' }, { id: 'b' }]
const page2: Row[] = [{ id: 'c' }, { id: 'd' }]

const getRowId = (r: Row) => r.id

describe('useTableSelection', () => {
  it('internal mode — toggleRow updates state', () => {
    const { result } = renderHook(() =>
      useTableSelection({ data: page1, getRowId, selectable: true, page: 1, filterIdentity: 'k1' }),
    )
    act(() => result.current.toggleRow('a'))
    expect(Array.from(result.current.selectedIds).sort()).toEqual(['a'])
  })

  it('controlled mode — calls onSelectionChange, never mutates local', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1, getRowId, selectable: true, page: 1, filterIdentity: 'k1',
        controlled: { selectedIds: new Set<string>(), onSelectionChange: onChange },
      }),
    )
    act(() => result.current.toggleRow('a'))
    expect(onChange).toHaveBeenCalledWith(new Set(['a']))
  })

  it('togglePage selects all current page rows', () => {
    const { result } = renderHook(() =>
      useTableSelection({ data: page1, getRowId, selectable: true, page: 1, filterIdentity: 'k1' }),
    )
    act(() => result.current.togglePage())
    expect(Array.from(result.current.selectedIds).sort()).toEqual(['a', 'b'])
  })

  it('togglePage deselects when all current rows are already selected', () => {
    const { result } = renderHook(() =>
      useTableSelection({ data: page1, getRowId, selectable: true, page: 1, filterIdentity: 'k1' }),
    )
    act(() => result.current.togglePage())
    act(() => result.current.togglePage())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('pageSelectionState reflects partial selection', () => {
    const { result } = renderHook(() =>
      useTableSelection({ data: page1, getRowId, selectable: true, page: 1, filterIdentity: 'k1' }),
    )
    act(() => result.current.toggleRow('a'))
    expect(result.current.pageSelectionState).toBe('some')
  })

  it('cross-page persistence — selecting on p1, navigating to p2, ids remain', () => {
    const { result, rerender } = renderHook(
      ({ data, page }: { data: Row[]; page: number }) =>
        useTableSelection({ data, getRowId, selectable: true, page, filterIdentity: 'k1' }),
      { initialProps: { data: page1, page: 1 } },
    )
    act(() => result.current.toggleRow('a'))
    rerender({ data: page2, page: 2 })
    expect(result.current.selectedIds.has('a')).toBe(true)
  })

  it('page-reconcile — current-page id disappears on refetch → dropped', () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: Row[] }) =>
        useTableSelection({ data, getRowId, selectable: true, page: 1, filterIdentity: 'k1' }),
      { initialProps: { data: page1 } },
    )
    act(() => result.current.toggleRow('a'))
    rerender({ data: [{ id: 'b' }] }) // 'a' vanished from current page, same page number
    expect(result.current.selectedIds.has('a')).toBe(false)
  })

  it('filter-identity change clears selection', () => {
    const { result, rerender } = renderHook(
      ({ filterIdentity }: { filterIdentity: string }) =>
        useTableSelection({ data: page1, getRowId, selectable: true, page: 1, filterIdentity }),
      { initialProps: { filterIdentity: 'k1' } },
    )
    act(() => result.current.toggleRow('a'))
    rerender({ filterIdentity: 'k2' })
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('cancel clears selection', () => {
    const { result } = renderHook(() =>
      useTableSelection({ data: page1, getRowId, selectable: true, page: 1, filterIdentity: 'k1' }),
    )
    act(() => result.current.toggleRow('a'))
    act(() => result.current.cancel())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('no-ops when selectable=false', () => {
    const { result } = renderHook(() =>
      useTableSelection({ data: page1, getRowId, selectable: false, page: 1, filterIdentity: 'k1' }),
    )
    expect(result.current.pageSelectionState).toBe('none')
  })
})
```

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Implement, porting the relevant logic from current `DataTable.tsx` lines 200–311. Skeleton:

```ts
// use-table-selection.ts
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type Dispatch, type SetStateAction,
} from 'react'

export interface UseTableSelectionControlled {
  selectedIds: ReadonlySet<string>
  onSelectionChange: (next: Set<string>) => void
}

export interface UseTableSelectionParams<T> {
  data: ReadonlyArray<T>
  getRowId?: (row: T) => string
  selectable: boolean
  controlled?: UseTableSelectionControlled
  filterIdentity: string
  page: number
}

export interface UseTableSelectionApi {
  selectedIds: ReadonlySet<string>
  toggleRow: (id: string) => void
  togglePage: () => void
  pageSelectionState: 'all' | 'some' | 'none'
  cancel: () => void
}

export function useTableSelection<T>({
  data, getRowId, selectable, controlled, filterIdentity, page,
}: UseTableSelectionParams<T>): UseTableSelectionApi {
  const [internal, setInternal] = useState<Set<string>>(() => new Set())
  const isControlled = controlled !== undefined
  const selectedIds: ReadonlySet<string> = isControlled ? controlled.selectedIds : internal

  const update: Dispatch<SetStateAction<Set<string>>> = useCallback(
    (updater) => {
      const prev = isControlled ? new Set(controlled.selectedIds) : new Set(internal)
      const next = typeof updater === 'function' ? updater(prev) : new Set(updater)
      if (isControlled) controlled.onSelectionChange(next)
      else setInternal(next)
    },
    [controlled, internal, isControlled],
  )

  // filter-identity reset
  const lastIdentity = useRef(filterIdentity)
  useEffect(() => {
    if (lastIdentity.current !== filterIdentity) {
      lastIdentity.current = filterIdentity
      update(() => new Set<string>())
    }
  }, [filterIdentity, update])

  // page reconcile
  const currentIds = useMemo(() => {
    if (!getRowId) return new Set<string>()
    return new Set(data.map(getRowId))
  }, [data, getRowId])
  const prevIds = useRef<Set<string>>(currentIds)
  const prevPage = useRef<number>(page)
  useEffect(() => {
    if (!selectable || !getRowId) return
    const before = prevIds.current
    const beforePage = prevPage.current
    prevIds.current = currentIds
    prevPage.current = page
    if (beforePage !== page) return
    const stale: string[] = []
    before.forEach((id) => {
      if (!currentIds.has(id) && selectedIds.has(id)) stale.push(id)
    })
    if (stale.length === 0) return
    update((prev) => {
      const next = new Set(prev)
      stale.forEach((id) => next.delete(id))
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIds, selectable, page])

  const toggleRow = useCallback(
    (id: string) => {
      update((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [update],
  )

  const pageSelectionState = useMemo<'all' | 'some' | 'none'>(() => {
    if (!selectable || !getRowId || data.length === 0) return 'none'
    let count = 0
    for (const row of data) if (selectedIds.has(getRowId(row))) count += 1
    if (count === 0) return 'none'
    if (count === data.length) return 'all'
    return 'some'
  }, [data, getRowId, selectable, selectedIds])

  const togglePage = useCallback(() => {
    if (!getRowId) return
    update((prev) => {
      const next = new Set(prev)
      if (pageSelectionState === 'all') for (const row of data) next.delete(getRowId(row))
      else for (const row of data) next.add(getRowId(row))
      return next
    })
  }, [data, getRowId, pageSelectionState, update])

  const cancel = useCallback(() => update(() => new Set<string>()), [update])

  return { selectedIds, toggleRow, togglePage, pageSelectionState, cancel }
}
```

- [ ] **Step 4:** Run — PASS all selection tests.

Run: `moon run orchestrator:test -- src/components/data-table/hooks/use-table-selection`

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/hooks/use-table-selection.ts apps/orchestrator/src/components/data-table/hooks/use-table-selection.test.ts
git commit -m "feat(data-table): extract useTableSelection hook"
```

---

## Phase 3 — Primitives (TDD)

### Task 7: `<Table>` structural primitives

**Files:**
- Create: `apps/orchestrator/src/components/data-table/primitives/Table.tsx`
- Test: `apps/orchestrator/src/components/data-table/primitives/Table.test.tsx`

Pure structural wrappers around the existing shadcn `@/components/ui/table` primitives, plus a `<Table.Root>` that owns the horizontal-scroll container.

- [ ] **Step 1:** Failing test.

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import * as Table from './Table'

describe('Table primitives', () => {
  it('renders Root → Header → HeaderRow → HeaderCell → Body → Row → Cell', () => {
    render(
      <Table.Root aria-label="people">
        <Table.Header>
          <Table.HeaderRow>
            <Table.HeaderCell>Name</Table.HeaderCell>
          </Table.HeaderRow>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Alice</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>,
    )
    expect(screen.getByRole('table', { name: 'people' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument()
  })

  it('Root applies card chrome classes', () => {
    const { container } = render(<Table.Root>{null}</Table.Root>)
    expect(container.querySelector('[data-slot="table-root"]')).toHaveClass(/rounded-lg/)
  })

  it('Row passes data-state for selected', () => {
    render(
      <Table.Root>
        <Table.Body><Table.Row data-state="selected"><Table.Cell>a</Table.Cell></Table.Row></Table.Body>
      </Table.Root>,
    )
    expect(screen.getByRole('cell').closest('tr')).toHaveAttribute('data-state', 'selected')
  })
})
```

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Implement.

```tsx
// primitives/Table.tsx
import type { ReactElement, ReactNode, Ref, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react'
import { useRef } from 'react'

import {
  Table as UiTable,
  TableBody as UiBody,
  TableCell as UiCell,
  TableHead as UiHead,
  TableHeader as UiHeader,
  TableRow as UiRow,
} from '@/components/ui/table'
import { cn } from '@/lib/style/cn'

import { useStickyHorizontalScroll } from '../hooks/use-sticky-horizontal-scroll'
import {
  bodyCell, bodyRow, headerCell, headerRow, scrollContainer, tableCard, tableEl,
} from '../styles'

export interface RootProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabelledBy?: string
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}

export function Root({ children, className, ariaLabelledBy, ref, ...rest }: RootProps): ReactElement {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrolled = useStickyHorizontalScroll(scrollerRef as React.RefObject<HTMLElement>)
  return (
    <div ref={ref} className={cn(tableCard, className)} data-slot="table-root" {...rest}>
      <div ref={scrollerRef} className={scrollContainer} data-scrolled={scrolled ? 'true' : 'false'}>
        <UiTable className={tableEl} aria-labelledby={ariaLabelledBy}>{children}</UiTable>
      </div>
    </div>
  )
}

export function Header({ children, className }: { children: ReactNode; className?: string }) {
  return <UiHeader className={cn(headerRow, className)}>{children}</UiHeader>
}

export function HeaderRow({ children }: { children: ReactNode }) {
  return <UiRow>{children}</UiRow>
}

export interface HeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode
}
export function HeaderCell({ children, className, ...rest }: HeaderCellProps) {
  return <UiHead className={cn(headerCell, className)} {...rest}>{children}</UiHead>
}

export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <UiBody className={className}>{children}</UiBody>
}

export interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode
}
export function Row({ children, className, ...rest }: RowProps) {
  return <UiRow className={cn(bodyRow, className)} {...rest}>{children}</UiRow>
}

export interface CellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode
}
export function Cell({ children, className, ...rest }: CellProps) {
  return <UiCell className={cn(bodyCell, className)} {...rest}>{children}</UiCell>
}
```

- [ ] **Step 4:** Run — PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/primitives/Table.tsx apps/orchestrator/src/components/data-table/primitives/Table.test.tsx
git commit -m "feat(data-table): add Table structural primitives"
```

---

### Task 8: `<SortHeader>` primitive

**Files:**
- Create: `apps/orchestrator/src/components/data-table/primitives/SortHeader.tsx`
- Test: `apps/orchestrator/src/components/data-table/primitives/SortHeader.test.tsx`

Wraps `<Table.HeaderCell>`, renders sortable button, chevron, ARIA. Consumes `useTableSort` API.

- [ ] **Step 1:** Failing test.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SortHeader } from './SortHeader'

describe('SortHeader', () => {
  it('shows label, sortable button, aria-sort=none when inactive', () => {
    render(
      <table><thead><tr>
        <SortHeader sortKey="name" iconState={null} ariaSort="none" onCycle={() => {}}>Name</SortHeader>
      </tr></thead></table>,
    )
    const th = screen.getByRole('columnheader')
    expect(th).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument()
  })

  it('invokes onCycle on click', async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    render(
      <table><thead><tr>
        <SortHeader sortKey="name" iconState={null} ariaSort="none" onCycle={onCycle}>Name</SortHeader>
      </tr></thead></table>,
    )
    await user.click(screen.getByRole('button', { name: /name/i }))
    expect(onCycle).toHaveBeenCalledWith('name')
  })

  it('aria-sort reflects ascending/descending', () => {
    const { rerender } = render(
      <table><thead><tr>
        <SortHeader sortKey="name" iconState="asc" ariaSort="ascending" onCycle={() => {}}>Name</SortHeader>
      </tr></thead></table>,
    )
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
    rerender(
      <table><thead><tr>
        <SortHeader sortKey="name" iconState="desc" ariaSort="descending" onCycle={() => {}}>Name</SortHeader>
      </tr></thead></table>,
    )
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement.

```tsx
// primitives/SortHeader.tsx
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { HeaderCell } from './Table'

export interface SortHeaderProps {
  sortKey: string
  iconState: 'asc' | 'desc' | null
  ariaSort: 'ascending' | 'descending' | 'none'
  onCycle: (sortKey: string) => void
  children: ReactNode
  className?: string
}

export function SortHeader({ sortKey, iconState, ariaSort, onCycle, children, className }: SortHeaderProps) {
  const { t } = useTranslation('data-table')
  const ariaLabel =
    iconState === null ? t('sort.ariaNone')
    : iconState === 'asc' ? t('sort.ariaAscending')
    : t('sort.ariaDescending')
  return (
    <HeaderCell aria-sort={ariaSort} className={className}>
      <button
        type="button"
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onCycle(sortKey)}
      >
        {children}
        {iconState === 'asc' ? <ChevronUp aria-hidden className="size-3" />
          : iconState === 'desc' ? <ChevronDown aria-hidden className="size-3" />
          : <ChevronsUpDown aria-hidden className="size-3 opacity-50" />}
      </button>
    </HeaderCell>
  )
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/primitives/SortHeader.tsx apps/orchestrator/src/components/data-table/primitives/SortHeader.test.tsx
git commit -m "feat(data-table): add SortHeader primitive"
```

---

### Task 9: `<SelectionCell>` + `<SelectionHeader>` primitives

**Files:**
- Create: `apps/orchestrator/src/components/data-table/primitives/SelectionCell.tsx`
- Test: `apps/orchestrator/src/components/data-table/primitives/SelectionCell.test.tsx`

- [ ] **Step 1:** Failing test asserting header checkbox supports indeterminate, row checkbox calls toggle.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SelectionCell, SelectionHeader } from './SelectionCell'

describe('SelectionCell / SelectionHeader', () => {
  it('SelectionHeader renders checkbox reflecting state and calls onToggle', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <table><thead><tr>
        <SelectionHeader state="some" onToggle={onToggle} />
      </tr></thead></table>,
    )
    const cb = screen.getByRole('checkbox', { name: /select page/i })
    expect(cb).toHaveAttribute('aria-checked', 'mixed')
    await user.click(cb)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('SelectionCell renders row checkbox and calls onToggle with id', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <table><tbody><tr>
        <SelectionCell rowId="r-1" checked={false} onToggle={onToggle} />
      </tr></tbody></table>,
    )
    await user.click(screen.getByRole('checkbox', { name: /select row r-1/i }))
    expect(onToggle).toHaveBeenCalledWith('r-1')
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement.

```tsx
// primitives/SelectionCell.tsx
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/style/cn'

import { HeaderCell, Cell } from './Table'
import { stickyFirst } from '../styles'

export interface SelectionHeaderProps {
  state: 'all' | 'some' | 'none'
  onToggle: () => void
  sticky?: boolean
}

export function SelectionHeader({ state, onToggle, sticky = true }: SelectionHeaderProps) {
  return (
    <HeaderCell className={cn('w-10', sticky && stickyFirst)}>
      <Checkbox
        aria-label="Select page"
        checked={state === 'all' ? true : state === 'some' ? 'indeterminate' : false}
        onCheckedChange={() => onToggle()}
      />
    </HeaderCell>
  )
}

export interface SelectionCellProps {
  rowId: string
  checked: boolean
  onToggle: (id: string) => void
  sticky?: boolean
}

export function SelectionCell({ rowId, checked, onToggle, sticky = true }: SelectionCellProps) {
  return (
    <Cell data-stop-row-click="" className={cn(sticky && stickyFirst)}>
      <Checkbox
        aria-label={`Select row ${rowId}`}
        checked={checked}
        onCheckedChange={() => onToggle(rowId)}
        onClick={(e) => e.stopPropagation()}
      />
    </Cell>
  )
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/primitives/SelectionCell.tsx apps/orchestrator/src/components/data-table/primitives/SelectionCell.test.tsx
git commit -m "feat(data-table): add SelectionCell + SelectionHeader primitives"
```

---

### Task 10: `<ExpandToggle>` primitive

**Files:**
- Create: `apps/orchestrator/src/components/data-table/primitives/ExpandToggle.tsx`
- Test: `apps/orchestrator/src/components/data-table/primitives/ExpandToggle.test.tsx`

- [ ] **Step 1:** Failing test for collapsed/expanded states + click behaviour + aria-expanded.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExpandToggle } from './ExpandToggle'

describe('ExpandToggle', () => {
  it('renders right chevron when collapsed', () => {
    render(<table><tbody><tr><ExpandToggle expanded={false} onToggle={() => {}} /></tr></tbody></table>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders down chevron when expanded and calls onToggle', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<table><tbody><tr><ExpandToggle expanded={true} onToggle={onToggle} /></tr></tbody></table>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    await user.click(btn)
    expect(onToggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement, porting current `DataTable.tsx` toggle markup (lines 575–600).

```tsx
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'
import { Cell } from './Table'
import { stickyFirst } from '../styles'

export interface ExpandToggleProps {
  expanded: boolean
  onToggle: () => void
  sticky?: boolean
}

export function ExpandToggle({ expanded, onToggle, sticky = false }: ExpandToggleProps) {
  const { t } = useTranslation('data-table')
  return (
    <Cell data-stop-row-click="" className={cn(sticky && stickyFirst)}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t('expand.toggle')}
        className="inline-flex size-6 items-center justify-center rounded text-foreground-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggle() }
        }}
      >
        {expanded ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
      </button>
    </Cell>
  )
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/primitives/ExpandToggle.tsx apps/orchestrator/src/components/data-table/primitives/ExpandToggle.test.tsx
git commit -m "feat(data-table): add ExpandToggle primitive"
```

---

### Task 11: `<RowActions>` primitive

**Files:**
- Create: `apps/orchestrator/src/components/data-table/primitives/RowActions.tsx`
- Test: `apps/orchestrator/src/components/data-table/primitives/RowActions.test.tsx`

Direct port of `RowActionsMenu` from current `DataTable.tsx` (lines 678–772). Keep menu + confirm dialog behaviour identical — `DataTable.rowActions.test.tsx` continues to exercise this via the convenience wrapper.

- [ ] **Step 1:** Failing test covering: empty actions → null, single action click, destructive style, confirm dialog flow.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { RowActions } from './RowActions'

describe('RowActions', () => {
  it('renders null when actions is empty', () => {
    const { container } = renderWithProviders(<RowActions actions={[]} ariaLabel="More" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens menu and invokes onClick for non-confirm actions', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <RowActions ariaLabel="More" actions={[{ label: 'Edit', onClick }]} />,
    )
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    expect(onClick).toHaveBeenCalled()
  })

  it('confirm action opens dialog, confirm invokes onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <RowActions ariaLabel="More" actions={[{
        label: 'Delete',
        destructive: true,
        onClick,
        confirm: { title: 'Sure?', confirmLabel: 'OK', cancelLabel: 'Cancel' },
      }]} />,
    )
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'OK' }))
    expect(onClick).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Port logic — reference `DataTable.tsx` lines 678–772 in the current code. Replace the inline definition with a standalone exported component:

```tsx
// primitives/RowActions.tsx
import { MoreHorizontal } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/style/cn'

import type { DataTableRowAction } from '../types'

export interface RowActionsProps {
  actions: DataTableRowAction[]
  ariaLabel: string
}

export function RowActions({ actions, ariaLabel }: RowActionsProps): ReactElement | null {
  const { t } = useTranslation('data-table')
  const [pending, setPending] = useState<DataTableRowAction | null>(null)
  if (actions.length === 0) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a, i) => (
            <DropdownMenuItem key={i}
              aria-disabled={a.disabled || undefined}
              data-disabled={a.disabled ? 'true' : undefined}
              onSelect={(e) => {
                if (a.disabled) { e.preventDefault(); return }
                if (a.confirm) { setPending(a); return }
                a.onClick()
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(a.destructive && 'text-destructive focus:text-destructive')}
            >
              {a.icon}<span>{a.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null) }}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          {pending?.confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{pending.confirm.title}</AlertDialogTitle>
                {pending.confirm.description && <AlertDialogDescription>{pending.confirm.description}</AlertDialogDescription>}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{pending.confirm.cancelLabel ?? t('confirm.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(pending.destructive && 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40')}
                  onClick={() => { const a = pending; setPending(null); a.onClick() }}
                >
                  {pending.confirm.confirmLabel ?? t('confirm.ok')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/primitives/RowActions.tsx apps/orchestrator/src/components/data-table/primitives/RowActions.test.tsx
git commit -m "feat(data-table): add RowActions primitive"
```

---

### Task 12: `<LoadingRows>` + `<EmptyRow>` primitives

**Files:**
- Create: `apps/orchestrator/src/components/data-table/primitives/LoadingRows.tsx`
- Create: `apps/orchestrator/src/components/data-table/primitives/EmptyRow.tsx`

No new tests — covered by `DataTable.test.tsx` integration.

- [ ] **Step 1:** Implement `LoadingRows.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

export interface LoadingRowsProps {
  columnCount: number
  rowCount?: number
}

export function LoadingRows({ columnCount, rowCount = 5 }: LoadingRowsProps) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, r) => (
        <TableRow key={r}>
          {Array.from({ length: Math.max(columnCount, 1) }, (_, c) => (
            <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
```

- [ ] **Step 2:** Implement `EmptyRow.tsx`:

```tsx
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/states'
import { TableCell, TableRow } from '@/components/ui/table'

export interface EmptyRowProps {
  columnCount: number
  title: ReactNode
  body?: ReactNode
}

export function EmptyRow({ columnCount, title, body }: EmptyRowProps) {
  return (
    <TableRow>
      <TableCell colSpan={columnCount} className="p-0">
        <EmptyState title={title} body={body} />
      </TableCell>
    </TableRow>
  )
}
```

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/primitives/LoadingRows.tsx apps/orchestrator/src/components/data-table/primitives/EmptyRow.tsx
git commit -m "feat(data-table): add LoadingRows + EmptyRow primitives"
```

---

## Phase 4 — Toolbar primitives

### Task 13: `chips.ts` helper

**Files:**
- Create: `apps/orchestrator/src/components/data-table/toolbar/chips.ts`
- Test: `apps/orchestrator/src/components/data-table/toolbar/chips.test.ts`

Lifts `buildChips` + `findOp` + `primitiveToString` out of the current `DataTableToolbar.tsx` (lines 162–238). Single export: `summariseFilter(def, value): { display: string } | null` — the FilterPill consumes this for its active-state label.

- [ ] **Step 1:** Failing test.

```ts
import { describe, expect, it } from 'vitest'
import { summariseFilter } from './chips'
import type { DataTableFilter } from './Toolbar'

const selectDef: DataTableFilter<{ role: string }> = {
  type: 'select', key: 'role', label: 'Role',
  options: [{ value: 'admin', label: 'Admin' }, { value: 'caregiver', label: 'Caregiver' }],
}

describe('summariseFilter', () => {
  it('select → maps value to option label', () => {
    expect(summariseFilter(selectDef, { op: 'eq', value: 'admin' })).toEqual({ display: 'Admin' })
  })

  it('select → returns null when no `eq` op', () => {
    expect(summariseFilter(selectDef, { op: 'in', value: ['admin'] })).toBeNull()
  })

  it('multi → joins multiple labels by ", "', () => {
    const def: DataTableFilter<{ k: string }> = {
      type: 'multi', key: 'k', label: 'K',
      options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }],
    }
    expect(summariseFilter(def, { op: 'in', value: ['a', 'b'] })).toEqual({ display: 'Alpha, Beta' })
  })

  it('date-range → "from – to" with em-dash placeholders', () => {
    const def: DataTableFilter<{ k: string }> = { type: 'date-range', key: 'k', label: 'D' }
    expect(summariseFilter(def, [{ op: 'gte', value: '2025-01-01' }, { op: 'lte', value: '2025-12-31' }]))
      .toEqual({ display: '2025-01-01 – 2025-12-31' })
  })

  it('text → string passthrough', () => {
    const def: DataTableFilter<{ k: string }> = { type: 'text', key: 'k', label: 'T' }
    expect(summariseFilter(def, { op: 'contains', value: 'hello' })).toEqual({ display: 'hello' })
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement, porting and refactoring from the current toolbar file:

```ts
// toolbar/chips.ts
import type { ListFilter, ListFilterOperator } from '@/hooks/use-data-table-state'

import type { DataTableFilter } from './Toolbar'

export function findOp(
  value: ListFilter | ListFilter[] | undefined,
  op: ListFilterOperator,
): ListFilter | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value.find((f) => f.op === op)
  return value.op === op ? value : undefined
}

function primitiveToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ')
  return String(v)
}

export interface ChipSummary { display: string }

export function summariseFilter<T>(
  def: DataTableFilter<T>,
  value: ListFilter | ListFilter[] | undefined,
): ChipSummary | null {
  if (!value) return null
  switch (def.type) {
    case 'select': {
      const f = findOp(value, 'eq'); if (!f) return null
      const opt = def.options.find((o) => o.value === String(f.value))
      return { display: opt?.label ?? primitiveToString(f.value) }
    }
    case 'multi': {
      const f = findOp(value, 'in'); if (!f) return null
      const values = Array.isArray(f.value) ? f.value : [f.value]
      const display = values.map((v) => def.options.find((o) => o.value === String(v))?.label ?? String(v)).join(', ')
      return { display }
    }
    case 'date-range': {
      const gte = findOp(value, 'gte'); const lte = findOp(value, 'lte')
      if (!gte && !lte) return null
      const from = gte ? primitiveToString(gte.value) : '…'
      const to = lte ? primitiveToString(lte.value) : '…'
      return { display: `${from} – ${to}` }
    }
    case 'text': {
      const f = findOp(value, 'contains'); if (!f) return null
      return { display: primitiveToString(f.value) }
    }
  }
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/toolbar/chips.ts apps/orchestrator/src/components/data-table/toolbar/chips.test.ts
git commit -m "feat(data-table): extract filter chip summariser"
```

---

### Task 14: Filter editors (Select / Multi / DateRange / Text)

**Files:**
- Create: `apps/orchestrator/src/components/data-table/toolbar/editors/SelectEditor.tsx`
- Create: `apps/orchestrator/src/components/data-table/toolbar/editors/MultiEditor.tsx`
- Create: `apps/orchestrator/src/components/data-table/toolbar/editors/DateRangeEditor.tsx`
- Create: `apps/orchestrator/src/components/data-table/toolbar/editors/TextEditor.tsx`
- Create: `apps/orchestrator/src/components/data-table/toolbar/editors/index.ts`
- Test: `apps/orchestrator/src/components/data-table/toolbar/editors/editors.test.tsx`

Direct port of current `SelectFilterEditor` / `MultiFilterEditor` / `DateRangeFilterEditor` / `TextFilterEditor` (lines 240–382 of `DataTableToolbar.tsx`). Renamed exports without the `Filter` middle word.

- [ ] **Step 1:** Failing test (one file, four sub-suites). Cover: each editor renders, emits the right `ListFilter` shape, clearing emits `null`.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'
import { SelectEditor, MultiEditor, DateRangeEditor, TextEditor } from './'

const selectDef = { type: 'select' as const, key: 'role', label: 'Role',
  options: [{ value: 'admin', label: 'Admin' }, { value: 'caregiver', label: 'Caregiver' }] }

describe('SelectEditor', () => {
  it('emits { op: eq, value }', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<SelectEditor def={selectDef} current={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))
    expect(onChange).toHaveBeenCalledWith('role', { op: 'eq', value: 'admin' })
  })
})

describe('MultiEditor', () => {
  it('toggling adds + removes', async () => {
    const def = { type: 'multi' as const, key: 'tag', label: 'Tag',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MultiEditor def={def} current={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    expect(onChange).toHaveBeenLastCalledWith('tag', { op: 'in', value: ['a'] })
    onChange.mockClear()
    render(<MultiEditor def={def} current={{ op: 'in', value: ['a'] }} onChange={onChange} />)
    await user.click(screen.getAllByRole('button', { name: 'A' })[1]!)
    expect(onChange).toHaveBeenLastCalledWith('tag', null)
  })
})

describe('DateRangeEditor', () => {
  it('emits both bounds', async () => {
    const def = { type: 'date-range' as const, key: 'created', label: 'Created' }
    const onChange = vi.fn()
    render(<DateRangeEditor def={def} current={undefined} onChange={onChange} />)
    const inputs = screen.getAllByDisplayValue('')
    await userEvent.type(inputs[0]!, '2025-01-01')
    expect(onChange).toHaveBeenCalled()
  })
})

describe('TextEditor', () => {
  it('emits { op: contains } on input, null on empty', async () => {
    const def = { type: 'text' as const, key: 'q', label: 'Q' }
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TextEditor def={def} current={undefined} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Q')
    await user.type(input, 'hi')
    expect(onChange).toHaveBeenLastCalledWith('q', { op: 'contains', value: 'hi' })
    await user.clear(input)
    expect(onChange).toHaveBeenLastCalledWith('q', null)
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement each editor by lifting the existing inline definitions. Each file is small (~40 LOC). Use the same prop shape:

```ts
export interface EditorProps<T> {
  def: DataTableFilter<T>           // narrowed to the right variant by the caller
  current: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}
```

Editors are direct ports of the named functions in current `DataTableToolbar.tsx`. Keep all UI controls (`Select`, `Input type="date"`, multi-button list, text input) identical to today.

`editors/index.ts`:

```ts
export { SelectEditor } from './SelectEditor'
export { MultiEditor } from './MultiEditor'
export { DateRangeEditor } from './DateRangeEditor'
export { TextEditor } from './TextEditor'
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/toolbar/editors
git commit -m "feat(data-table): extract filter editors per type"
```

---

### Task 15: `<FilterPill>` primitive (the inline pill + popover)

**Files:**
- Create: `apps/orchestrator/src/components/data-table/toolbar/FilterPill.tsx`
- Test: `apps/orchestrator/src/components/data-table/toolbar/FilterPill.test.tsx`

This is the visible inline filter. Renders a pill button; clicking opens a Popover with the right editor; when active, shows `"Label: Value"` + clear `×`.

Uses Radix `Popover` (already in deps via `@radix-ui/react-popover`).

- [ ] **Step 1:** Failing test.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'
import { FilterPill } from './FilterPill'

const def = { type: 'select' as const, key: 'role', label: 'Role',
  options: [{ value: 'admin', label: 'Admin' }, { value: 'caregiver', label: 'Caregiver' }] }

describe('FilterPill', () => {
  it('inactive pill shows the field label only', () => {
    renderWithProviders(<FilterPill def={def} value={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /role/i })).toBeInTheDocument()
  })

  it('active pill shows "Label: Value" with a clear button', () => {
    renderWithProviders(<FilterPill def={def} value={{ op: 'eq', value: 'admin' }} onChange={() => {}} />)
    expect(screen.getByText(/role:/i)).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove role filter/i })).toBeInTheDocument()
  })

  it('clicking inactive pill opens popover with the right editor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FilterPill def={def} value={undefined} onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: /role/i }))
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('clear button emits null', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<FilterPill def={def} value={{ op: 'eq', value: 'admin' }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /remove role filter/i }))
    expect(onChange).toHaveBeenCalledWith('role', null)
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement.

```tsx
// toolbar/FilterPill.tsx
import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/style/cn'
import type { ListFilter } from '@/hooks/use-data-table-state'

import { pillActive, pillEmpty, pillX } from '../styles'
import { summariseFilter } from './chips'
import { SelectEditor, MultiEditor, DateRangeEditor, TextEditor } from './editors'
import type { DataTableFilter } from './Toolbar'

export interface FilterPillProps<T> {
  def: DataTableFilter<T>
  value: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function FilterPill<T>({ def, value, onChange }: FilterPillProps<T>) {
  const { t } = useTranslation('data-table')
  const [open, setOpen] = useState(false)
  const summary = summariseFilter(def, value)
  const active = summary !== null

  const Editor = (() => {
    switch (def.type) {
      case 'select': return <SelectEditor def={def} current={value} onChange={onChange} />
      case 'multi': return <MultiEditor def={def} current={value} onChange={onChange} />
      case 'date-range': return <DateRangeEditor def={def} current={value} onChange={onChange} />
      case 'text': return <TextEditor def={def} current={value} onChange={onChange} />
    }
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('inline-flex items-center', active ? pillActive : pillEmpty)}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1.5">
            <span className="text-primary/80">{def.label}{active ? ':' : ''}</span>
            {active && <span>{summary.display}</span>}
            {!active && <span aria-hidden className="text-[10px] opacity-60">▾</span>}
          </button>
        </PopoverTrigger>
        {active && (
          <button
            type="button"
            aria-label={t('toolbar.filters.pill.clearAria', { label: def.label })}
            className={pillX}
            onClick={() => onChange(def.key, null)}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-72 p-2">
        {Editor}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/toolbar/FilterPill.tsx apps/orchestrator/src/components/data-table/toolbar/FilterPill.test.tsx
git commit -m "feat(data-table): add inline FilterPill primitive"
```

---

### Task 16: `<FilterOverflow>` primitive

**Files:**
- Create: `apps/orchestrator/src/components/data-table/toolbar/FilterOverflow.tsx`
- Test: `apps/orchestrator/src/components/data-table/toolbar/FilterOverflow.test.tsx`

Single popover pill labelled `+N more`, containing a vertical list of editors (one per overflowed def).

- [ ] **Step 1:** Failing test.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'
import { FilterOverflow } from './FilterOverflow'

const defs = [
  { type: 'select' as const, key: 'role', label: 'Role',
    options: [{ value: 'admin', label: 'Admin' }] },
  { type: 'text' as const, key: 'note', label: 'Note' },
]

describe('FilterOverflow', () => {
  it('renders "+N more" with count', () => {
    renderWithProviders(<FilterOverflow defs={defs} filters={{}} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /\+2 more/i })).toBeInTheDocument()
  })

  it('opens popover listing each def label', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FilterOverflow defs={defs} filters={{}} onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: /\+2 more/i }))
    expect(await screen.findByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
  })

  it('returns null when defs is empty', () => {
    const { container } = renderWithProviders(
      <FilterOverflow defs={[]} filters={{}} onChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement.

```tsx
// toolbar/FilterOverflow.tsx
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import type { ListFilter } from '@/hooks/use-data-table-state'

import { pillEmpty } from '../styles'
import { SelectEditor, MultiEditor, DateRangeEditor, TextEditor } from './editors'
import type { DataTableFilter } from './Toolbar'

export interface FilterOverflowProps<T> {
  defs: ReadonlyArray<DataTableFilter<T>>
  filters: Record<string, ListFilter | ListFilter[]>
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function FilterOverflow<T>({ defs, filters, onChange }: FilterOverflowProps<T>) {
  const { t } = useTranslation('data-table')
  if (defs.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger className={pillEmpty}>
        <span>{t('toolbar.filters.more', { count: defs.length })}</span>
        <span aria-hidden className="text-[10px] opacity-60">▾</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {defs.map((def, i) => (
          <Fragment key={def.key}>
            {i > 0 && <Separator className="my-2" />}
            <div className="px-1 text-xs font-medium text-foreground-muted">{def.label}</div>
            {def.type === 'select' && <SelectEditor def={def} current={filters[def.key]} onChange={onChange} />}
            {def.type === 'multi' && <MultiEditor def={def} current={filters[def.key]} onChange={onChange} />}
            {def.type === 'date-range' && <DateRangeEditor def={def} current={filters[def.key]} onChange={onChange} />}
            {def.type === 'text' && <TextEditor def={def} current={filters[def.key]} onChange={onChange} />}
          </Fragment>
        ))}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/toolbar/FilterOverflow.tsx apps/orchestrator/src/components/data-table/toolbar/FilterOverflow.test.tsx
git commit -m "feat(data-table): add FilterOverflow popover primitive"
```

---

### Task 17: `<DebouncedSearch>` primitive

**Files:**
- Create: `apps/orchestrator/src/components/data-table/toolbar/DebouncedSearch.tsx`
- Test: `apps/orchestrator/src/components/data-table/toolbar/DebouncedSearch.test.tsx`

Port lines 110–158 of current toolbar. New styling: icon-prefixed search input.

- [ ] **Step 1:** Failing test asserting 300ms debounce + null-on-empty.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DebouncedSearch } from './DebouncedSearch'

describe('DebouncedSearch', () => {
  it('emits debounced value', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DebouncedSearch value={null} onChange={onChange} placeholder="Search" />)
    await user.type(screen.getByPlaceholderText('Search'), 'foo')
    vi.advanceTimersByTime(300)
    expect(onChange).toHaveBeenLastCalledWith('foo')
    vi.useRealTimers()
  })

  it('emits null when cleared', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DebouncedSearch value="x" onChange={onChange} placeholder="Search" />)
    await user.clear(screen.getByPlaceholderText('Search'))
    vi.advanceTimersByTime(300)
    expect(onChange).toHaveBeenLastCalledWith(null)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement using the new styled input. Logic identical to current `DebouncedSearch`. Skeleton:

```tsx
// toolbar/DebouncedSearch.tsx
import { Search } from 'lucide-react'
import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/style/cn'

import { toolbarSearchBox, toolbarSearchInput } from '../styles'

export interface DebouncedSearchProps {
  value: string | null
  onChange: (next: string | null) => void
  placeholder: string
  className?: string
}

export function DebouncedSearch({ value, onChange, placeholder, className }: DebouncedSearchProps) {
  const [local, setLocal] = React.useState(value ?? '')
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmitted = React.useRef<string | null>(value)

  React.useEffect(() => {
    const incoming = value ?? ''
    if (incoming !== local && (value ?? null) !== lastEmitted.current) setLocal(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  React.useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])

  return (
    <div className={cn(toolbarSearchBox, className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
      <Input
        type="search"
        value={local}
        onChange={(e) => {
          const next = e.target.value
          setLocal(next)
          if (timer.current !== null) clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            const normalised = next.trim().length === 0 ? null : next
            lastEmitted.current = normalised
            onChange(normalised)
          }, 300)
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={toolbarSearchInput}
      />
    </div>
  )
}
```

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/toolbar/DebouncedSearch.tsx apps/orchestrator/src/components/data-table/toolbar/DebouncedSearch.test.tsx
git commit -m "feat(data-table): extract DebouncedSearch primitive"
```

---

### Task 18: `<Toolbar>` root + slots + ClearAll

**Files:**
- Create: `apps/orchestrator/src/components/data-table/toolbar/Toolbar.tsx`
- Create: `apps/orchestrator/src/components/data-table/toolbar/ClearAll.tsx`
- Test: `apps/orchestrator/src/components/data-table/toolbar/Toolbar.test.tsx`

`Toolbar` exports:
- `Toolbar.Root` — flex row with toolbar styles
- `Toolbar.Search`, `Toolbar.Filters`, `Toolbar.Actions` — pure slot wrappers used by `DataTableToolbar` convenience wrapper
- `DataTableFilter<T>` type (moved here from the old file)

`ClearAll` is a tiny button.

- [ ] **Step 1:** Failing test asserting Root renders children inline, ClearAll calls onClick.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Toolbar } from './Toolbar'
import { ClearAll } from './ClearAll'

describe('Toolbar', () => {
  it('Root renders children with toolbar styles', () => {
    render(<Toolbar.Root><span data-testid="x">x</span></Toolbar.Root>)
    expect(screen.getByTestId('x')).toBeInTheDocument()
  })
})

describe('ClearAll', () => {
  it('calls onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ClearAll onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement `Toolbar.tsx`:

```tsx
// toolbar/Toolbar.tsx
import type { ReactNode } from 'react'

import { cn } from '@/lib/style/cn'
import { toolbarRoot } from '../styles'

export type DataTableFilter<T> =
  | { type: 'select'; key: keyof T & string; label: string;
      options: ReadonlyArray<{ value: string; label: string }> }
  | { type: 'multi'; key: keyof T & string; label: string;
      options: ReadonlyArray<{ value: string; label: string }> }
  | { type: 'date-range'; key: keyof T & string; label: string }
  | { type: 'text'; key: keyof T & string; label: string }

function Root({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(toolbarRoot, className)} data-testid="data-table-toolbar">{children}</div>
}

function Search({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-1 min-w-0 items-center', className)}>{children}</div>
}

function Filters({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-2', className)}>{children}</div>
}

export const Toolbar = { Root, Search, Filters, Actions }
```

- [ ] **Step 4:** Implement `ClearAll.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { clearAllBtn } from '../styles'

export interface ClearAllProps { onClick: () => void; className?: string }

export function ClearAll({ onClick, className }: ClearAllProps) {
  const { t } = useTranslation('data-table')
  return (
    <button type="button" onClick={onClick} className={`${clearAllBtn} ${className ?? ''}`}>
      {t('toolbar.filters.clear')}
    </button>
  )
}
```

- [ ] **Step 5:** PASS.

- [ ] **Step 6:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/toolbar/Toolbar.tsx apps/orchestrator/src/components/data-table/toolbar/ClearAll.tsx apps/orchestrator/src/components/data-table/toolbar/Toolbar.test.tsx
git commit -m "feat(data-table): add Toolbar primitives + ClearAll"
```

---

## Phase 5 — Rebuild convenience wrappers

### Task 19: Rebuild `<DataTable>` on primitives

**Files:**
- Modify: `apps/orchestrator/src/components/data-table/DataTable.tsx`

Goal: keep the existing prop signature exactly the same so all `DataTable.*.test.tsx` regression tests continue to pass. Internally composes the new primitives + hooks.

- [ ] **Step 1:** Confirm regression tests currently pass.

Run: `moon run orchestrator:test -- src/components/data-table/DataTable`
Expected: all pass on the old implementation.

- [ ] **Step 2:** Rewrite `DataTable.tsx`. Public surface (`DataTableProps`, `DataTable.BulkBar = BulkBar`) unchanged. Internal body composes:

```tsx
// pseudo-skeleton — full file under ~180 LOC
export function DataTable<T>(props: DataTableProps<T>): ReactElement {
  // ...prop destructure (unchanged)
  // state plumbing (controlled vs internal) unchanged via existing useDataTableState

  const sort = useTableSort({ state, setSort })
  const sel = useTableSelection({ data, getRowId, selectable, controlled, filterIdentity, page: state.page })
  const exp = useTableExpansion()

  // tanstack init (manual modes) — unchanged
  useReactTable<T>(tableOptions)

  if (error) return <ErrorState ... />

  return (
    <RefetchOverlay active={isFetching && !isLoading}>
      <Table.Root ariaLabelledBy={labelledBy}>
        <Table.Header>
          <Table.HeaderRow>
            {hasSelection && <SelectionHeader state={sel.pageSelectionState} onToggle={sel.togglePage} />}
            {hasExpand && <Table.HeaderCell className={cn('w-10', !hasSelection && stickyFirst)}><span className="sr-only">…</span></Table.HeaderCell>}
            {columns.map((col, idx) => {
              const isFirstData = idx === 0 && !hasSelection && !hasExpand
              const isSticky = col.sticky ?? isFirstData
              return col.sortKey
                ? <SortHeader key={col.id} sortKey={col.sortKey}
                    iconState={sort.iconState(col.sortKey)} ariaSort={sort.ariaSort(col.sortKey)}
                    onCycle={sort.cycle} className={cn(col.className, isSticky && stickyFirst)}>
                    {typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header}
                  </SortHeader>
                : <Table.HeaderCell key={col.id} className={cn(col.className, isSticky && stickyFirst)}>
                    {typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header}
                  </Table.HeaderCell>
            })}
            {hasActions && <Table.HeaderCell className="w-10"><span className="sr-only">…</span></Table.HeaderCell>}
          </Table.HeaderRow>
        </Table.Header>
        <Table.Body>
          {isLoading ? <LoadingRows columnCount={totalColumns} />
            : data.length === 0 ? <EmptyRow columnCount={totalColumns} title={t('empty.title')} body={t('empty.body')} />
            : data.map((row) => (
                <RowWithExpansion key={getRowId?.(row) ?? Math.random().toString()} ... />
              ))}
        </Table.Body>
      </Table.Root>
      {hasSelection && (
        <BulkBarContext.Provider value={{ count: sel.selectedIds.size, onCancel: sel.cancel, visible: bulkBarVisible }}>
          {slots.bulkBar}
        </BulkBarContext.Provider>
      )}
    </RefetchOverlay>
  )
}
DataTable.BulkBar = BulkBar
```

Notes:
- `isInteractiveTarget` helper and the `onActivate` row-click handler stay inside this file (DataTable-specific).
- `splitChildren` stays (compound slot routing).
- `RowWithExpansion` is a thin inline component that wraps `<Table.Row>` + optional `<TableRow>` for the expanded row (uses `renderExpandedRow`). Keeps the loop body readable.

- [ ] **Step 3:** Run regression tests.

Run: `moon run orchestrator:test -- src/components/data-table/DataTable`
Expected: all pass identically.

- [ ] **Step 4:** Run full data-table suite.

Run: `moon run orchestrator:test -- src/components/data-table`
Expected: all pass (toolbar tests still using current toolbar implementation pass; rebuilt next).

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/DataTable.tsx
git commit -m "refactor(data-table): rebuild DataTable on primitives + hooks"
```

---

### Task 20: Rebuild `<DataTableToolbar>` convenience wrapper (inline strip)

**Files:**
- Modify: `apps/orchestrator/src/components/data-table/DataTableToolbar.tsx`

Public API stays: `DataTableToolbarProps<T>` with `q`, `filters`, `filterDefs`, callbacks. Internally renders the inline strip — every filter visible as a `<FilterPill>`, overflow into `<FilterOverflow>` beyond 3, `<ClearAll>` shows when any filter is active.

- [ ] **Step 1:** Rewrite the file. Re-exports `DataTableFilter` from `./toolbar/Toolbar` for backwards compat.

```tsx
// DataTableToolbar.tsx — full body under ~120 LOC
import { useTranslation } from 'react-i18next'

import type { ListFilter } from '@/hooks/use-data-table-state'

import { ClearAll } from './toolbar/ClearAll'
import { DebouncedSearch } from './toolbar/DebouncedSearch'
import { FilterOverflow } from './toolbar/FilterOverflow'
import { FilterPill } from './toolbar/FilterPill'
import { Toolbar, type DataTableFilter } from './toolbar/Toolbar'

const INLINE_LIMIT = 3

export type { DataTableFilter }

export interface DataTableToolbarProps<T> {
  q: string | null
  filters: Record<string, ListFilter | ListFilter[]>
  filterDefs?: ReadonlyArray<DataTableFilter<T>>
  onSearchChange: (q: string | null) => void
  onFilterChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
  onClearFilters: () => void
  className?: string
}

export function DataTableToolbar<T>({
  q, filters, filterDefs, onSearchChange, onFilterChange, onClearFilters, className,
}: DataTableToolbarProps<T>) {
  const { t } = useTranslation('data-table')
  const defs = filterDefs ?? []
  const inline = defs.slice(0, INLINE_LIMIT)
  const overflow = defs.slice(INLINE_LIMIT)
  const hasActive = defs.some((def) => filters[def.key] !== undefined)

  return (
    <Toolbar.Root className={className}>
      <Toolbar.Search>
        <DebouncedSearch value={q} onChange={onSearchChange} placeholder={t('toolbar.search.placeholder')} />
      </Toolbar.Search>
      <Toolbar.Filters>
        {inline.map((def) => (
          <FilterPill key={def.key} def={def} value={filters[def.key]} onChange={onFilterChange} />
        ))}
        <FilterOverflow defs={overflow} filters={filters} onChange={onFilterChange} />
        {hasActive && <ClearAll onClick={onClearFilters} />}
      </Toolbar.Filters>
    </Toolbar.Root>
  )
}

export { DataTableToolbar as Toolbar }
```

- [ ] **Step 2:** Delete old internal code (`SearchSlot`, `FiltersSlot`, `ActionsSlot`, `FilterDropdown`, slot-routing, all `*FilterEditor`, `buildChips`) — replaced by primitives.

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/DataTableToolbar.tsx
git commit -m "refactor(data-table): rebuild toolbar as inline filter strip"
```

---

### Task 21: Rewrite toolbar tests

**Files:**
- Modify: `apps/orchestrator/src/components/data-table/DataTableToolbar.filters.test.tsx`
- Modify: `apps/orchestrator/src/components/data-table/DataTableToolbar.search.test.tsx`

- [ ] **Step 1:** Run existing toolbar tests — expect FAIL (they assert the old `FilterDropdown` button which no longer exists).

Run: `moon run orchestrator:test -- src/components/data-table/DataTableToolbar`

- [ ] **Step 2:** Rewrite `DataTableToolbar.filters.test.tsx` so each test renders the convenience wrapper and asserts:

```tsx
import { renderWithProviders } from '@/test/renderWithProviders'
import userEvent from '@testing-library/user-event'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTableToolbar, type DataTableFilter } from './DataTableToolbar'

interface Row { role: string; status: string; created: string; priority: string; team: string }

const defs: ReadonlyArray<DataTableFilter<Row>> = [
  { type: 'select', key: 'role', label: 'Role',
    options: [{ value: 'admin', label: 'Admin' }, { value: 'caregiver', label: 'Caregiver' }] },
  { type: 'select', key: 'status', label: 'Status',
    options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  { type: 'date-range', key: 'created', label: 'Created' },
  { type: 'text', key: 'priority', label: 'Priority' },
  { type: 'multi', key: 'team', label: 'Team', options: [{ value: 't1', label: 'T1' }] },
]

describe('DataTableToolbar — inline filter strip', () => {
  it('renders first 3 filter defs as inline pills (always visible)', () => {
    renderWithProviders(
      <DataTableToolbar<Row>
        q={null} filters={{}} filterDefs={defs}
        onSearchChange={() => {}} onFilterChange={() => {}} onClearFilters={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /role/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^created/i })).toBeInTheDocument()
  })

  it('collapses defs beyond 3 into "+N more"', () => {
    renderWithProviders(<DataTableToolbar<Row> q={null} filters={{}} filterDefs={defs}
      onSearchChange={() => {}} onFilterChange={() => {}} onClearFilters={() => {}} />)
    expect(screen.getByRole('button', { name: /\+2 more/i })).toBeInTheDocument()
  })

  it('active filter pill shows "Label: Value" and × clears', async () => {
    const onFilterChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<DataTableToolbar<Row>
      q={null} filters={{ role: { op: 'eq', value: 'admin' } }} filterDefs={defs}
      onSearchChange={() => {}} onFilterChange={onFilterChange} onClearFilters={() => {}} />)
    expect(screen.getByText(/role:/i)).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /remove role filter/i }))
    expect(onFilterChange).toHaveBeenCalledWith('role', null)
  })

  it('"Clear all" appears only when any filter active', () => {
    const { rerender } = renderWithProviders(
      <DataTableToolbar<Row> q={null} filters={{}} filterDefs={defs}
        onSearchChange={() => {}} onFilterChange={() => {}} onClearFilters={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull()
    rerender(
      <DataTableToolbar<Row> q={null} filters={{ role: { op: 'eq', value: 'admin' } }} filterDefs={defs}
        onSearchChange={() => {}} onFilterChange={() => {}} onClearFilters={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
  })

  it('clicking inline pill opens popover with editor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DataTableToolbar<Row> q={null} filters={{}} filterDefs={defs}
      onSearchChange={() => {}} onFilterChange={() => {}} onClearFilters={() => {}} />)
    await user.click(screen.getByRole('button', { name: /role/i }))
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3:** Update `DataTableToolbar.search.test.tsx` to drive `<DebouncedSearch>` via the new toolbar layout. Keep the assertions about debounce + null-on-empty.

- [ ] **Step 4:** Run.

Run: `moon run orchestrator:test -- src/components/data-table/DataTableToolbar`
Expected: all pass.

- [ ] **Step 5:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/DataTableToolbar.filters.test.tsx apps/orchestrator/src/components/data-table/DataTableToolbar.search.test.tsx
git commit -m "test(data-table): cover inline filter strip in toolbar suite"
```

---

## Phase 6 — Visual restyle of remaining surfaces

### Task 22: Restyle `<BulkBar>` + `<DataTablePagination>`

**Files:**
- Modify: `apps/orchestrator/src/components/data-table/BulkBar.tsx`
- Modify: `apps/orchestrator/src/components/data-table/DataTablePagination.tsx`

No API change — only className updates so they read like the new card. Use tokens from `styles.ts` where applicable. Pagination footer adopts `tableFooter` styling (sits below the card via the existing wrapper composition).

- [ ] **Step 1:** Read each file, apply class updates only. No logic change.
- [ ] **Step 2:** Run.

Run: `moon run orchestrator:test -- src/components/data-table`
Expected: all pass (class-only changes).

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/BulkBar.tsx apps/orchestrator/src/components/data-table/DataTablePagination.tsx
git commit -m "style(data-table): align BulkBar + pagination chrome"
```

---

### Task 23: Add `accent` slot to `FilterableListPage`

**Files:**
- Modify: `apps/orchestrator/src/components/list/FilterableListPage.tsx`

Optional mint blur orb mirroring `UserHero`. Opt-in via new `accent?: boolean` prop (default false).

- [ ] **Step 1:** Add prop:

```tsx
export type FilterableListPageProps = {
  // ...existing
  accent?: boolean
}

export function FilterableListPage<_T>({ accent = false, ... }: FilterableListPageProps): ReactElement {
  // ...
  return (
    <>
      <PageHeader title={title} sub={description} />
      <div className="relative flex flex-col gap-3 px-6 pb-8">
        {accent && (
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-4 size-40 rounded-full bg-primary/10 blur-3xl" />
        )}
        {/* ...existing children */}
      </div>
    </>
  )
}
```

- [ ] **Step 2:** No new test; visual addition.

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/src/components/list/FilterableListPage.tsx
git commit -m "feat(list): add opt-in accent orb to FilterableListPage"
```

---

## Phase 7 — Public surface

### Task 24: Update `index.ts` to export new primitives + hooks

**Files:**
- Modify: `apps/orchestrator/src/components/data-table/index.ts`

- [ ] **Step 1:** Add re-exports — keep existing exports, add:

```ts
// hooks
export { useTableSelection } from './hooks/use-table-selection'
export { useTableExpansion } from './hooks/use-table-expansion'
export { useTableSort } from './hooks/use-table-sort'
export { useStickyHorizontalScroll } from './hooks/use-sticky-horizontal-scroll'

// primitives
export * as Table from './primitives/Table'
export { SortHeader } from './primitives/SortHeader'
export { SelectionCell, SelectionHeader } from './primitives/SelectionCell'
export { ExpandToggle } from './primitives/ExpandToggle'
export { RowActions } from './primitives/RowActions'
export { LoadingRows } from './primitives/LoadingRows'
export { EmptyRow } from './primitives/EmptyRow'

// toolbar primitives
export { Toolbar } from './toolbar/Toolbar'
export type { DataTableFilter } from './toolbar/Toolbar'
export { DebouncedSearch } from './toolbar/DebouncedSearch'
export { FilterPill } from './toolbar/FilterPill'
export { FilterOverflow } from './toolbar/FilterOverflow'
export { ClearAll } from './toolbar/ClearAll'
export * from './toolbar/editors'
```

Keep existing exports for `DataTable`, `DataTablePagination`, `DataTableToolbar`, `BulkBar`, `defineColumn`, types.

- [ ] **Step 2:** Run typecheck.

Run: `moon run orchestrator:typecheck`
Expected: 0 errors.

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/src/components/data-table/index.ts
git commit -m "feat(data-table): export primitives + hooks"
```

---

## Phase 8 — Consumer migration

### Task 25: Migrate `UserListPage` to primitive composition

**Files:**
- Modify: `apps/orchestrator/src/modules/user/components/UserListPage.tsx`

Switch from `<DataTable>` + `<DataTableToolbar>` to direct primitive composition. Keeps all existing behaviour (filters, search, row click, row actions, pagination).

- [ ] **Step 1:** Read current file (already explored).

- [ ] **Step 2:** Rewrite the return:

```tsx
return (
  <FilterableListPage<UserRow>
    title={t('list.title')}
    description={t('list.sub')}
    primaryAction={<Button asChild><Link to="/admin/users/new"><Plus className="size-4" />{t('list.cta.create')}</Link></Button>}
    filters={
      <Toolbar.Root>
        <Toolbar.Search>
          <DebouncedSearch value={state.q} onChange={(q) => dispatch.setSearch(q)} placeholder={t('toolbar.search.placeholder')} />
        </Toolbar.Search>
        <Toolbar.Filters>
          {filterDefs.slice(0, 3).map((def) => (
            <FilterPill key={def.key} def={def}
              value={state.filters[def.key]}
              onChange={(field, f) => f === null ? dispatch.clearFilter(field) : dispatch.setFilter(field, f)} />
          ))}
          <FilterOverflow defs={filterDefs.slice(3)} filters={state.filters}
            onChange={(field, f) => f === null ? dispatch.clearFilter(field) : dispatch.setFilter(field, f)} />
          {Object.keys(state.filters).length > 0 && <ClearAll onClick={() => dispatch.clearAll()} />}
        </Toolbar.Filters>
      </Toolbar.Root>
    }
    table={
      <>
        <Table.Root ariaLabelledBy={undefined}>
          <Table.Header>
            <Table.HeaderRow>
              {columns.map((col, idx) => col.sortKey
                ? <SortHeader key={col.id}
                    sortKey={col.sortKey}
                    iconState={sort.iconState(col.sortKey)}
                    ariaSort={sort.ariaSort(col.sortKey)}
                    onCycle={sort.cycle}
                    className={cn(col.className, idx === 0 && stickyFirst)}>
                    {typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header}
                  </SortHeader>
                : <Table.HeaderCell key={col.id} className={cn(col.className, idx === 0 && stickyFirst)}>
                    {typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header}
                  </Table.HeaderCell>)}
              <Table.HeaderCell className="w-10" aria-hidden />
            </Table.HeaderRow>
          </Table.Header>
          <Table.Body>
            {isLoading ? <LoadingRows columnCount={columns.length + 1} />
              : rows.length === 0 ? <EmptyRow columnCount={columns.length + 1} title={t('empty.title')} />
              : rows.map((row) => (
                  <Table.Row key={row.id}
                    role="button" tabIndex={0}
                    onClick={() => void navigate({ to: '/admin/users/$userId', params: { userId: row.id } })}
                    className="cursor-pointer">
                    {columns.map((col, idx) => (
                      <Table.Cell key={col.id} className={cn(col.className, idx === 0 && stickyFirst)}>
                        {col.cell(row)}
                      </Table.Cell>
                    ))}
                    <Table.Cell data-stop-row-click="" className="text-right">
                      <RowActions actions={rowActions(row)} ariaLabel={t('actions.menu.aria')} />
                    </Table.Cell>
                  </Table.Row>
                ))}
          </Table.Body>
        </Table.Root>
        <DataTablePagination
          page={state.page}
          pageSize={state.pageSize}
          totalPages={data?.total_pages ?? 1}
          onPageChange={(p) => dispatch.setPage(p)}
          onPageSizeChange={(s) => dispatch.setPageSize(s)}
        />
      </>
    }
    emptyState={...}
    isEmpty={isEmpty}
  />
)
```

Add at the top of the component body, alongside the other state plumbing:

```tsx
const sort = useTableSort({
  state: { orderBy: state.orderBy, order: state.order },
  setSort: (orderBy, order) => dispatch.reset({ ...state, orderBy, order }),
})
```

Imports updated to pull from `@/components/data-table` index.

- [ ] **Step 3:** Run page-level tests (existing).

Run: `moon run orchestrator:test -- src/modules/user`
Expected: pass.

- [ ] **Step 4:** Commit.

```bash
git add apps/orchestrator/src/modules/user/components/UserListPage.tsx
git commit -m "refactor(users): compose UserListPage with data-table primitives"
```

---

### Task 26: Migrate `routes/_auth/users.tsx`

**Files:**
- Modify: `apps/orchestrator/src/routes/_auth/users.tsx`

Same shape as Task 25. This route duplicates UserListPage today — keep both in lockstep so behaviour matches across surfaces (consolidation is a separate follow-up flagged in the spec).

- [ ] **Step 1:** Read current file.

Run: `cat apps/orchestrator/src/routes/_auth/users.tsx`

- [ ] **Step 2:** Apply the same composition pattern as Task 25.

- [ ] **Step 3:** Run.

Run: `moon run orchestrator:test -- src/routes/_auth/-users`
Expected: pass.

- [ ] **Step 4:** Commit.

```bash
git add apps/orchestrator/src/routes/_auth/users.tsx
git commit -m "refactor(routes): compose users route with data-table primitives"
```

---

### Task 27: Migrate `routes/_auth/patients/index.tsx`

**Files:**
- Modify: `apps/orchestrator/src/routes/_auth/patients/index.tsx`

- [ ] **Step 1:** Read current file, apply same pattern as Task 25 (different columns + filters but same shape).

- [ ] **Step 2:** Run.

Run: `moon run orchestrator:test -- src/routes/_auth/patients`
Expected: pass.

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/src/routes/_auth/patients/index.tsx
git commit -m "refactor(routes): compose patients route with data-table primitives"
```

---

## Phase 9 — Cleanup

### Task 28: Remove obsolete i18n key

**Files:**
- Modify: each `apps/orchestrator/public/locales/<lang>/data-table.json`

- [ ] **Step 1:** Remove `toolbar.filters.button` from each locale file.

- [ ] **Step 2:** Search to confirm zero references in code.

Run: `grep -r "toolbar.filters.button" apps/orchestrator/src`
Expected: no matches.

- [ ] **Step 3:** Commit.

```bash
git add apps/orchestrator/public/locales
git commit -m "chore(i18n): drop unused toolbar.filters.button key"
```

---

### Task 29: Full verify

**Files:** none

- [ ] **Step 1:** Lint.

Run: `moon run orchestrator:lint`
Expected: clean.

- [ ] **Step 2:** Typecheck.

Run: `moon run orchestrator:typecheck`
Expected: 0 errors.

- [ ] **Step 3:** Full test suite.

Run: `moon run orchestrator:test`
Expected: all green.

- [ ] **Step 4:** Manual smoke test in dev server.

Run: `moon run orchestrator:dev`

Walk through:
- `/admin/users` — pills render visible (Role / Status / Created), `+N more` if applicable, search debounces, clicking pill opens popover editor, active pill shows `Label: Value ×`, `×` clears, `Clear all` shows when any filter set
- Sort by clicking column header (asc → desc → unset)
- Row click navigates to `/admin/users/:id`
- Row actions menu opens, deactivate confirm modal works
- Pagination footer renders, page change works
- `/patients` — same checks
- `/users` (duplicate route) — same checks

- [ ] **Step 5:** No commit needed (verification only).

---

### Task 30: Final commit pass

**Files:** none

- [ ] **Step 1:** Confirm clean tree.

Run: `git status`
Expected: nothing to commit.

- [ ] **Step 2:** Tag log review.

Run: `git log --oneline main..HEAD`
Expected: linear list of focused semantic commits.

---

## Self-review (writer's notes)

**Spec coverage** — every spec section maps to tasks:
- Inline filter strip → Tasks 13–18, 20, 21
- Decomposition → Tasks 3–12, 19, 20
- Visual refresh → Tasks 1 (styles), 7–18 (consume), 22 (BulkBar/Pagination), 23 (accent)
- Consumer migration (all three) → Tasks 25–27
- i18n changes → Tasks 2, 28
- Testing strategy → unit tests per hook (3–6), primitive tests (7–18), regression suite preserved (19), toolbar tests rewritten (21)
- Verification → Task 29

**Type consistency:**
- `useTableSort` API consistent across hook def (Task 3) and all consumer call sites (Tasks 19, 25–27).
- `DataTableFilter<T>` defined in `toolbar/Toolbar.tsx` (Task 18), re-exported by `DataTableToolbar.tsx` (Task 20) and `index.ts` (Task 24). Used by Tasks 13–17, 25–27.
- `summariseFilter` signature consistent between Task 13 (definition) and Task 15 (consumer).
- `EditorProps<T>` shape consistent: `{ def, current, onChange }` everywhere (Tasks 14, 15, 16).

**Placeholder scan:** No "TBD", "TODO", or "implement later" lines. Where the code shown is partial (Task 19 `DataTable.tsx`, Task 25 `UserListPage.tsx`), the missing pieces are explicit references to current code locations the implementer reads in place.
