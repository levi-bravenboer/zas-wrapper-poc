import { useNavigate } from '@tanstack/react-router'
import { type ReactElement, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type BrandedColumnDef,
  DataTablePagination,
  DataTableToolbar,
  defineColumn,
  EmptyRow,
  LoadingRows,
  Table,
} from '@/components/data-table'
import { stickyFirst } from '@/components/data-table/styles'
import { PageHeader } from '@/components/layout/PageHeader'
import { PersonAvatar } from '@/components/PersonAvatar'
import { ErrorState } from '@/components/states'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { cn } from '@/lib/style/cn'
import { formatDateOrDash } from '@/lib/utils/datetime'

import { PATIENTS_PATH } from '../api'
import type { PatientRow } from '../types'

export function PatientListPage(): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const { t: tTable } = useTranslation('data-table')
  const navigate = useNavigate()
  const [state, dispatch] = useRouteSearchTableState()

  const query = {
    page: state.page,
    page_size: state.pageSize,
    q: state.q,
    order_by: state.orderBy,
    order: state.order,
    filters: state.filters,
  }

  const { data, isLoading, error, refetch } = usePaginatedQuery<PatientRow>(PATIENTS_PATH, query)

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
              <PersonAvatar
                size="sm"
                name={name}
                tintId={row.id}
                person={{ kind: 'patient', id: row.id }}
              />
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
            {row.gender ? t(`gender.${row.gender}`, { defaultValue: row.gender }) : '—'}
          </span>
        ),
      }),
    ],
    [t, i18n.language],
  )

  const rows = data?.items ?? []
  const totalColumns = columns.length

  if (error) {
    return (
      <>
        <PageHeader title={t('list.title')} sub={t('list.sub')} />
        <div className="px-6 pb-8">
          <ErrorState
            title={tTable('error.retry')}
            onRetry={() => void refetch()}
            retryLabel={tTable('error.retry')}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('list.title')} sub={t('list.sub')} />
      <div className="flex flex-col gap-3 px-6 pb-8">
        <DataTableToolbar<PatientRow>
          q={state.q}
          filters={state.filters}
          filterDefs={[]}
          onSearchChange={(q) => dispatch.setSearch(q)}
          onFilterChange={() => {}}
          onClearFilters={() => dispatch.clearAll()}
        />
        <Table.Root ariaLabelledBy="page-title">
          <Table.Header>
            <Table.HeaderRow>
              {columns.map((col, idx) => (
                <Table.HeaderCell
                  key={col.id}
                  className={cn(col.className, (col.sticky ?? idx === 0) && stickyFirst)}
                >
                  {typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header}
                </Table.HeaderCell>
              ))}
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
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    void navigate({ to: '/patients/$patientId', params: { patientId: row.id } })
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
