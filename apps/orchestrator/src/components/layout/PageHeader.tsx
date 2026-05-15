import { Link, useMatches } from '@tanstack/react-router'
import { Fragment, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/style/cn'

type Crumb = { label: string; to: string; isLast: boolean }

export type PageHeaderProps = {
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
  className?: string
}

function readBreadcrumb(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('breadcrumb' in data)) return undefined
  const value = (data as { breadcrumb: unknown }).breadcrumb
  return typeof value === 'string' ? value : undefined
}

function useAutoCrumbs(): readonly Crumb[] {
  const matches = useMatches()
  if (matches.length <= 2) return []

  const labelled = matches.flatMap<Crumb>((match, i) => {
    const label = readBreadcrumb(match.staticData)
    if (!label) return []
    return [{ label, to: match.pathname, isLast: i === matches.length - 1 }]
  })

  return labelled.map((crumb, i, arr) => ({ ...crumb, isLast: i === arr.length - 1 }))
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  tabs,
  className,
}: PageHeaderProps): ReactElement {
  const { t } = useTranslation('shell')
  const crumbs = useAutoCrumbs()

  return (
    <header data-slot="page-header" className={cn('flex flex-col gap-4 px-6 pt-6 pb-4', className)}>
      {crumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">{t('header.crumb.home')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {crumbs.map((crumb) => (
              <Fragment key={crumb.to}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {eyebrow && (
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {tabs && <div data-slot="page-header-tabs">{tabs}</div>}
    </header>
  )
}
