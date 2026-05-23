import { Link, useMatches } from '@tanstack/react-router'
import { Fragment, type ReactElement } from 'react'
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

function readBreadcrumb(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('breadcrumb' in data)) return undefined
  const value = (data as { breadcrumb: unknown }).breadcrumb
  return typeof value === 'string' ? value : undefined
}

function useAutoCrumbs(): readonly Crumb[] {
  const matches = useMatches()
  if (matches.length <= 2) return []
  const labelled = matches.flatMap<Omit<Crumb, 'isLast'>>((match) => {
    const label = readBreadcrumb(match.staticData)
    return label ? [{ label, to: match.pathname }] : []
  })
  return labelled.map((c, i, arr) => ({ ...c, isLast: i === arr.length - 1 }))
}

export interface RouteBreadcrumbsProps {
  className?: string
}

export function RouteBreadcrumbs({ className }: RouteBreadcrumbsProps): ReactElement | null {
  const { t } = useTranslation('shell')
  const crumbs = useAutoCrumbs()
  if (crumbs.length === 0) return null

  return (
    <div className={cn('px-6 pt-4', className)}>
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
    </div>
  )
}
