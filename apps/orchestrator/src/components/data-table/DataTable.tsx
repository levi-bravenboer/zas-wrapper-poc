import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef as TanstackColumnDef,
} from '@tanstack/react-table'
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState, RefetchOverlay } from '@/components/states'
import { useDataTableState, type DataTableState } from '@/hooks/use-data-table-state'
import { cn } from '@/lib/style/cn'

import { BulkBarContext } from './bulk-bar-context'
import { BulkBar } from './BulkBar'
import { useTableExpansion } from './hooks/use-table-expansion'
import { useTableSelection } from './hooks/use-table-selection'
import { useTableSort } from './hooks/use-table-sort'
import { EmptyRow } from './primitives/EmptyRow'
import { ExpandToggle } from './primitives/ExpandToggle'
import { LoadingRows } from './primitives/LoadingRows'
import { RowActions } from './primitives/RowActions'
import { SelectionCell, SelectionHeader } from './primitives/SelectionCell'
import { SortHeader } from './primitives/SortHeader'
import { Body, Cell, Header, HeaderCell, HeaderRow, Root, Row } from './primitives/Table'
import { bodyRowClickable, stickyFirst } from './styles'
import {
  type BrandedColumnDef,
  type DataTableRowAction,
  type GetRowId,
  type RealtimeTopic,
} from './types'

export interface DataTableProps<T> {
  data: ReadonlyArray<T>
  columns: ReadonlyArray<BrandedColumnDef<T>>
  pageCount?: number
  getRowId?: GetRowId<T>

  isLoading?: boolean
  isFetching?: boolean
  error?: Error | null
  onRetry?: () => void

  state?: DataTableState
  onStateChange?: (next: DataTableState) => void

  selectable?: boolean
  selectedIds?: ReadonlySet<string>
  onSelectionChange?: (next: Set<string>) => void

  rowActions?: (row: T) => DataTableRowAction[]
  onRowClick?: (row: T) => void
  renderExpandedRow?: (row: T) => ReactNode

  realtimeTopic?: RealtimeTopic

  caption?: ReactNode
  ariaLabelledBy?: string

  children?: ReactNode
  className?: string
  ref?: React.Ref<HTMLDivElement>
}

interface InternalChildren {
  bulkBar: ReactNode | null
}

