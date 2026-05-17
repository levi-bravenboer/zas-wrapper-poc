import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef as TanstackColumnDef,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react'
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState, ErrorState, RefetchOverlay } from '@/components/states'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDataTableState, type DataTableState } from '@/hooks/use-data-table-state'
import { cn } from '@/lib/style/cn'

import { BulkBarContext } from './bulk-bar-context'
import { BulkBar } from './BulkBar'
import {
  type BrandedColumnDef,
  type DataTableRowAction,
  type GetRowId,
  type RealtimeTopic,
} from './types'

export interface DataTableProps<T> {
  /** Row data for the current page. */
  data: ReadonlyArray<T>
  /** Column definitions (use `defineColumn` from `./columns`). */
  columns: ReadonlyArray<BrandedColumnDef<T>>
  /** Total page count from the server. Used by the parallel pagination component. */
  pageCount?: number
  /** Stable row id getter — required when `selectable`, `onRowClick`, or `renderExpandedRow` is set. */
  getRowId?: GetRowId<T>

  /** Loading first-fetch indicator. */
  isLoading?: boolean
  /** Background refetch indicator. */
  isFetching?: boolean
  /** Hard error from the data source. */
  error?: Error | null
  /** Retry callback used by `ErrorState`. */
  onRetry?: () => void

  /** Controlled state. Provide both `state` and `onStateChange` for controlled mode. */
  state?: DataTableState
  onStateChange?: (next: DataTableState) => void

  /** Multi-select. */
  selectable?: boolean
  selectedIds?: ReadonlySet<string>
  onSelectionChange?: (next: Set<string>) => void

  /** Per-row action menu. */
  rowActions?: (row: T) => DataTableRowAction[]

  /** Row click navigation handler. Activates `role="button"` + keyboard activation. */
  onRowClick?: (row: T) => void

  /** Expandable rows. Returning `null` hides the chevron for that row. */
  renderExpandedRow?: (row: T) => ReactNode

  /**
   * Documentation-only metadata: the realtime resource topic this list expects
   * to be invalidated by. No subscription is opened by the table; the topic must
   * match the leading element of the query key used by the consumer's hook.
   */
  realtimeTopic?: RealtimeTopic

  /** Accessible name for the table (rendered into the `<caption>`). */
  caption?: ReactNode
  /** ID of an element labelling the table (alternative to `caption`). */
  ariaLabelledBy?: string

  /** Compound slot children (`<DataTable.BulkBar>...</DataTable.BulkBar>` etc.). */
  children?: ReactNode

  className?: string
  /** Outer wrapper ref (React 19 — regular prop). */
  ref?: React.Ref<HTMLDivElement>
}

interface InternalChildren {
  bulkBar: ReactNode | null
}

const PAGE_CHECKED = { all: true, some: 'indeterminate', none: false } as const

const SORT_INFO = {
  none: { aria: 'none', labelKey: 'sort.ariaNone' },
  asc: { aria: 'ascending', labelKey: 'sort.ariaAscending' },
  desc: { aria: 'descending', labelKey: 'sort.ariaDescending' },
} as const

/** Splits compound-slot children into their named buckets. */
function splitChildren(children: ReactNode): InternalChildren {
  const bulkBar =
    Children.toArray(children).find((c) => isValidElement(c) && c.type === BulkBar) ?? null
  return { bulkBar }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  // NOTE: do not include `[role="button"]` — the row itself carries that role
  // when `onRowClick` is set, which would make every click inside the row look
  // interactive. Nested action buttons are real `<button>` elements and are
  // already caught by the `button` selector.
  return !!target.closest(
    'button, a, input, select, textarea, [role="menu"], [role="menuitem"], [role="checkbox"], [data-stop-row-click]',
  )
}

