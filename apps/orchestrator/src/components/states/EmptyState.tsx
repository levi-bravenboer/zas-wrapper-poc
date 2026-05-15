import { type LucideIcon } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

export type EmptyStateProps = {
  icon?: LucideIcon
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      data-slot="empty-state"
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="size-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
