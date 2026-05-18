import { Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, UserMinus } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ClearAll,
  DebouncedSearch,
  defineColumn,
  EmptyRow,
  FilterOverflow,
  FilterPill,
  LoadingRows,
  RowActions,
  SortHeader,
  Table,
  Toolbar,
  DataTablePagination,
  useTableSort,
  type BrandedColumnDef,
  type DataTableFilter,
  type DataTableRowAction,
} from '@/components/data-table'
import { stickyFirst } from '@/components/data-table/styles'
import { FilterableListPage } from '@/components/list/FilterableListPage'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { cn } from '@/lib/style/cn'
import { initials } from '@/lib/utils/initials'
import { useSession } from '@/modules/auth/hooks'

import { formatTimestamp } from '../format'
import { useSetUserActive } from '../hooks'
import { USERS_LIST_PATH } from '../keys'
import type { UserRow } from '../schemas'

import { RoleBadge } from './RoleBadge'
import { StatusPill } from './StatusPill'

export function UserListPage(): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const { t: tTable } = useTranslation('data-table')
  const navigate = useNavigate()
  const session = useSession()
  const currentUserId = session.data?.id ?? ''
  const [state, dispatch] = useRouteSearchTableState()
  const setActive = useSetUserActive()

  const query = useMemo(
    () => ({
      page: state.page,
      page_size: state.pageSize,
      q: state.q ?? null,
      order_by: state.orderBy ?? null,
      order: state.order,
      filters: state.filters,
    }),
    [state],
  )

  const { data, isLoading, error } = usePaginatedQuery<UserRow>(USERS_LIST_PATH, query)

  const columns = useMemo<ReadonlyArray<BrandedColumnDef<UserRow>>>(
    () => [
      defineColumn<UserRow>({
        id: 'display_name',
        header: t('list.column.display_name'),
        sortKey: 'display_name',
        sticky: true,
        cell: (row) => (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="sm">
              <AvatarFallback>{initials(row.display_name)}</AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-foreground">{row.display_name}</span>
          </div>
        ),
      }),
      defineColumn<UserRow>({
        id: 'email',
        header: t('list.column.email'),
        sortKey: 'email',
        cell: (row) => <span className="text-muted-foreground">{row.email}</span>,
      }),
      defineColumn<UserRow>({
        id: 'role',
        header: t('list.column.role'),
        sortKey: 'role',
        cell: (row) => <RoleBadge role={row.role} withIcon />,
      }),
      defineColumn<UserRow>({
        id: 'is_active',
        header: t('list.column.is_active'),
        sortKey: 'is_active',
        cell: (row) => <StatusPill active={row.is_active} />,
      }),
      defineColumn<UserRow>({
        id: 'created_at',
        header: t('list.column.created_at'),
        sortKey: 'created_at',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">{formatTimestamp(row.created_at)}</span>
        ),
      }),
    ],
    [t],
  )

  const filterDefs = useMemo<ReadonlyArray<DataTableFilter<UserRow>>>(
    () => [
      {
        type: 'select',
        key: 'role',
        label: t('list.filter.role'),
        options: [
          { value: 'admin', label: t('role.admin') },
          { value: 'caregiver', label: t('role.caregiver') },
        ],
      },
      {
        type: 'select',
        key: 'is_active',
        label: t('list.filter.is_active'),
        options: [
          { value: 'true', label: t('active.true') },
          { value: 'false', label: t('active.false') },
        ],
      },
    ],
    [t],
  )

  const rowActions = useMemo(
    () =>
      (row: UserRow): DataTableRowAction[] => {
        const isSelf = row.id === currentUserId
        return [
          {
            label: t('list.row.action.edit'),
            icon: <Pencil className="h-4 w-4" aria-hidden />,
            onClick: () =>
              void navigate({
                to: '/admin/users/$userId/edit',
                params: { userId: row.id },
              }),
          },
          {
            label: t('list.row.action.deactivate'),
            icon: <UserMinus className="h-4 w-4" aria-hidden />,
            destructive: true,
            disabled: isSelf || !row.is_active,
            onClick: () => {
              setActive.mutate(
                { userId: row.id, is_active: false },
                {
                  onSuccess: () => toast.success(t('toast.deactivated')),
                  onError: () => toast.error(t('toast.error')),
                },
              )
            },
            confirm: {
              title: t('deactivate.title'),
              description: t('deactivate.description'),
              confirmLabel: t('deactivate.confirm'),
            },
          },
        ]
      },
    [currentUserId, navigate, setActive, t],
  )

  const sort = useTableSort({
    state: { orderBy: state.orderBy, order: state.order },
    setSort: (orderBy, order) => {
      if (orderBy === null) dispatch.clearSort()
      else dispatch.setSort(orderBy, order)
    },
  })

  const rows = data?.items ?? []
  const isEmpty = !isLoading && rows.length === 0 && !error
  const totalColumns = columns.length + 1
  const inlineDefs = filterDefs.slice(0, 3)
  const overflowDefs = filterDefs.slice(3)
  const onFilter = (field: string, f: Parameters<typeof dispatch.setFilter>[1] | null) => {
    if (f === null) dispatch.clearFilter(field)
    else dispatch.setFilter(field, f)
  }

  return (
    <FilterableListPage<UserRow>
      title={t('list.title')}
      description={t('list.sub')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/users/new">
            <Plus className="size-4" aria-hidden />
            {t('list.cta.create')}
          </Link>
        </Button>
      }
      filters={
        <Toolbar.Root>
          <Toolbar.Search>
            <DebouncedSearch
              value={state.q}
              onChange={(q) => dispatch.setSearch(q)}
              placeholder={tTable('toolbar.search.placeholder')}
            />
          </Toolbar.Search>
          <Toolbar.Filters>
            {inlineDefs.map((def) => (
              <FilterPill
                key={def.key}
                def={def}
                value={state.filters[def.key]}
                onChange={onFilter}
              />
            ))}
            <FilterOverflow defs={overflowDefs} filters={state.filters} onChange={onFilter} />
            {Object.keys(state.filters).length > 0 && (
              <ClearAll onClick={() => dispatch.clearAll()} />
            )}
          </Toolbar.Filters>
        </Toolbar.Root>
      }
      table={
        <>
          <Table.Root>
            <Table.Header>
              <Table.HeaderRow>
                {columns.map((col, idx) => {
                  const headerNode =
                    typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header
                  const cls = cn(col.className, (col.sticky ?? idx === 0) && stickyFirst)
                  if (col.sortKey) {
                    return (
                      <SortHeader
                        key={col.id}
                        sortKey={col.sortKey}
                        iconState={sort.iconState(col.sortKey)}
                        ariaSort={sort.ariaSort(col.sortKey)}
                        onCycle={sort.cycle}
                        className={cls}
                      >
                        {headerNode}
                      </SortHeader>
                    )
                  }
                  return (
                    <Table.HeaderCell key={col.id} className={cls}>
                      {headerNode}
                    </Table.HeaderCell>
                  )
                })}
                <Table.HeaderCell className="w-10">
                  <span className="sr-only">{tTable('actions.menu.aria')}</span>
                </Table.HeaderCell>
              </Table.HeaderRow>
            </Table.Header>
            <Table.Body>
              {isLoading ? (
                <LoadingRows columnCount={totalColumns} />
              ) : rows.length === 0 ? (
                <EmptyRow
                  columnCount={totalColumns}
                  title={tTable('empty.title')}
                  body={tTable('empty.body')}
                />
              ) : (
                rows.map((row) => (
                  <Table.Row
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      void navigate({
                        to: '/admin/users/$userId',
                        params: { userId: row.id },
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      void navigate({
                        to: '/admin/users/$userId',
                        params: { userId: row.id },
                      })
                    }}
                    className="cursor-pointer"
                  >
                    {columns.map((col, idx) => (
                      <Table.Cell
                        key={col.id}
                        className={cn(col.className, (col.sticky ?? idx === 0) && stickyFirst)}
                      >
                        {col.cell(row)}
                      </Table.Cell>
                    ))}
                    <Table.Cell data-stop-row-click="" className="text-right">
                      <RowActions
                        actions={rowActions(row)}
                        ariaLabel={tTable('actions.menu.aria')}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
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
      emptyState={
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-sm text-muted-foreground">
          <Badge variant="soft">{t('list.empty')}</Badge>
        </div>
      }
      isEmpty={isEmpty}
    />
  )
}
