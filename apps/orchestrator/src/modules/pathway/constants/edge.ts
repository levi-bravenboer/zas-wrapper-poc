export const EDGE_BORDER_RADIUS = 10
export const EDGE_DASH_PATTERN = '6 4'
export const EDGE_SELECTED_STROKE_BUMP = 1

export const HANDLE_IDS = {
  target: 'in',
  source: {
    plain: 'out',
    branchYes: 'yes',
    branchNo: 'no',
  },
} as const

export type TargetHandleId = typeof HANDLE_IDS.target
export type SourceHandleId = (typeof HANDLE_IDS.source)[keyof typeof HANDLE_IDS.source]

export type EdgeVariant = 'default' | 'primary' | 'dashed'

type EdgeVariantStyle = {
  stroke: string
  width: number
  dash: string | undefined
}

export const EDGE_VARIANT_STYLE = {
  default: { stroke: '#cbd1d8', width: 1.75, dash: undefined },
  primary: { stroke: 'var(--color-primary)', width: 2, dash: undefined },
  dashed: { stroke: '#cbd1d8', width: 1.75, dash: EDGE_DASH_PATTERN },
} as const satisfies Record<EdgeVariant, EdgeVariantStyle>

export type EdgeShapeKey = 'branch' | 'fallback' | 'plain'

export const EDGE_SHAPE = {
  branch: { sourceHandle: HANDLE_IDS.source.branchYes, variant: 'primary' },
  fallback: { sourceHandle: HANDLE_IDS.source.branchNo, variant: 'dashed' },
  plain: { sourceHandle: HANDLE_IDS.source.plain, variant: 'default' },
} as const satisfies Record<EdgeShapeKey, { sourceHandle: SourceHandleId; variant: EdgeVariant }>
