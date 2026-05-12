import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

import { navItems } from './navItems'

export function Sidebar() {
  const { t } = useTranslation('nav')

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-1 border-r border-border bg-card p-3">
      <nav aria-label="primary" className="flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const label = t(item.labelKey.replace(/^nav\./, ''))
          return (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{
                'aria-current': 'page',
                className: 'bg-accent text-accent-foreground',
              }}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors',
                'hover:bg-muted hover:text-foreground',
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
