import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'

/**
 * Generic chrome for entity detail surfaces — header (title, subtitle, optional
 * back link + actions) + body slot.
 *
 * Layout only. Owns no data or query state — the consumer fetches its own
 * resource and passes the rendered body in via `body`. The back link is a
 * `<Link>` props object so the route + params remain typed at the consumer.
 */
export type EntityDetailPageProps = {
  title: ReactNode
  subtitle?: ReactNode
  back?: LinkProps
  actions?: ReactNode
  body: ReactNode
}

export function EntityDetailPage({
  title,
  subtitle,
  back,
  actions,
  body,
}: EntityDetailPageProps): ReactElement {
  const { t } = useTranslation('entity-page')

  const eyebrow = back ? (
    <Link
      {...back}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3" />
      {t('actions.back')}
    </Link>
  ) : undefined

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} sub={subtitle} actions={actions} />
      {/* The shell pins the viewport (SidebarInset is h-svh overflow-hidden),
          so the body must own its scroll; the header stays fixed above it. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-8">{body}</div>
    </>
  )
}
