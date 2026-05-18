import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type EntityNotFoundProps = {
  backTo: LinkProps
}

export function EntityNotFound({ backTo }: EntityNotFoundProps): ReactElement {
  const { t } = useTranslation('entity-page')
  return (
    <div className="px-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('notFound.title')}</CardTitle>
          <CardDescription>{t('notFound.message')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link {...backTo}>{t('notFound.backToList')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
