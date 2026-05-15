import { CircleAlert, type LucideIcon } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style/cn'

export type ErrorStateProps = {
  icon?: LucideIcon
  title: ReactNode
  body?: ReactNode
  retryLabel?: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}

export function ErrorState({
  icon: Icon = CircleAlert,
  title,
  body,
  retryLabel,
  onRetry,
  action,
  className,
}: ErrorStateProps): ReactElement {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        'flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      <div className="mt-2 flex items-center gap-2">
        {onRetry && retryLabel && (
          <Button onClick={onRetry} variant="default">
            {retryLabel}
          </Button>
        )}
        {action}
      </div>
    </div>
  )
}
