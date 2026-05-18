import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type EntityErrorCardProps = {
  onRetry: () => void
}

export function EntityErrorCard({ onRetry }: EntityErrorCardProps): ReactElement {
  const { t } = useTranslation('entity-page')
  return (
    <div className="px-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('error.title')}</CardTitle>
          <CardDescription>{t('error.message')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
