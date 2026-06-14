import { Handle, type HandleProps } from '@xyflow/react'
import { type ReactElement } from 'react'

type Props = HandleProps & {
  ariaLabel: string
}

// Pathway-completion §C: the canvas is read-only — users can never
// draw an edge by hand. xyflow still needs the Handle in the DOM so
// it can compute derived-edge endpoints, but the visible circle is
// hidden. `pointer-events: none` keeps stray drag handles from
// catching mouse events too.
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
