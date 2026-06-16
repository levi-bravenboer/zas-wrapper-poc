import { type CSSProperties, type ReactElement, type ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

export type MasterDetailRailProps = {
  rail: ReactNode
  children: ReactNode
  railWidth?: number
}

const DEFAULT_RAIL_WIDTH = 280

/**
 * Domain-neutral two-column master-detail layout. Fixed-width left rail
 * (hidden below `md`, scrollable detail pane on the right). Generalised from
 * `routes/_auth/tasks/route.tsx` — no router, no domain types; the caller owns
 * what `rail` and `children` render.
 */
export function MasterDetailRail({
  rail,
  children,
  railWidth = DEFAULT_RAIL_WIDTH,
}: MasterDetailRailProps): ReactElement {
  return (
    <div className="flex h-full min-h-0 w-full">
      <div
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-background md:flex',
        )}
        style={{ width: railWidth } satisfies CSSProperties}
      >
        {rail}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  )
}
