import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'

type Props = {
  titleKey: `caregiver-shell:nav.${string}`
  ownerSpec: string
}

export function AdminPlaceholder({ titleKey, ownerSpec }: Props): ReactElement {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t(titleKey)} />
      <div className="flex flex-col gap-4 px-6 pb-8">
        <section className="glass rounded-xl p-6">
          <p className="text-sm text-foreground">
            {t('caregiver-shell:placeholder.body', { spec: ownerSpec })}
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            {t('caregiver-shell:placeholder.back')}
          </Link>
        </section>
      </div>
    </>
  )
}
