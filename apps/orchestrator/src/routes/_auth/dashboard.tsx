import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/_auth/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { t } = useTranslation('nav')
  return (
    <>
      <PageHeader title={t('dashboard')} sub={t('placeholder')} />
    </>
  )
}
