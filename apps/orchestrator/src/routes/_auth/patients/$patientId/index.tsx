import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/_auth/patients/$patientId/')({
  component: PatientDetailPlaceholderRoute,
})

function PatientDetailPlaceholderRoute(): ReactElement {
  const { t } = useTranslation('patients')
  const { patientId } = Route.useParams()
  return (
    <>
      <PageHeader title={t('detail.title')} sub={t('detail.sub')} />
      <div className="px-6 pb-8">
        <div className="glass rounded-xl p-6 text-sm text-foreground-muted">
          {t('detail.placeholder', { id: patientId })}
        </div>
      </div>
    </>
  )
}
