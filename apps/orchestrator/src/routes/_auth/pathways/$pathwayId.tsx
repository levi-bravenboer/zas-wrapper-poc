import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/states/ErrorState'
import { RowSkeleton } from '@/components/states/Skeleton'
import { usePathway } from '@/modules/pathway/hooks'

export const Route = createFileRoute('/_auth/pathways/$pathwayId')({
  component: PathwayBuilderStubPage,
  staticData: { breadcrumb: 'Builder' },
})

function PathwayBuilderStubPage(): ReactElement {
  const { t } = useTranslation('pathway')
  const { pathwayId } = Route.useParams()
  const pathway = usePathway(pathwayId)

  if (pathway.isLoading) {
    return (
      <div className="flex flex-col gap-3 px-6 py-6">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    )
  }

  if (pathway.isError || !pathway.data) {
    return (
      <ErrorState
        title={t('overview.loadError')}
        onRetry={() => {
          void pathway.refetch()
        }}
      />
    )
  }

  const data = pathway.data

  return (
    <>
      <PageHeader title={data.name} sub={t('builder.stubTitle')} />
      <div className="flex flex-col gap-4 px-6 pb-8">
        <p className="text-sm text-muted-foreground">{t('builder.stubBody')}</p>
        {data.clinical_goal && (
          <section className="glass rounded-xl p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t('builder.clinicalGoal')}
            </h2>
            <p className="mt-2 text-sm text-foreground">{data.clinical_goal}</p>
          </section>
        )}
        {data.patient_goal && (
          <section className="glass rounded-xl p-5">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t('builder.patientGoal')}
            </h2>
            <p className="mt-2 text-sm text-foreground">{data.patient_goal}</p>
          </section>
        )}
        <section className="glass rounded-xl p-5">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t('builder.blocks')}
          </h2>
          <p className="mt-2 text-sm text-foreground tabular-nums">
            {data.blocks?.length ?? 0}
          </p>
        </section>
      </div>
    </>
  )
}
