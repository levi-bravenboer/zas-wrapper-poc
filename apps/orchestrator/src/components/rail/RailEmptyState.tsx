import { type ReactElement, type ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

export type RailEmptyStateProps = {
  icon?: ReactNode
  title: string
  body?: string
  className?: string
}

/**
 * Centered empty state for an empty rail (e.g. "Geen items"). Icon + title +
 * optional body. Domain-neutral: `icon` is a free `ReactNode` slot so the
 * caller supplies any lucide icon element.
 */
export function RailEmptyState({
  icon,
  title,
  body,
  className,
}: RailEmptyStateProps): ReactElement {
  return (
    <div
      data-slot="rail-empty-state"
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon != null && (
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {body != null && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
    </div>
  )
}

/**
 * Right-pane placeholder shown when no rail item is selected (e.g. "Selecteer
 * een item"). Same content slots as `RailEmptyState`, but fills and centers
 * within the detail pane.
 */
export function RailSelectionEmptyState({ className, ...rest }: RailEmptyStateProps): ReactElement {
  return (
    <div className={cn('flex h-full items-center justify-center p-8', className)}>
      <RailEmptyState {...rest} />
    </div>
  )
}
