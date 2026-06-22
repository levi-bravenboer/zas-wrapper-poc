// surface-opt-out: app-only
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Copy, Plus, Workflow } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable, DataTableToolbar, type DataTableFilter } from '@/components/data-table'
import { defineColumn } from '@/components/data-table/columns'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/states/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useDataTableState,
  type ListFilter,
  type ListFilterPrimitive,
} from '@/hooks/use-data-table-state'
import { useLocale } from '@/lib/i18n/useLocale'
import { CreatePathwayDialog } from '@/modules/pathway/components/CreatePathwayDialog'
import { DuplicatePathwayDialog } from '@/modules/pathway/components/DuplicatePathwayDialog'
import { usePathwayList } from '@/modules/pathway/hooks'
import type { PathwaySummary } from '@/modules/pathway/types'

export const Route = createFileRoute('/_auth/pathways/')({
  component: PathwayOverviewPage,
  staticData: { breadcrumb: 'header.crumb.pathways' },
})

type PathwayStatus = 'concept' | 'conceptOnPublished' | 'published' | 'draft'

type PathwayFilterRow = PathwaySummary & { status: PathwayStatus }

function pathwayStatus(p: PathwaySummary): PathwayStatus {
  if (p.has_concept && p.latest_published_version_no != null) return 'conceptOnPublished'
  if (p.has_concept) return 'concept'
  if (p.latest_published_version_no != null) return 'published'
  return 'draft'
}

function matchesSearch(p: PathwaySummary, q: string): boolean {
  const needle = q.toLowerCase()
  return (
    p.name.toLowerCase().includes(needle) ||
    (p.clinical_goal ?? '').toLowerCase().includes(needle) ||
    (p.patient_goal ?? '').toLowerCase().includes(needle)
  )
}

function statusValues(filter: ListFilter | ListFilter[] | undefined): Set<string> | null {
  if (filter === undefined) return null
  const filters = Array.isArray(filter) ? filter : [filter]
  const out = new Set<string>()
  for (const f of filters) {
    const raw: ReadonlyArray<ListFilterPrimitive> = Array.isArray(f.value) ? f.value : [f.value]
    for (const v of raw) out.add(String(v))
  }
  return out
}

function PathwayOverviewPage(): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const list = usePathwayList()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [duplicateTarget, setDuplicateTarget] = useState<PathwaySummary | null>(null)
  const { locale } = useLocale()
  const [state, dispatch] = useDataTableState()

  const filterDefs = useMemo<ReadonlyArray<DataTableFilter<PathwayFilterRow>>>(
    () => [
      {
        type: 'select',
        key: 'status',
        label: t('overview.toolbar.filter.status.label'),
        options: [
          { value: 'concept', label: t('overview.toolbar.filter.status.concept') },
          {
            value: 'conceptOnPublished',
            label: t('overview.toolbar.filter.status.conceptOnPublished'),
          },
          { value: 'published', label: t('overview.toolbar.filter.status.published') },
          { value: 'draft', label: t('overview.toolbar.filter.status.draft') },
        ],
      },
    ],
    [t],
  )

  const columns = useMemo(() => {
    const dateTime = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    const dateOnly = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    const empty = t('overview.table.empty')

    return [
      defineColumn<PathwaySummary>({
        id: 'name',
        header: t('overview.table.name'),
        cell: (row) => <span className="font-medium">{row.name}</span>,
      }),
      defineColumn<PathwaySummary>({
        id: 'status',
        header: t('overview.table.status'),
        cell: (row) => {
          const publishedNo = row.latest_published_version_no
          if (row.has_concept && publishedNo != null) {
            return (
              <Badge variant="warning">
                {t('overview.status.conceptOnPublished', { n: publishedNo })}
              </Badge>
            )
          }
          if (row.has_concept) {
            return <Badge variant="warning">{t('overview.status.concept')}</Badge>
          }
          if (publishedNo != null) {
            return (
              <Badge variant="success">{t('overview.status.published', { n: publishedNo })}</Badge>
            )
          }
          return <Badge variant="muted">{t('overview.status.draft')}</Badge>
        },
      }),
      defineColumn<PathwaySummary>({
        id: 'blocks',
        header: t('overview.table.blocks'),
        cell: (row) => row.block_count,
        className: 'w-20 text-right tabular-nums',
      }),
      defineColumn<PathwaySummary>({
        id: 'clinicalGoal',
        header: t('overview.table.clinicalGoal'),
        cell: (row) => (
          <span className="block max-w-[28ch] truncate text-foreground-muted">
            {row.clinical_goal || empty}
          </span>
        ),
      }),
      defineColumn<PathwaySummary>({
        id: 'lastPublished',
        header: t('overview.table.lastPublished'),
        cell: (row) =>
          row.latest_published_at ? dateOnly.format(new Date(row.latest_published_at)) : empty,
        className: 'whitespace-nowrap',
      }),
      defineColumn<PathwaySummary>({
        id: 'lastEdited',
        header: t('overview.table.lastEdited'),
        cell: (row) => dateTime.format(new Date(row.last_edited_at)),
        className: 'whitespace-nowrap',
      }),
    ]
  }, [locale, t])

  const items = useMemo(() => list.data ?? [], [list.data])

  const filteredItems = useMemo(() => {
    const q = state.q?.trim() ?? ''
    const statusFilter = statusValues(state.filters.status)
    return items.filter((row) => {
      if (q && !matchesSearch(row, q)) return false
      if (statusFilter && !statusFilter.has(pathwayStatus(row))) return false
      return true
    })
  }, [items, state.q, state.filters])

  const showEmpty = list.isSuccess && !items.length
  const hasActiveFilter = state.q != null || Object.keys(state.filters).length > 0

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        sub={t('overview.sub')}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t('overview.createButton')}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-6 pb-8">
        {showEmpty ? (
          <EmptyState
            icon={Workflow}
            title={t('overview.empty.title')}
            body={t('overview.empty.body')}
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                {t('overview.empty.action')}
              </Button>
            }
          />
        ) : (
          <>
            <DataTableToolbar<PathwayFilterRow>
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
            <DataTable<PathwaySummary>
              data={filteredItems}
              columns={columns}
              getRowId={(row) => row.id}
              isLoading={list.isLoading}
              isFetching={list.isFetching}
              error={list.error}
              onRetry={() => {
                void list.refetch()
              }}
              onRowClick={(row) =>
                void navigate({ to: '/pathways/$pathwayId', params: { pathwayId: row.id } })
              }
              rowActions={(row) => [
                {
                  label: t('duplicate.action'),
                  icon: <Copy aria-hidden="true" className="size-4" />,
                  onClick: () => setDuplicateTarget(row),
                },
              ]}
              caption={t('overview.title')}
            />
            {!filteredItems.length && hasActiveFilter && items.length > 0 ? (
              <p className="px-1 text-sm text-foreground-muted">{t('overview.table.empty')}</p>
            ) : null}
          </>
        )}
      </div>

      <CreatePathwayDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {duplicateTarget && (
        <DuplicatePathwayDialog
          pathwayId={duplicateTarget.id}
          pathwayName={duplicateTarget.name}
          open={!!duplicateTarget}
          onOpenChange={(open) => {
            if (!open) setDuplicateTarget(null)
          }}
        />
      )}
    </>
  )
}
