import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'

import { exchangeAuthCode } from '@/modules/smart-launch/api'
import { callbackSearchSchema } from '@/modules/smart-launch/schemas'
import { useLaunchStore } from '@/modules/smart-launch/store'
import { SURFACES } from '@/platform/surface/registry'

type CallbackSearch = z.infer<typeof callbackSearchSchema>
type NavigateFn = (opts: { to: string; replace?: boolean }) => void | Promise<void>

export const Route = createFileRoute('/launch/callback')({
  validateSearch: callbackSearchSchema,
  component: LaunchCallbackRoute,
})

function resolveDestination(): string {
  const ctx = useLaunchStore.getState().context
  const surface = ctx?.surface ?? 'smart'
  const base = SURFACES[surface].basePath
  const returnPath = ctx?.returnPath
  if (returnPath) return returnPath
  return `${base}/`
}

function LaunchCallbackRoute() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  return <LaunchCallbackPage search={search} navigate={navigate} />
}

export function LaunchCallbackPage({
  search,
  navigate,
}: {
  search: CallbackSearch
  navigate: NavigateFn
}) {
  const { t } = useTranslation('smart')
  const [error, setError] = useState<string | null>(
    search.error ? (search.error_description ?? search.error) : null,
  )
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (search.error) return
    let cancelled = false
    exchangeAuthCode()
      .then(() => {
        if (cancelled) return
        const to = resolveDestination()
        void navigate({ to, replace: true })
      })
      .catch(() => {
        if (cancelled) return
        setError(t('exchange_failed'))
      })
    return () => {
      cancelled = true
    }
  }, [search, navigate, t])

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div role="alert" className="max-w-md rounded-md border border-destructive p-6 text-sm">
          <h1 className="mb-2 text-base font-semibold">{t('exchange_failed')}</h1>
          <p className="mb-4">{error}</p>
          <button
            type="button"
            onClick={() => {
              const ctx = useLaunchStore.getState().context
              if (!ctx) return
              window.location.assign(
                `/launch?iss=${encodeURIComponent(ctx.iss)}&launch=${encodeURIComponent(ctx.launch)}&surface=${ctx.surface}`,
              )
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            {t('retry')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">{t('exchanging')}</p>
    </main>
  )
}
