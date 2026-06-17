import { Check } from 'lucide-react'
import { type CSSProperties, type ReactElement } from 'react'

import { cn } from '@/lib/style/cn'
import { BlockTypeIcon } from '@/modules/pathway/blockCatalogue'

import type { SummaryStepState } from '../summary'

import { RUNTIME_STATE_COLOR } from './runtime-canvas/runtimeState'

export interface PathwayTrailNodeProps {
  name: string
  state: SummaryStepState
  icon: string | null
  sub: string | null
  overdue: boolean
  /** Connector tints — teal up to the active step. */
  leftOn: boolean
  rightOn: boolean
  leftHide: boolean
  rightHide: boolean
}

function connector(on: boolean, hide: boolean): ReactElement {
  return (
    <span
      className={cn('h-px flex-1', hide ? 'opacity-0' : on ? 'bg-success' : 'bg-border')}
      aria-hidden
    />
  )
}

function Circle({
  state,
  icon,
  overdue,
}: Pick<PathwayTrailNodeProps, 'state' | 'icon' | 'overdue'>): ReactElement {
  if (state === 'finished') {
    return (
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full text-success"
        style={{ background: 'color-mix(in srgb, var(--color-success) 14%, transparent)' }}
      >
        <Check className="size-4" aria-hidden />
      </span>
    )
  }
  if (state === 'active') {
    const ring = overdue ? 'var(--color-destructive)' : RUNTIME_STATE_COLOR.active
    const style: CSSProperties = {
      boxShadow: `0 0 0 5px color-mix(in srgb, ${ring} 18%, transparent)`,
    }
    return (
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
        style={style}
      >
        <BlockTypeIcon icon={icon ?? undefined} className="size-[18px]" strokeWidth={1.8} />
      </span>
    )
  }
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground"
      style={{ borderColor: RUNTIME_STATE_COLOR.upcoming }}
    >
      <BlockTypeIcon icon={icon ?? undefined} className="size-4" strokeWidth={1.7} />
    </span>
  )
}

export function PathwayTrailNode({
  name,
  state,
  icon,
  sub,
  overdue,
  leftOn,
  rightOn,
  leftHide,
  rightHide,
}: PathwayTrailNodeProps): ReactElement {
  const current = state === 'active'
  return (
    <li className="flex min-w-[6.5rem] shrink-0 grow basis-[6.5rem] flex-col items-center">
      <div className="flex w-full items-center">
        {connector(leftOn, leftHide)}
        <Circle state={state} icon={icon} overdue={overdue} />
        {connector(rightOn, rightHide)}
      </div>
      <span
        title={name}
        className={cn(
          'mt-1.5 max-w-full truncate px-1 text-center text-xs leading-tight',
          current ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'max-w-full truncate text-[11px] leading-tight',
          overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
          sub ? '' : 'text-transparent',
        )}
      >
        {sub ?? '·'}
      </span>
    </li>
  )
}
