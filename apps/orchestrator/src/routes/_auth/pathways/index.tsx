import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Workflow } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '@/components/data-table'
import { defineColumn } from '@/components/data-table/columns'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/states/EmptyState'
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
    const formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    return [
      defineColumn<PathwaySummary>({
        id: 'name',
        header: t('overview.table.name'),
        cell: (row) => row.name,
      }),
      defineColumn<PathwaySummary>({
        id: 'blocks',
        header: t('overview.table.blocks'),
        cell: (row) => row.block_count,
      }),
      defineColumn<PathwaySummary>({
        id: 'updated',
        header: t('overview.table.updated'),
        cell: (row) => formatter.format(new Date(row.updated_at)),
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
