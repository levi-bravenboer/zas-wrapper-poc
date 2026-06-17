import { type ReactElement } from 'react'

import { TrailConnector } from './TrailConnector'

export interface PathwayTrailOverflowProps {
  count: number
  label: string
  leftOn: boolean
  rightOn: boolean
  leftHide: boolean
  rightHide: boolean
}

// End cap of the trail window: collapses the steps that fall outside the
// window into a single dashed "+N" pill.
export function PathwayTrailOverflow({
  count,
  label,
  leftOn,
  rightOn,
  leftHide,
  rightHide,
}: PathwayTrailOverflowProps): ReactElement {
  return (
    <li className="flex min-w-[5rem] shrink-0 grow basis-[5rem] flex-col items-center">
      <div className="flex w-full items-center">
        <TrailConnector on={leftOn} hide={leftHide} />
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-[color:var(--color-border-strong)] text-[11px] font-semibold text-muted-foreground">
          +{count}
        </span>
        <TrailConnector on={rightOn} hide={rightHide} />
      </div>
      <span className="mt-1.5 text-[11px] font-medium leading-tight text-muted-foreground">
        {label}
      </span>
      <span className="text-[11px] leading-tight text-transparent">·</span>
    </li>
  )
}
