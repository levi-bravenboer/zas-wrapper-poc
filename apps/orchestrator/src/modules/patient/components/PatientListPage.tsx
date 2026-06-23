import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type BrandedColumnDef,
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  defineColumn,
} from '@/components/data-table'
import { FilterableListPage } from '@/components/list/FilterableListPage'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { useCan } from '@/modules/auth/permissions'

import { PATIENTS_PATH } from '../api'
import type { PatientRow } from '../types'

import { CreatePatientDialog } from './CreatePatientDialog'

export function PatientListPage(): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const { t: tTable } = useTranslation('data-table')
  const navigate = useNavigate()
  const [state, dispatch] = useRouteSearchTableState()
  const canCreate = useCan('patient.create')
  const [createOpen, setCreateOpen] = useState(false)

  const query = {
    page: state.page,
    page_size: state.pageSize,
    q: state.q,
    order_by: state.orderBy,
    order: state.order,
    filters: state.filters,
  }

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<PatientRow>(
    PATIENTS_PATH,
    query,
  )

  const columns = useMemo<ReadonlyArray<BrandedColumnDef<PatientRow>>>(
    () => [
      defineColumn<PatientRow>({
        id: 'name',
        header: t('list.column.name'),
        sticky: true,
        cell: (row) => {
          const name = `${row.family_name}, ${row.given_name}`
          return (
            <div className="flex min-w-0 items-center gap-3">
              <PersonAvatar size="sm" name={name} tintId={row.id} />
              <span className="truncate font-medium text-foreground">{name}</span>
            </div>
          )
        },
      }),
      defineColumn<PatientRow>({
        id: 'birth_date',
        header: t('list.column.birth_date'),
        cell: (row) => (
          <span className="text-muted-foreground">
            {formatDateOrDash(row.birth_date, i18n.language)}
          </span>
        ),
      }),
      defineColumn<PatientRow>({
        id: 'gender',
        header: t('list.column.gender'),
        cell: (row) => (
          <span className="text-muted-foreground">
            {row.gender ? t(`gender.${row.gender}`) : '—'}
          </span>
        ),
      }),
    ],
    [t, i18n.language],
  )

  const rows = data?.items ?? []
  const isEmpty = !isLoading && rows.length === 0
  const displayError = error ? new Error(tTable('error.retry')) : null

  const filters = (
    <DataTableToolbar<PatientRow>
      q={state.q}
      filters={state.filters}
      filterDefs={[]}
      onSearchChange={(q) => dispatch.setSearch(q)}
      onFilterChange={() => {}}
      onClearFilters={() => dispatch.clearAll()}
    />
  )

  const primaryAction = canCreate ? (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus className="size-4" aria-hidden />
      {t('create.trigger')}
    </Button>
  ) : undefined

  return (
    <>
      <FilterableListPage<PatientRow>
        title={t('list.title')}
        description={t('list.sub')}
        primaryAction={primaryAction}
        filters={filters}
        isEmpty={isEmpty}
        table={
          <>
            <DataTable<PatientRow>
              data={rows}
              columns={columns}
              getRowId={(r) => r.id}
              isLoading={isLoading}
              isFetching={isFetching}
              error={displayError}
              onRetry={() => void refetch()}
              selectable={false}
              state={state}
              onStateChange={(next) => dispatch.reset(next)}
              onRowClick={(row) =>
                void navigate({ to: '/patients/$patientId', params: { patientId: row.id } })
              }
            />
            <DataTablePagination
              page={state.page}
              pageSize={state.pageSize}
              totalPages={data?.total_pages ?? 1}
              onPageChange={(page) => dispatch.setPage(page)}
              onPageSizeChange={(pageSize) => dispatch.setPageSize(pageSize)}
            />
          </>
        }
      />
      {canCreate && <CreatePatientDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </>
  )
}
