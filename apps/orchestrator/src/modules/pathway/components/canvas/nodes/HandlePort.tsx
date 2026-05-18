import { Handle, type HandleProps } from '@xyflow/react'
import { type ReactElement } from 'react'

import { HANDLE_BORDER_WIDTH, HANDLE_SIZE } from '../../../constants/edge'
import { inkAlpha } from '../../../constants/theme'

type Props = HandleProps & {
  ariaLabel: string
}

export function HandlePort({ ariaLabel, style, ...rest }: Props): ReactElement {
  return (
    <Handle
      aria-label={ariaLabel}
      style={{
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: 'var(--card)',
        border: `${HANDLE_BORDER_WIDTH}px solid var(--lane-accent)`,
        boxShadow: `0 1px 2px ${inkAlpha(0.15)}`,
        ...style,
      }}
      {...rest}
    />
  )
}
