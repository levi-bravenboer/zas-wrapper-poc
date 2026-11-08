import { type NodeProps } from '@xyflow/react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { MarkerCircleBlockNode, type MarkerFlowNode } from './MarkerCircleBlockNode'

export type StartFlowNode = MarkerFlowNode

// Pathway-completion §A1: pathway entry marker. Exactly one per
// version (locked, non-deletable).
export function StartBlockNode(props: NodeProps<StartFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <MarkerCircleBlockNode
      {...props}
      fallbackIcon="play"
      handle="source"
      ariaLabel={t('blockType.start')}
      handleAriaLabel={t('canvas.handle.out')}
    />
  )
}
