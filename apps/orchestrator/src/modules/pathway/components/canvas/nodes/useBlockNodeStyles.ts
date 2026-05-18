import { type CSSProperties } from 'react'

import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../../../canvasLayout'

type Args = {
  accent: string
  selected: boolean
  isBranch: boolean
}

type Result = {
  containerStyle: CSSProperties
  iconStyle: CSSProperties
  railStyle: CSSProperties
}

export function useBlockNodeStyles({ accent, selected, isBranch }: Args): Result {
  const containerStyle: CSSProperties = {
    ['--lane-accent' as string]: accent,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    borderColor: selected ? accent : undefined,
    borderWidth: selected ? 1.5 : 1,
    borderStyle: isBranch ? 'dashed' : 'solid',
  }
  const iconStyle: CSSProperties = {
    background: 'color-mix(in srgb, var(--lane-accent) 12%, var(--card))',
    color: accent,
  }
  const railStyle: CSSProperties = { background: accent }
  return { containerStyle, iconStyle, railStyle }
}
