import { Handle, type HandleProps } from '@xyflow/react'
import { type ReactElement } from 'react'

type Props = HandleProps & {
  ariaLabel: string
}

// Invisible handle — xyflow needs it in the DOM for edge endpoints
// (edges are derived from `input_logic`, never drawn by hand).
export function HandlePort({ ariaLabel, style, ...rest }: Props): ReactElement {
  return (
    <Handle
      aria-label={ariaLabel}
      style={{
        width: 0,
        height: 0,
        minWidth: 0,
        minHeight: 0,
        border: 'none',
        background: 'transparent',
        boxShadow: 'none',
        pointerEvents: 'none',
        ...style,
      }}
      {...rest}
    />
  )
}
