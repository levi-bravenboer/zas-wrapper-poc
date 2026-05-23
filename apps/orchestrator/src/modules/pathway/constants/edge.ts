export const EDGE_BORDER_RADIUS = 10
export const EDGE_DASH_PATTERN = '6 4'
export const EDGE_SELECTED_STROKE_BUMP = 1
export const EDGE_HOVER_STROKE_BUMP = 1.25
export const EDGE_INTERACTION_WIDTH = 20

export const HANDLE_SIZE = 11
export const HANDLE_BORDER_WIDTH = 1.5
export const HANDLE_OFFSET = -Math.round(HANDLE_SIZE / 2)
export const BRANCH_HANDLE_OFFSET_PCT = 22

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
  hoverStroke?: string
  width: number
  dash: string | undefined
}

export const EDGE_VARIANT_STYLE: Record<EdgeVariant, EdgeVariantStyle> = {
  default: { stroke: '#cbd1d8', hoverStroke: '#94a3b8', width: 1.75, dash: undefined },
  primary: { stroke: 'var(--color-primary)', hoverStroke: 'var(--color-primary)', width: 2, dash: undefined },
  dashed: { stroke: '#cbd1d8', hoverStroke: '#94a3b8', width: 1.75, dash: EDGE_DASH_PATTERN },
}

export type EdgeShapeKey = 'branch' | 'fallback' | 'plain'

export const EDGE_SHAPE = {
  branch: { sourceHandle: HANDLE_IDS.source.branchYes, variant: 'primary' },
  fallback: { sourceHandle: HANDLE_IDS.source.branchNo, variant: 'dashed' },
  plain: { sourceHandle: HANDLE_IDS.source.plain, variant: 'default' },
} as const satisfies Record<EdgeShapeKey, { sourceHandle: SourceHandleId; variant: EdgeVariant }>
