import type { ReactElement, ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

export type PageHeaderProps = {
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
  tabs,
  className,
}: PageHeaderProps): ReactElement {
  return (
    <header data-slot="page-header" className={cn('flex flex-col gap-4 px-6 pt-6 pb-4', className)}>
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
