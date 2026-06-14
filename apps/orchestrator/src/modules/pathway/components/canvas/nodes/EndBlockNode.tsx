import { type NodeProps } from '@xyflow/react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { MarkerCircleBlockNode, type MarkerFlowNode } from './MarkerCircleBlockNode'

export type EndFlowNode = MarkerFlowNode

// Pathway-completion §A2: `end_pathway` is a terminal marker —
// cardinality ≥ 1 per version, lane=system, no per-kind config, no
// timing, no author-visible name (the canvas shape conveys it
// fully). Mirrors the §A1 Start treatment with a heavier border so
// the terminal reads visually distinct from the head.
export function EndBlockNode(props: NodeProps<EndFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <MarkerCircleBlockNode
      {...props}
      fallbackIcon="square"
      handle="target"
      emphasis="strong"
      ariaLabel={t('blockType.end_pathway', { defaultValue: 'Einde' })}
      handleAriaLabel={t('canvas.handle.in')}
    />
  )
}
