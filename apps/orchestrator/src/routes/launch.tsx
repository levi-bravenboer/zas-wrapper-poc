import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'

import { beginLaunch } from '@/modules/smart-launch/api'
import { launchSearchSchema } from '@/modules/smart-launch/schemas'

export const Route = createFileRoute('/launch')({
  validateSearch: launchSearchSchema,
  component: LaunchRoute,
})

function LaunchRoute() {
  const search = Route.useSearch()
  return <LaunchPage search={search} />
}

export function LaunchPage({ search }: { search: z.infer<typeof launchSearchSchema> }) {
  const { t } = useTranslation('smart')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    beginLaunch(search).catch((cause: unknown) => {
      if (cancelled) return
      console.error('SMART launch failed:', cause)
      setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [search])

  if (failed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div role="alert" className="max-w-md rounded-md border border-destructive p-6 text-sm">
          <h1 className="text-base font-semibold">{t('launch_failed')}</h1>
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
