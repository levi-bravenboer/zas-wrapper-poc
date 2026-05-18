import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ClearAll,
  DataTablePagination,
  DebouncedSearch,
  EmptyRow,
  FilterOverflow,
  FilterPill,
  LoadingRows,
  RowActions,
  SortHeader,
  Table,
  Toolbar,
  useTableSort,
} from '@/components/data-table'
import { stickyFirst } from '@/components/data-table/styles'
import { FilterableListPage } from '@/components/list/FilterableListPage'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/style/cn'
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
  const { t: tTable } = useTranslation('data-table')
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

  const { data, isLoading } = usePaginatedQuery<PatientRow>('/patients', query)

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

  const sort = useTableSort({
    state: { orderBy: state.orderBy, order: state.order },
    setSort: (orderBy, order) => {
      if (orderBy === null) dispatch.clearSort()
      else dispatch.setSort(orderBy, order)
    },
  })

  const rows = data?.items ?? []
  const totalColumns = columns.length + 1
  const inlineDefs = filterDefs.slice(0, 3)
  const overflowDefs = filterDefs.slice(3)
  const onFilter = (field: string, f: Parameters<typeof dispatch.setFilter>[1] | null) => {
    if (f === null) dispatch.clearFilter(field)
    else dispatch.setFilter(field, f)
  }

  return (
    <FilterableListPage<PatientRow>
      title={t('page.title')}
      description={t('page.sub')}
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
                      void navigate({ to: '/patients/$patientId', params: { patientId: row.id } })
                    }
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
    />
  )
}
