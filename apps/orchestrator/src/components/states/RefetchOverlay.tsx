import { Loader2 } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

export type RefetchOverlayProps = {
  active: boolean
  children: ReactNode
  label?: string
  className?: string
}

export function RefetchOverlay({
  active,
  children,
  label,
  className,
}: RefetchOverlayProps): ReactElement {
  return (
    <div data-slot="refetch-overlay" className={cn('relative', className)}>
      {children}
      {active && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-md bg-background/60 backdrop-blur-xs"
        >
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
          {label && <span className="text-sm text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  )
}
