import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { beginLaunch, SmartLaunchError } from '@/modules/smart-launch/api'
import { launchSearchSchema } from '@/modules/smart-launch/schemas'

export const Route = createFileRoute('/launch')({
  validateSearch: launchSearchSchema,
  component: LaunchPage,
})

function LaunchPage() {
  const search = Route.useSearch()
  const { t } = useTranslation('smart')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    beginLaunch(search).catch((cause: unknown) => {
      if (cancelled) return
      setError(cause instanceof SmartLaunchError ? cause.message : t('launch_failed'))
    })
    return () => {
      cancelled = true
    }
  }, [search, t])

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div role="alert" className="max-w-md rounded-md border border-destructive p-6 text-sm">
          <h1 className="mb-2 text-base font-semibold">{t('launch_failed')}</h1>
          <p>{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">{t('launching')}</p>
    </main>
  )
}
