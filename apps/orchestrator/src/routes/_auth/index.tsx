import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/_auth/')({
  component: AuthedLanding,
})

function AuthedLanding() {
  const { t } = useTranslation('common')
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{t('appShell.welcome')}</h1>
      <p className="mt-2 text-[var(--color-text-2)]">{t('appShell.placeholderDescription')}</p>
    </main>
  )
}
