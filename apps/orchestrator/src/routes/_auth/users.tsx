import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable, DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
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

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<UserRow>(
    USERS_LIST_PATH,
    query,
  )

  const displayError = error ? new Error(t('toast.error')) : null

  const rowActions = useUserRowActions({
    currentUserId: session.data?.id ?? '',
    onView: (row) => {
      void navigate({ to: '/users/$user_id', params: { user_id: row.id } })
    },
  })

  return (
    <>
      <PageHeader title={t('title')} sub={t('sub')} />
      <div className="flex flex-col gap-4 px-6 pb-8">
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <DataTableToolbar<UserRow>
            q={state.q}
            filters={state.filters}
            filterDefs={filterDefs}
            onSearchChange={(q) => dispatch.setSearch(q)}
            onFilterChange={(field, filter) => {
              if (filter === null) dispatch.clearFilter(field)
              else dispatch.setFilter(field, filter)
            }}
            onClearFilters={() => dispatch.clearAll()}
          />
          <DataTable<UserRow>
            data={data?.items ?? []}
            columns={columns}
            getRowId={(row) => row.id}
            isLoading={isLoading}
            isFetching={isFetching}
            error={displayError}
            onRetry={() => void refetch()}
            state={state}
            onStateChange={(next) => dispatch.reset(next)}
            rowActions={rowActions}
            onRowClick={(row) =>
              void navigate({ to: '/users/$user_id', params: { user_id: row.id } })
            }
            realtimeTopic="users"
            ariaLabelledBy="page-title"
          />
          <DataTablePagination
            page={state.page}
            pageSize={state.pageSize}
            totalPages={data?.total_pages ?? 1}
            onPageChange={(page) => dispatch.setPage(page)}
            onPageSizeChange={(pageSize) => dispatch.setPageSize(pageSize)}
          />
        </div>
      </div>
    </>
  )
}