function splitChildren(children: ReactNode): InternalChildren {
  let bulkBar: ReactNode | null = null
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === BulkBar) bulkBar = child
  })
  return { bulkBar }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, [role="menu"], [role="menuitem"], [role="checkbox"], [data-stop-row-click]',
    ),
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
  const isControlled = controlledState !== undefined && onStateChange !== undefined
  const [internalState, internalDispatch] = useDataTableState()
  const state = isControlled ? controlledState : internalState

  const setSort = useCallback(
    (orderBy: string | null, order: 'asc' | 'desc') => {
      if (isControlled) {
        onStateChange({ ...controlledState, orderBy, order })
      } else if (orderBy === null) {
        internalDispatch.clearSort()
      } else {
        internalDispatch.setSort(orderBy, order)
      }
    },
    [controlledState, internalDispatch, isControlled, onStateChange],
  )

  const sort = useTableSort({ state, setSort })

  // -------------------------- selection --------------------------
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

  const sel = useTableSelection({
    data,
    ...(getRowId ? { getRowId } : {}),
    selectable,
    ...(controlledSelectedIds !== undefined && onSelectionChange
      ? { controlled: { selectedIds: controlledSelectedIds, onSelectionChange } }
      : {}),
    filterIdentity,
    page: state.page,
  })

  // -------------------------- expansion --------------------------
  const exp = useTableExpansion()

  // -------------------------- tanstack init (manual modes) --------------------------
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
  useReactTable<T>(tableOptions)

  // -------------------------- column ordering & flags --------------------------
  const hasSelection = selectable && Boolean(getRowId)
  const hasExpand = Boolean(renderExpandedRow) && Boolean(getRowId)
  const hasActions = Boolean(rowActions)
  const totalColumns =
    columns.length + (hasSelection ? 1 : 0) + (hasExpand ? 1 : 0) + (hasActions ? 1 : 0)

  // -------------------------- compound slots --------------------------
  const slots = useMemo(() => splitChildren(children), [children])
  const bulkBarVisible = hasSelection && sel.selectedIds.size > 0

  // -------------------------- rendering --------------------------
  if (error) {
    return (
      <div ref={ref} className={cn('flex flex-col', className)}>
        <ErrorState
          title={error.message || 'Error'}
          {...(onRetry ? { onRetry, retryLabel: t('error.retry') } : {})}
        />
      </div>
    )
  }

  const captionId = caption ? `${tableId}-caption` : undefined
  const labelledBy = ariaLabelledBy ?? captionId

  return (
    <RefetchOverlay active={isFetching && !isLoading}>
      <div ref={ref} className={cn('flex flex-col', className)}>
        <Root {...(labelledBy ? { ariaLabelledBy: labelledBy } : {})}>
          {caption ? <caption id={captionId}>{caption}</caption> : null}
          <Header>
            <HeaderRow>
              {hasSelection ? (
                <SelectionHeader state={sel.pageSelectionState} onToggle={sel.togglePage} />
              ) : null}
              {hasExpand ? (
                <HeaderCell className={cn('w-10', !hasSelection && stickyFirst)}>
                  <span className="sr-only">{t('expand.toggle')}</span>
                </HeaderCell>
              ) : null}
              {columns.map((col, idx) => {
                const isFirstData = idx === 0 && !hasSelection && !hasExpand
                const isSticky = col.sticky ?? isFirstData
                const headerNode =
                  typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header
                if (col.sortKey) {
                  return (
                    <SortHeader
                      key={col.id}
                      sortKey={col.sortKey}
                      iconState={sort.iconState(col.sortKey)}
                      ariaSort={sort.ariaSort(col.sortKey)}
                      onCycle={sort.cycle}
                      className={cn(col.className, isSticky && stickyFirst)}
                    >
                      {headerNode}
                    </SortHeader>
                  )
                }
                return (
                  <HeaderCell key={col.id} className={cn(col.className, isSticky && stickyFirst)}>
                    {headerNode}
                  </HeaderCell>
                )
              })}
              {hasActions ? (
                <HeaderCell className="w-10">
                  <span className="sr-only">{t('actions.menu.aria')}</span>
                </HeaderCell>
              ) : null}
            </HeaderRow>
          </Header>
          <Body>
            {isLoading ? (
              <LoadingRows columnCount={totalColumns} />
            ) : data.length === 0 ? (
              <EmptyRow
                columnCount={totalColumns}
                title={t('empty.title')}
                body={t('empty.body')}
              />
            ) : (
              data.map((row) => {
                const rowId = getRowId ? getRowId(row) : undefined
                const expanded = hasExpand && rowId !== undefined && exp.expandedId === rowId
                const clickable = Boolean(onRowClick)
                const onActivate = (
                  e: ReactMouseEvent<HTMLTableRowElement> | ReactKeyboardEvent<HTMLTableRowElement>,
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
                    <Row
                      {...(clickable ? { role: 'button', tabIndex: 0 } : {})}
                      onClick={clickable ? onActivate : undefined}
                      onKeyDown={clickable ? onActivate : undefined}
                      className={cn(clickable && bodyRowClickable)}
                      data-state={rowId && sel.selectedIds.has(rowId) ? 'selected' : undefined}
                    >
                      {hasSelection && rowId !== undefined ? (
                        <SelectionCell
                          rowId={rowId}
                          checked={sel.selectedIds.has(rowId)}
                          onToggle={sel.toggleRow}
                        />
                      ) : null}
                      {hasExpand && rowId !== undefined ? (
                        <ExpandToggle
                          expanded={expanded}
                          onToggle={() => exp.toggle(rowId)}
                          sticky={!hasSelection}
                        />
                      ) : null}
                      {columns.map((col, idx) => {
                        const isFirstData = idx === 0 && !hasSelection && !hasExpand
                        const isSticky = col.sticky ?? isFirstData
                        return (
                          <Cell key={col.id} className={cn(col.className, isSticky && stickyFirst)}>
                            {col.cell(row)}
                          </Cell>
                        )
                      })}
                      {hasActions ? (
                        <Cell data-stop-row-click="" className="text-right">
                          <RowActions
                            actions={rowActions ? rowActions(row) : []}
                            ariaLabel={t('actions.menu.aria')}
                          />
                        </Cell>
                      ) : null}
                    </Row>
                    {expanded && renderExpandedRow ? (
                      <Row data-slot="expanded-row">
                        <Cell colSpan={totalColumns} className="bg-surface-1/60">
                          {renderExpandedRow(row)}
                        </Cell>
                      </Row>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </Body>
        </Root>
        {hasSelection ? (
          <BulkBarContext.Provider
            value={{ count: sel.selectedIds.size, onCancel: sel.cancel, visible: bulkBarVisible }}
          >
            {slots.bulkBar}
          </BulkBarContext.Provider>
        ) : null}
      </div>
    </RefetchOverlay>
  )
}

DataTable.BulkBar = BulkBar
