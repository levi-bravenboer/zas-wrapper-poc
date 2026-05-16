import { Handle, type HandleProps } from '@xyflow/react'
import { type ReactElement } from 'react'

type Props = HandleProps & {
  ariaLabel: string
}

export function HandlePort({ ariaLabel, style, ...rest }: Props): ReactElement {
  return (
    <Handle
      aria-label={ariaLabel}
      style={{
        width: 11,
        height: 11,
        background: 'var(--card)',
        border: '1.5px solid var(--lane-accent)',
        boxShadow: '0 1px 2px rgba(11,26,23,0.15)',
        ...style,
      }}
      {...rest}
    />
  )
}
