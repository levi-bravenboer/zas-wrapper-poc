import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'
import { getFeaturesForSurface } from '@/platform/embed/defineFeature'

import { hardWiredNavItems, type NavItem } from './navItems'

function useResolvedNavItems(): readonly NavItem[] {
  return useMemo(() => {
    const featureItems: NavItem[] = []
    for (const feature of getFeaturesForSurface('app')) {
      if (feature.nav) {
        featureItems.push({
          to: feature.path,
          labelKey: feature.titleKey,
          icon: feature.nav.icon,
          order: feature.nav.order ?? 100,
        })
      }
    }
    return [...hardWiredNavItems, ...featureItems].toSorted((a, b) => a.order - b.order)
  }, [])
}

export function Sidebar() {
  const { t } = useTranslation('nav')
  const items = useResolvedNavItems()

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-1 border-r border-border bg-card p-3">
      <nav aria-label="primary" className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const label = t(item.labelKey.replace(/^nav\./, ''))
          return (
            <Link
              key={item.to}
              // Reason: NavItem.to is `string` for registry interop; TanStack Link wants typed routes.
              to={item.to as never}
              activeProps={{
                'aria-current': 'page',
                className: 'bg-primary-soft text-primary',
              }}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors',
                'hover:bg-surface-2 hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
