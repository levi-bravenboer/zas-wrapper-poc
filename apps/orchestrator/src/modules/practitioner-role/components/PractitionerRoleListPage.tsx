import { useNavigate, useSearch } from '@tanstack/react-router'
import { Pencil, Plus, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ClearAll,
  DataTable,
  DataTablePagination,
  DebouncedSearch,
  FilterPill,
  Toolbar,
  defineColumn,
  type BrandedColumnDef,
  type DataTableFilter,
  type DataTableRowAction,
} from '@/components/data-table'
import { FilterableListPage } from '@/components/list/FilterableListPage'
import { PractitionerPicker } from '@/components/pickers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { ListFilter } from '@/hooks/use-data-table-state'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { useRouteSearchTableState } from '@/hooks/use-route-search-table-state'
import { useOrganisations } from '@/modules/organisation/hooks'
import type { OrganisationRead } from '@/modules/organisation/schemas'

import { ROLE_CODES } from '../constants'
import { useClosePractitionerRole } from '../hooks'
import { PRACTITIONER_ROLES_LIST_PATH } from '../keys'
import type { PractitionerRoleCode, PractitionerRoleRead } from '../schemas'

import { EditRoleDialog } from './EditRoleDialog'
import { OpenRoleDialog } from './OpenRoleDialog'

const PATH_SEP = ' / '

function buildOrgPaths(orgs: ReadonlyArray<OrganisationRead>): Map<string, string> {
  const byId = new Map<string, OrganisationRead>()
  for (const org of orgs) byId.set(org.id, org)
  const cache = new Map<string, string>()
  const visit = (id: string, stack: ReadonlySet<string>): string => {
    const cached = cache.get(id)
    if (cached) return cached
    const node = byId.get(id)
    if (!node) return ''
    if (stack.has(id)) return node.name
    const parentId: string | null = node.parent_organisation_id
    const path =
      parentId && byId.has(parentId)
        ? `${visit(parentId, new Set([...stack, id]))}${PATH_SEP}${node.name}`
        : node.name
    cache.set(id, path)
    return path
  }
  for (const org of orgs) visit(org.id, new Set())
  return cache
}

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function firstFilterValue(
  filters: Record<string, ListFilter | ListFilter[]>,
  field: string,
): string | null {
  const v = filters[field]
  if (!v) return null
  const f = Array.isArray(v) ? v[0] : v
  if (!f) return null
  const val = f.value
  if (Array.isArray(val)) {
    const first = val[0]
    return first == null ? null : String(first)
  }
  return val == null ? null : String(val)
}

