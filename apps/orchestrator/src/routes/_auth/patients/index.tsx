import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable, DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { FilterableListPage } from '@/components/list/FilterableListPage'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { api } from '@/lib/api/client'
import { useSoftDeletePatient } from '@/modules/patient/api'
import {
  patientColumns,
  patientFilters,
  patientRowActions,
} from '@/modules/patient/components/PatientsColumns'
import type { OrganisationOption, PatientRow } from '@/modules/patient/types'

export const Route = createFileRoute('/_auth/patients/')({
  component: PatientsOverviewRoute,
})

async function fetchOrganisations(): Promise<OrganisationOption[]> {
  const result = await api.GET('/organisations', {})
  if (!result.data) {
    throw new Error(
      `Failed to fetch organisations (${result.response.status} ${result.response.statusText})`,
    )
  }
  return result.data.items
}

function PatientsOverviewRoute(): ReactElement {
  const { t, i18n } = useTranslation('patients')
  const navigate = useNavigate()
  const [state, dispatch] = useRouteSearchTableState()

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

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<PatientRow>(
    '/patients',
    query,
  )

  const organisationsQuery = useQuery({
    queryKey: ['organisations', 'list'] as const,
    queryFn: fetchOrganisations,
    staleTime: 5 * 60 * 1000,
  })
  const organisations = useMemo(() => organisationsQuery.data ?? [], [organisationsQuery.data])
  const organisationsById = useMemo(
    () => new Map(organisations.map((o) => [o.id, o])),
    [organisations],
  )

  const softDelete = useSoftDeletePatient()

  const columns = useMemo(
    () => patientColumns({ t, locale: i18n.language, organisationsById }),
    [t, i18n.language, organisationsById],
  )
  const filterDefs = useMemo(() => patientFilters({ t, organisations }), [t, organisations])
  const rowActions = useMemo(
    () =>
      patientRowActions({
        t,
        onDelete: (row) => {
          if (
            window.confirm(
              t('actions.deleteConfirm', { name: `${row.family_name}, ${row.given_name}` }),
            )
          ) {
            softDelete.mutate(row.id)
          }
        },
      }),
    [t, softDelete],
  )

  return (
    <FilterableListPage<PatientRow>
      title={t('page.title')}
      description={t('page.sub')}
      filters={
        <DataTableToolbar<PatientRow>
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
      }
      table={
        <>
          <DataTable<PatientRow>
            data={data?.items ?? []}
            columns={columns}
            getRowId={(p) => p.id}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={() => void refetch()}
            selectable={false}
            rowActions={rowActions}
            onRowClick={(row) =>
              void navigate({ to: '/patients/$patientId', params: { patientId: row.id } })
            }
            realtimeTopic="patients"
            state={state}
            onStateChange={(next) => dispatch.reset(next)}
          />
          <DataTablePagination
            page={state.page}
            pageSize={state.pageSize}
            totalPages={data?.total_pages ?? 1}
            onPageChange={(p) => dispatch.setPage(p)}
            onPageSizeChange={(s) => dispatch.setPageSize(s)}
          />
        </>
      }
    />
  )
}
