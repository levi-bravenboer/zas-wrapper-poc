import { type NodeProps } from '@xyflow/react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { MarkerCircleBlockNode, type MarkerFlowNode } from './MarkerCircleBlockNode'

export type EndFlowNode = MarkerFlowNode

// Pathway-completion §A2: terminal marker. Locked (≥ 1 required);
// heavier border than Start to read as the tail.
export function EndBlockNode(props: NodeProps<EndFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <MarkerCircleBlockNode
      {...props}
      fallbackIcon="square"
      handle="target"
      emphasis="strong"
      ariaLabel={t('blockType.end_pathway')}
      handleAriaLabel={t('canvas.handle.in')}
    />
  )
}
