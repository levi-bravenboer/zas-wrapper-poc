import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/_auth/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { t } = useTranslation('nav')
  return (
    <section className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{t('dashboard')}</h1>
      <p className="mt-2 text-muted-foreground">{t('placeholder')}</p>
    </section>
  )
}
