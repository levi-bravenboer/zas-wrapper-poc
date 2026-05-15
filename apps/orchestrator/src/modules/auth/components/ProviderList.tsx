import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useProviders } from '@/modules/auth/hooks'
import { strategies } from '@/modules/auth/providers'

export function ProviderList(): ReactElement {
  const { t } = useTranslation('auth')
  const { data: providers, isPending, isError, refetch } = useProviders()

  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="h-12 rounded-md bg-muted animate-pulse" />
        <div className="h-12 rounded-md bg-muted animate-pulse" />
        <div className="h-10 rounded-md bg-muted animate-pulse" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p role="alert" className="text-sm text-destructive">
          {t('login.providers.error')}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void refetch()
          }}
        >
          {t('login.providers.retry')}
        </Button>
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <p role="alert" className="text-sm text-muted-foreground text-center">
        {t('login.providers.none_available')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {providers.map((provider) => {
        const Strategy = strategies[provider.kind]
        if (!Strategy) {
          console.warn(`No strategy registered for provider kind: ${provider.kind}`)
          return null
        }
        return <Strategy key={provider.key} provider={provider} />
      })}
    </div>
  )
}