export function PractitionerRoleListPage(): ReactElement {
  const { t } = useTranslation('practitioner-roles-admin-ui')
  const [state, dispatch] = useRouteSearchTableState()
  const { data: orgs } = useOrganisations()
  const closeRole = useClosePractitionerRole()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const navigate = useNavigate()
  const deepLinkAppliedRef = useRef(false)

  useEffect(() => {
    if (deepLinkAppliedRef.current) return
    const practitionerId =
      typeof search['practitioner_id'] === 'string' ? (search['practitioner_id'] as string) : null
    const organisationId =
      typeof search['organisation_id'] === 'string' ? (search['organisation_id'] as string) : null
    if (!practitionerId && !organisationId) {
      deepLinkAppliedRef.current = true
      return
    }
    if (practitionerId) dispatch.setFilter('practitioner_id', { op: 'eq', value: practitionerId })
    if (organisationId) dispatch.setFilter('organisation_id', { op: 'eq', value: organisationId })
    deepLinkAppliedRef.current = true
    void navigate({
      to: '.',
      search: (prev) => {
        const next = { ...(prev as Record<string, unknown>) }
        delete next['practitioner_id']
        delete next['organisation_id']
        return next
      },
      replace: true,
    })
  }, [search, dispatch, navigate])

  const [openDialog, setOpenDialog] = useState(false)
  const [editing, setEditing] = useState<PractitionerRoleRead | null>(null)

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

  const { data, isLoading, isFetching, error, refetch } = usePaginatedQuery<PractitionerRoleRead>(
    PRACTITIONER_ROLES_LIST_PATH,
    query,
  )

  const orgPaths = useMemo(() => buildOrgPaths(orgs ?? []), [orgs])

  const columns = useMemo<ReadonlyArray<BrandedColumnDef<PractitionerRoleRead>>>(
    () => [
      defineColumn<PractitionerRoleRead>({
        id: 'practitioner',
        header: t('column.practitioner'),
        sticky: true,
        cell: (row) => (
          <span className="truncate font-medium text-foreground">
            {row.practitioner?.display_name ?? row.practitioner_id}
          </span>
        ),
      }),
      defineColumn<PractitionerRoleRead>({
        id: 'organisation',
        header: t('column.organisation'),
        cell: (row) => (
          <span className="truncate text-muted-foreground">
            {orgPaths.get(row.organisation_id) ?? row.organisation_id}
          </span>
        ),
      }),
      defineColumn<PractitionerRoleRead>({
        id: 'code',
        header: t('column.code'),
        sortKey: 'code',
        cell: (row) => <Badge variant="soft">{t(`code.${row.code}`)}</Badge>,
      }),
      defineColumn<PractitionerRoleRead>({
        id: 'specialty',
        header: t('column.specialty'),
        cell: (row) => (
          <span className="text-muted-foreground">
            {row.specialty && row.specialty.trim() !== '' ? row.specialty : '—'}
          </span>
        ),
      }),
      defineColumn<PractitionerRoleRead>({
        id: 'is_primary',
        header: t('column.is_primary'),
        sortKey: 'is_primary',
        cell: (row) =>
          row.is_primary ? (
            <Badge variant="default">{t('primary.yes')}</Badge>
          ) : (
            <Badge variant="outline">{t('primary.no')}</Badge>
          ),
      }),
      defineColumn<PractitionerRoleRead>({
        id: 'period',
        header: t('column.period'),
        sortKey: 'period_start',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {formatDateOnly(row.period_start)} →{' '}
            {row.period_end ? formatDateOnly(row.period_end) : t('period.open')}
          </span>
        ),
      }),
    ],
    [orgPaths, t],
  )

  const rowActions = useMemo(
    () =>
      (row: PractitionerRoleRead): DataTableRowAction[] => {
        const isOpen = !row.period_end
        if (!isOpen) {
          return [
            {
              label: t('actions.view'),
              onClick: () => setEditing(row),
            },
          ]
        }
        return [
          {
            label: t('actions.edit'),
            icon: <Pencil className="h-4 w-4" aria-hidden />,
            onClick: () => setEditing(row),
          },
          {
            label: t('actions.close'),
            icon: <XCircle className="h-4 w-4" aria-hidden />,
            destructive: true,
            onClick: () => {
              closeRole.mutate(row.id, {
                onSuccess: () => toast.success(t('toast.closed')),
                onError: () => toast.error(t('toast.close_failed')),
              })
            },
            confirm: {
              title: t('close.title'),
              description: t('close.description'),
              confirmLabel: t('close.confirm'),
            },
          },
        ]
      },
    [closeRole, t],
  )

  const practitionerId = firstFilterValue(state.filters, 'practitioner_id')
  const isOpenOnly = firstFilterValue(state.filters, 'is_open') === 'true'

  const setEqFilter = (field: string, value: string | null): void => {
    if (value === null) dispatch.clearFilter(field)
    else dispatch.setFilter(field, { op: 'eq', value })
  }

  const onFilter = (field: string, f: ListFilter | ListFilter[] | null): void => {
    if (f === null) dispatch.clearFilter(field)
    else dispatch.setFilter(field, f)
  }

  const filterDefs = useMemo<ReadonlyArray<DataTableFilter<PractitionerRoleRead>>>(
    () => [
      {
        type: 'select',
        key: 'organisation_id',
        label: t('filter.organisation'),
        options: (orgs ?? []).map((o) => ({
          value: o.id,
          label: orgPaths.get(o.id) ?? o.name,
        })),
      },
      {
        type: 'select',
        key: 'code',
        label: t('filter.code'),
        options: ROLE_CODES.map((c) => ({ value: c, label: t(`code.${c}`) })),
      },
    ],
    [orgs, orgPaths, t],
  )

  const hasActive = Object.keys(state.filters).length > 0

  const filters = (
    <Toolbar.Root>
      <Toolbar.Search>
        <DebouncedSearch
          value={state.q}
          onChange={(q) => dispatch.setSearch(q)}
          placeholder={t('filter.search_placeholder')}
        />
      </Toolbar.Search>
      <Toolbar.Filters>
        <PractitionerPicker
          value={practitionerId}
          onChange={(id) => setEqFilter('practitioner_id', id)}
          ariaLabel={t('filter.practitioner')}
          placeholder={t('filter.practitioner')}
        />
        {filterDefs.map((def) => (
          <FilterPill
            key={def.key}
            def={def}
            value={state.filters[def.key]}
            onChange={onFilter}
          />
        ))}
        <label className="inline-flex items-center gap-2 text-xs text-foreground-muted">
          <Checkbox
            checked={isOpenOnly}
            onCheckedChange={(v) => setEqFilter('is_open', v === true ? 'true' : null)}
          />
          <span>{t('filter.open_only')}</span>
        </label>
        {hasActive && <ClearAll onClick={() => dispatch.clearAll()} />}
      </Toolbar.Filters>
    </Toolbar.Root>
  )

  const rows = data?.items ?? []
  const isEmpty = !isLoading && rows.length === 0
  const displayError = error ? new Error(t('toast.error')) : null

  return (
    <>
      <FilterableListPage<PractitionerRoleRead>
        title={t('list.title')}
        description={t('list.sub')}
        primaryAction={
          <Button onClick={() => setOpenDialog(true)}>
            <Plus className="size-4" aria-hidden />
            {t('list.cta.create')}
          </Button>
        }
        filters={filters}
        table={
          <>
            <DataTable<PractitionerRoleRead>
              data={rows}
              columns={columns}
              getRowId={(r) => r.id}
              isLoading={isLoading}
              isFetching={isFetching}
              error={displayError}
              onRetry={() => void refetch()}
              selectable={false}
              rowActions={rowActions}
              state={state}
              onStateChange={(next) => dispatch.reset(next)}
              realtimeTopic="practitioner_roles"
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
      <OpenRoleDialog open={openDialog} onOpenChange={setOpenDialog} />
      <EditRoleDialog
        open={editing !== null}
        role={editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null)
        }}
      />
    </>
  )
}

export type { PractitionerRoleCode }