export function DataTable<T>(props: DataTableProps<T>): ReactElement {
  const {
    data,
    columns,
    getRowId,
    isLoading = false,
    isFetching = false,
    error,
    onRetry,
    state: controlledState,
    onStateChange,
    selectable = false,
    selectedIds: controlledSelectedIds,
    onSelectionChange,
    rowActions,
    onRowClick,
    renderExpandedRow,
    caption,
    ariaLabelledBy,
    children,
    className,
    ref,
  } = props

  const { t } = useTranslation('data-table')
  const tableId = useId()

  // -------------------------- state (controlled vs internal) --------------------------
  const isControlled = controlledState != null && onStateChange != null
  const [internalState, internalDispatch] = useDataTableState()
  const state = isControlled ? controlledState : internalState

  const setSort = useCallback(
    (orderBy: string | null, order: 'asc' | 'desc') => {
      if (isControlled) {
        onStateChange({
          ...controlledState,
          orderBy,
          order,
        })
      } else if (orderBy === null) {
        internalDispatch.clearSort()
      } else {
        internalDispatch.setSort(orderBy, order)
      }
    },
    [controlledState, internalDispatch, isControlled, onStateChange],
  )

  // -------------------------- selection --------------------------
  const [internalSelected, setInternalSelected] = useState<Set<string>>(() => new Set<string>())
  const selectionIsControlled = controlledSelectedIds != null
  const selectedIds = selectionIsControlled
    ? (controlledSelectedIds as ReadonlySet<string>)
    : internalSelected

  const updateSelection: Dispatch<SetStateAction<Set<string>>> = useCallback(
    (updater) => {
      const previous = selectionIsControlled
        ? new Set(controlledSelectedIds ?? [])
        : new Set(internalSelected)
      const next = typeof updater === 'function' ? updater(previous) : new Set(updater)
      if (selectionIsControlled) {
        onSelectionChange?.(next)
      } else {
        setInternalSelected(next)
      }
    },
    [controlledSelectedIds, internalSelected, onSelectionChange, selectionIsControlled],
  )

  // Auto-clear selection when filter/search/sort identity changes.
  const filterIdentity = useMemo(
    () =>
      JSON.stringify({
        q: state.q,
        orderBy: state.orderBy,
        order: state.order,
        filters: state.filters,
      }),
    [state.q, state.orderBy, state.order, state.filters],
  )
  const lastIdentityRef = useRef(filterIdentity)
  useEffect(() => {
    if (lastIdentityRef.current !== filterIdentity) {
      lastIdentityRef.current = filterIdentity
      updateSelection(() => new Set<string>())
    }
  }, [filterIdentity, updateSelection])

  // Reconcile selection after data refetch: drop ids not in the current page.
  // We only drop *current-page rows that disappeared*; ids that simply belong
  // to other pages must persist (cross-page selection requirement). To keep
  // page navigation from looking like a refetch, the reconcile only fires when
  // the previous render was on the same `page` value.
  const currentPageIds = useMemo(() => {
    if (!getRowId) return new Set<string>()
    return new Set(data.map((row) => getRowId(row)))
  }, [data, getRowId])
  const previousPageIdsRef = useRef<Set<string>>(currentPageIds)
  const previousPageNumberRef = useRef<number>(state.page)
  useEffect(() => {
    if (!selectable || !getRowId) return
    const previousIds = previousPageIdsRef.current
    const previousPage = previousPageNumberRef.current
    previousPageIdsRef.current = currentPageIds
    previousPageNumberRef.current = state.page
    // Page navigation: skip reconcile so cross-page selection persists.
    if (previousPage !== state.page) return
    // For each id we previously rendered on this page but no longer do, drop it.
    const stale = [...previousIds].filter((id) => !currentPageIds.has(id) && selectedIds.has(id))
    if (!stale.length) return
    updateSelection((prev) => {
      const next = new Set(prev)
      stale.forEach((id) => next.delete(id))
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIds, selectable, state.page])

  const toggleRowSelected = useCallback(
    (id: string) => {
      updateSelection((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [updateSelection],
  )

  const pageSelectionState = useMemo<'all' | 'some' | 'none'>(() => {
    if (!selectable || !getRowId || !data.length) return 'none'
    const selectedOnPage = data.filter((r) => selectedIds.has(getRowId(r))).length
    if (!selectedOnPage) return 'none'
    if (selectedOnPage === data.length) return 'all'
    return 'some'
  }, [data, getRowId, selectable, selectedIds])

  const togglePageSelection = useCallback(() => {
    if (!getRowId) return
    updateSelection((prev) => {
      const next = new Set(prev)
      const op = pageSelectionState === 'all' ? 'delete' : 'add'
      data.forEach((row) => next[op](getRowId(row)))
      return next
    })
  }, [data, getRowId, pageSelectionState, updateSelection])

  const cancelSelection = useCallback(() => {
    updateSelection(() => new Set<string>())
  }, [updateSelection])

  // -------------------------- expansion --------------------------
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  // -------------------------- tanstack table (internal data plumbing) --------------------------
  const tableColumns = useMemo<TanstackColumnDef<T>[]>(
    () =>
      columns.map<TanstackColumnDef<T>>((c) => ({
        id: c.id,
        header: () => (typeof c.header === 'function' ? c.header({ columnId: c.id }) : c.header),
        cell: ({ row }) => c.cell(row.original),
      })),
    [columns],
  )

  const tableOptions = useMemo(() => {
    const base = {
      data: data as T[],
      columns: tableColumns,
      getCoreRowModel: getCoreRowModel(),
      manualPagination: true as const,
      manualSorting: true as const,
      manualFiltering: true as const,
    }
    return getRowId ? { ...base, getRowId: (row: T) => getRowId(row) } : base
  }, [data, tableColumns, getRowId])

  // TanStack Table is wired with manual pagination/sorting/filtering so the
  // server stays the source of truth. We do not currently read the resulting
  // `table` instance — the render path uses `data`/`columns` directly — but
  // initialising it keeps the door open for row-virtualisation and meta APIs
  // without a breaking refactor.
  useReactTable<T>(tableOptions)

  // -------------------------- column ordering: select | expand | data | actions --------------------------
  const hasSelection = selectable && !!getRowId
  const hasExpand = !!renderExpandedRow && !!getRowId
  const hasActions = !!rowActions

  // Total visual column count (used for `colSpan` on the expanded row).
  const totalColumns =
    columns.length + (hasSelection ? 1 : 0) + (hasExpand ? 1 : 0) + (hasActions ? 1 : 0)

  // -------------------------- compound slots --------------------------
  const slots = useMemo(() => splitChildren(children), [children])
  const bulkBarVisible = hasSelection && !!selectedIds.size
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Pad the scrolling container while the BulkBar is visible so the bar does
  // not overlap the last row.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.style.paddingBottom = bulkBarVisible ? '4rem' : ''
  }, [bulkBarVisible])

  // -------------------------- sort cycle: asc -> desc -> unset --------------------------
  const cycleSort = useCallback(
    (sortKey: string) => {
      if (state.orderBy !== sortKey) {
        setSort(sortKey, 'asc')
      } else if (state.order === 'asc') {
        setSort(sortKey, 'desc')
      } else {
        setSort(null, 'asc')
      }
    },
    [setSort, state.order, state.orderBy],
  )

  // -------------------------- horizontal scroll shadow for sticky first col --------------------------
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollLeft > 0)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // -------------------------- rendering --------------------------
  if (error) {
    return (
      <div ref={ref} className={cn('flex flex-col', className)}>
        <ErrorState
          title={error.message || t('error.title')}
          {...(onRetry ? { onRetry, retryLabel: t('error.retry') } : {})}
        />
      </div>
    )
  }

  const captionId = caption ? `${tableId}-caption` : undefined
  const labelledBy = ariaLabelledBy ?? captionId

  const stickyFirstClasses =
    'sticky left-0 z-10 bg-background data-[scrolled=true]:shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.15)]'
  const scrolledAttr = scrolled ? 'true' : 'false'

  return (
    <RefetchOverlay active={isFetching && !isLoading}>
      <div ref={ref} className={cn('flex flex-col', className)}>
        <div
          ref={scrollerRef}
          className="relative w-full overflow-auto"
          data-scrolled={scrolledAttr}
        >
          <table
            className="w-full caption-bottom text-sm"
            aria-labelledby={labelledBy}
            data-realtime-topic={props.realtimeTopic}
          >
            {caption && <TableCaption id={captionId}>{caption}</TableCaption>}
            <TableHeader>
              <TableRow>
                {hasSelection && (
                  <TableHead
                    data-scrolled={scrolledAttr}
                    className={cn('w-10', stickyFirstClasses)}
                  >
                    <Checkbox
                      aria-label="Select page"
                      checked={PAGE_CHECKED[pageSelectionState]}
                      onCheckedChange={() => togglePageSelection()}
                    />
                  </TableHead>
                )}
                {hasExpand && (
                  <TableHead
                    className={cn('w-10', !hasSelection && stickyFirstClasses)}
                    data-scrolled={scrolledAttr}
                  >
                    <span className="sr-only">{t('expand.toggle')}</span>
                  </TableHead>
                )}
                {columns.map((col, idx) => {
                  const isFirstData = idx === 0 && !hasSelection && !hasExpand
                  const isSticky = col.sticky ?? isFirstData
                  const sortable = !!col.sortKey
                  const isSorted = sortable && state.orderBy === col.sortKey
                  const sortKey: 'none' | 'asc' | 'desc' | null = !sortable
                    ? null
                    : !isSorted
                      ? 'none'
                      : state.order
                  const sortInfo = sortKey ? SORT_INFO[sortKey] : null
                  const ariaSort = sortInfo?.aria
                  const ariaSortLabel = sortInfo ? t(sortInfo.labelKey) : undefined
                  return (
                    <TableHead
                      key={col.id}
                      aria-sort={ariaSort}
                      data-scrolled={scrolledAttr}
                      className={cn(col.className, isSticky && stickyFirstClasses)}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                          onClick={() => cycleSort(col.sortKey as string)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              cycleSort(col.sortKey as string)
                            }
                          }}
                          aria-label={ariaSortLabel}
                        >
                          {typeof col.header === 'function'
                            ? col.header({ columnId: col.id })
                            : col.header}
                          <SortIcon state={isSorted ? state.order : null} />
                        </button>
                      ) : typeof col.header === 'function' ? (
                        col.header({ columnId: col.id })
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  )
                })}
                {hasActions && (
                  <TableHead className="w-10">
                    <span className="sr-only">{t('actions.menu.aria')}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <LoadingRows columnCount={totalColumns} />
              ) : !data.length ? (
                <TableRow>
                  <TableCell colSpan={totalColumns} className="p-0">
                    <EmptyState title={t('empty.title')} body={t('empty.body')} />
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => {
                  const rowId = getRowId ? getRowId(row) : undefined
                  const expanded = hasExpand && rowId != null && expandedId === rowId
                  const clickable = !!onRowClick
                  const onActivate = (
                    e:
                      | ReactMouseEvent<HTMLTableRowElement>
                      | ReactKeyboardEvent<HTMLTableRowElement>,
                  ) => {
                    if (!onRowClick) return
                    if (isInteractiveTarget(e.target)) return
                    if ('key' in e) {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                    }
                    onRowClick(row)
                  }
                  return (
                    <Fragment key={rowId ?? Math.random().toString()}>
                      <TableRow
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onClick={clickable ? onActivate : undefined}
                        onKeyDown={clickable ? onActivate : undefined}
                        className={cn(clickable && 'cursor-pointer')}
                        data-state={rowId && selectedIds.has(rowId) ? 'selected' : undefined}
                      >
                        {hasSelection && rowId != null && (
                          <TableCell
                            data-stop-row-click=""
                            data-scrolled={scrolledAttr}
                            className={stickyFirstClasses}
                          >
                            <Checkbox
                              aria-label={`Select row ${rowId}`}
                              checked={selectedIds.has(rowId)}
                              onCheckedChange={() => toggleRowSelected(rowId)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                        )}
                        {hasExpand && rowId != null && (
                          <TableCell
                            data-stop-row-click=""
                            data-scrolled={scrolledAttr}
                            className={cn(!hasSelection && stickyFirstClasses)}
                          >
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={t('expand.toggle')}
                              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded(rowId)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  toggleExpanded(rowId)
                                }
                              }}
                            >
                              {expanded ? (
                                <ChevronDown aria-hidden="true" className="size-4" />
                              ) : (
                                <ChevronRight aria-hidden="true" className="size-4" />
                              )}
                            </button>
                          </TableCell>
                        )}
                        {columns.map((col, idx) => {
                          const isFirstData = idx === 0 && !hasSelection && !hasExpand
                          const isSticky = col.sticky ?? isFirstData
                          return (
                            <TableCell
                              key={col.id}
                              data-scrolled={scrolledAttr}
                              className={cn(col.className, isSticky && stickyFirstClasses)}
                            >
                              {col.cell(row)}
                            </TableCell>
                          )
                        })}
                        {hasActions && (
                          <TableCell data-stop-row-click="" className="text-right">
                            <RowActionsMenu
                              actions={rowActions ? rowActions(row) : []}
                              ariaLabel={t('actions.menu.aria')}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                      {expanded && renderExpandedRow && (
                        <TableRow data-slot="expanded-row">
                          <TableCell colSpan={totalColumns} className="bg-muted/30">
                            {renderExpandedRow(row)}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </table>
        </div>
        {hasSelection && (
          <BulkBarContext.Provider
            value={{
              count: selectedIds.size,
              onCancel: cancelSelection,
              visible: bulkBarVisible,
            }}
          >
            {slots.bulkBar}
          </BulkBarContext.Provider>
        )}
      </div>
    </RefetchOverlay>
  )
}

function SortIcon({ state }: { state: 'asc' | 'desc' | null }): ReactElement {
  if (state === 'asc') return <ChevronUp aria-hidden="true" className="size-3" />
  if (state === 'desc') return <ChevronDown aria-hidden="true" className="size-3" />
  return <ChevronsUpDown aria-hidden="true" className="size-3 opacity-50" />
}

function LoadingRows({ columnCount }: { columnCount: number }): ReactElement {
  // Five skeleton rows is enough to telegraph "loading" without locking layout
  // to a specific page size.
  const rows = [0, 1, 2, 3, 4]
  return (
    <>
      {rows.map((r) => (
        <TableRow key={r}>
          {Array.from({ length: Math.max(columnCount, 1) }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function RowActionsMenu({
  actions,
  ariaLabel,
}: {
  actions: DataTableRowAction[]
  ariaLabel: string
}): ReactElement | null {
  const { t } = useTranslation('data-table')
  const [pending, setPending] = useState<DataTableRowAction | null>(null)

  if (!actions.length) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
            }}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a, i) => (
            <DropdownMenuItem
              key={i}
              aria-disabled={a.disabled || undefined}
              data-disabled={a.disabled ? 'true' : undefined}
              onSelect={(e) => {
                if (a.disabled) {
                  e.preventDefault()
                  return
                }
                if (a.confirm) {
                  setPending(a)
                  return
                }
                a.onClick()
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(a.destructive && 'text-destructive focus:text-destructive')}
            >
              {a.icon}
              <span>{a.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          {pending?.confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{pending.confirm.title}</AlertDialogTitle>
                {pending.confirm.description ? (
                  <AlertDialogDescription>{pending.confirm.description}</AlertDialogDescription>
                ) : null}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {pending.confirm.cancelLabel ?? t('confirm.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    pending.destructive &&
                      'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40',
                  )}
                  onClick={() => {
                    const action = pending
                    setPending(null)
                    action.onClick()
                  }}
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

DataTable.BulkBar = BulkBar
