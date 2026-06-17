import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  defineColumn,
  type BrandedColumnDef,
  type DataTableFilter,
} from '@/components/data-table'
import { FilterableListPage } from '@/components/list/FilterableListPage'
import { Badge } from '@/components/ui/badge'
import type { ListFilter } from '@/hooks/use-data-table-state'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'

import { AUDIT_EVENTS_LIST_PATH } from '../keys'
import {
  AUDIT_ACTIONS,
  AUDIT_RESULTS,
  AUDITED_RESOURCE_TYPES,
  type AuditEventRead,
} from '../schemas'

import { AuditEventDetail } from './AuditEventDetail'

function shortId(id: string | null): string {
  return id ? id.slice(0, 4) : ''
}

export function AuditListPage(): ReactElement {
  const { t } = useTranslation('audit-admin-ui')
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

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<AuditEventRead>(
    AUDIT_EVENTS_LIST_PATH,
    query,
  )

  const actorLabel = (row: AuditEventRead): string => {
    if (row.actor_label) return row.actor_label
    if (row.actor_type === 'system') return t('actor.system')
    if (row.actor_type === 'anonymous') return t('actor.anonymous')
    return row.actor_id ?? '—'
  }

  const columns = useMemo<ReadonlyArray<BrandedColumnDef<AuditEventRead>>>(
    () => [
      defineColumn<AuditEventRead>({
        id: 'created_at',
        header: t('column.created_at'),
        sortKey: 'created_at',
        sticky: true,
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeOrDash(row.created_at, 'nl-NL')}
          </span>
        ),
      }),
      defineColumn<AuditEventRead>({
        id: 'actor',
        header: t('column.actor'),
        cell: (row) => <span className="truncate font-medium text-foreground">{actorLabel(row)}</span>,
      }),
      defineColumn<AuditEventRead>({
        id: 'action',
        header: t('column.action'),
        cell: (row) => <Badge variant="soft">{t(`enum.action.${row.action}`)}</Badge>,
      }),
      defineColumn<AuditEventRead>({
        id: 'resource',
        header: t('column.resource'),
        cell: (row) =>
          row.resource_type ? (
            <span className="text-muted-foreground">
              {row.resource_type}
              {row.resource_id ? <span className="text-xs"> ·{shortId(row.resource_id)}</span> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      defineColumn<AuditEventRead>({
        id: 'result',
        header: t('column.result'),
        cell: (row) => (
          <Badge variant={row.result === 'failure' ? 'destructive' : 'outline'}>
            {t(`enum.result.${row.result}`)}
          </Badge>
        ),
      }),
    ],
    // actorLabel closes over the stable `t` — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const filterDefs = useMemo<ReadonlyArray<DataTableFilter<AuditEventRead>>>(
    () => [
      {
        type: 'multi',
        key: 'action',
        label: t('filter.action'),
        options: AUDIT_ACTIONS.map((a) => ({ value: a, label: t(`enum.action.${a}`) })),
      },
      {
        type: 'select',
        key: 'result',
        label: t('filter.result'),
        options: AUDIT_RESULTS.map((r) => ({ value: r, label: t(`enum.result.${r}`) })),
      },
      {
        type: 'select',
        key: 'resource_type',
        label: t('filter.resource_type'),
        options: AUDITED_RESOURCE_TYPES.map((r) => ({ value: r, label: r })),
      },
      {
        type: 'date-range',
        key: 'created_at',
        label: t('filter.created_at'),
      },
    ],
    [t],
  )

  const onFilter = (field: string, f: ListFilter | ListFilter[] | null): void => {
    if (f === null) dispatch.clearFilter(field)
    else dispatch.setFilter(field, f)
  }

  const filters = (
    <DataTableToolbar<AuditEventRead>
      q={state.q}
      filters={state.filters}
      filterDefs={filterDefs}
      onSearchChange={(q) => dispatch.setSearch(q)}
      onFilterChange={onFilter}
      onClearFilters={() => dispatch.clearAll()}
      hideSearch
    />
  )

  const rows = data?.items ?? []
  const isEmpty = !isLoading && rows.length === 0
  const displayError = error ? new Error(t('toast.error')) : null

  return (
    <FilterableListPage<AuditEventRead>
      title={t('list.title')}
      description={t('list.sub')}
      filters={filters}
      table={
        <>
          <DataTable<AuditEventRead>
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
            renderExpandedRow={(row) => <AuditEventDetail event={row} />}
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
      emptyState={
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-sm text-muted-foreground">
          <Badge variant="soft">{t('list.empty')}</Badge>
        </div>
      }
      isEmpty={isEmpty}
    />
  )
}
