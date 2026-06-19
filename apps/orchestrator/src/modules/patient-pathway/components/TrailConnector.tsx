import { type ReactElement } from 'react'

import { cn } from '@/lib/style/cn'

export interface TrailConnectorProps {
  /** Teal up to the active step, neutral after. */
  on: boolean
  /** Hidden at the outer edges of the trail. */
  hide: boolean
}

// Half-line segment between trail nodes; shared by step nodes and overflow pills.
export function TrailConnector({ on, hide }: TrailConnectorProps): ReactElement {
  return (
    <span
      className={cn('h-px flex-1', hide ? 'opacity-0' : on ? 'bg-success' : 'bg-border')}
      aria-hidden
    />
  )
}
