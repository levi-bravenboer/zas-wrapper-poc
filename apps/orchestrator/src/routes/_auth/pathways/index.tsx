import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Workflow } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '@/components/data-table'
import { defineColumn } from '@/components/data-table/columns'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/states/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/lib/i18n/useLocale'
import { CreatePathwayDialog } from '@/modules/pathway/components/CreatePathwayDialog'
import { usePathwayList } from '@/modules/pathway/hooks'
import type { PathwaySummary } from '@/modules/pathway/types'

export const Route = createFileRoute('/_auth/pathways/')({
  component: PathwayOverviewPage,
  staticData: { breadcrumb: 'Zorgpaden' },
})

function PathwayOverviewPage(): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const list = usePathwayList()
  const [dialogOpen, setDialogOpen] = useState(false)
  const { locale } = useLocale()

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
              <Badge variant="success">
                {t('overview.status.published', { n: publishedNo })}
              </Badge>
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

  const items = list.data ?? []
  const showEmpty = list.isSuccess && !items.length

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
          <DataTable<PathwaySummary>
            data={items}
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
            caption={t('overview.title')}
          />
        )}
      </div>

      <CreatePathwayDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
