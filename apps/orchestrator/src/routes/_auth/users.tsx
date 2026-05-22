import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableToolbar,
  EmptyRow,
  LoadingRows,
  RowActions,
  SortHeader,
  Table,
  useTableSort,
} from '@/components/data-table'
import { stickyFirst } from '@/components/data-table/styles'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/states'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { cn } from '@/lib/style/cn'
import { useSession } from '@/modules/auth/hooks'
import {
  useUserColumns,
  useUserFilterDefs,
  useUserRowActions,
} from '@/modules/user/components/UserColumns'
import { USERS_LIST_PATH } from '@/modules/user/keys'
import type { UserRow } from '@/modules/user/schemas'

export const Route = createFileRoute('/_auth/users')({
  component: UsersPage,
})

function UsersPage(): ReactElement {
  const { t } = useTranslation('users')
  const { t: tTable } = useTranslation('data-table')
  const navigate = useNavigate()
  const session = useSession()
  const [state, dispatch] = useRouteSearchTableState()
  const columns = useUserColumns()
  const filterDefs = useUserFilterDefs()

  const query = {
    page: state.page,
    page_size: state.pageSize,
    q: state.q,
    order_by: state.orderBy,
    order: state.order,
    filters: state.filters,
  }

  const { data, isLoading, error, refetch } = usePaginatedQuery<UserRow>(USERS_LIST_PATH, query)

  const rowActions = useUserRowActions({
    currentUserId: session.data?.id ?? '',
    onView: (row) => {
      void navigate({ to: '/users/$user_id', params: { user_id: row.id } })
    },
  })

  const sort = useTableSort({
    state: { orderBy: state.orderBy, order: state.order },
    setSort: (orderBy, order) => {
      if (orderBy === null) dispatch.clearSort()
      else dispatch.setSort(orderBy, order)
    },
  })

  const rows = data?.items ?? []
  const totalColumns = columns.length + 1
  const onFilter = (field: string, f: Parameters<typeof dispatch.setFilter>[1] | null) => {
    if (f === null) dispatch.clearFilter(field)
    else dispatch.setFilter(field, f)
  }

  if (error) {
    return (
      <>
        <PageHeader title={t('title')} sub={t('sub')} />
        <div className="px-6 pb-8">
          <ErrorState
            title={t('toast.error')}
            onRetry={() => void refetch()}
            retryLabel={tTable('error.retry')}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('title')} sub={t('sub')} />
      <div className="flex flex-col gap-3 px-6 pb-8">
        <DataTableToolbar<UserRow>
          q={state.q}
          filters={state.filters}
          filterDefs={filterDefs}
          onSearchChange={(q) => dispatch.setSearch(q)}
          onFilterChange={onFilter}
          onClearFilters={() => dispatch.clearAll()}
        />
        <Table.Root ariaLabelledBy="page-title">
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
                    void navigate({ to: '/users/$user_id', params: { user_id: row.id } })
                  }
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    void navigate({ to: '/users/$user_id', params: { user_id: row.id } })
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
                    <RowActions actions={rowActions(row)} ariaLabel={tTable('actions.menu.aria')} />
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
          onPageChange={(page) => dispatch.setPage(page)}
          onPageSizeChange={(pageSize) => dispatch.setPageSize(pageSize)}
        />
      </div>
    </>
  )
}
