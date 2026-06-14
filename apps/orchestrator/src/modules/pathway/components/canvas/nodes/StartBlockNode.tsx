import { type NodeProps } from '@xyflow/react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { MarkerCircleBlockNode, type MarkerFlowNode } from './MarkerCircleBlockNode'

export type StartFlowNode = MarkerFlowNode

// Pathway-completion §A1: `start` is a marker block — exactly one
// per pathway, lane=caregiver, no input_logic, no timing_policy. The
// canvas reflects that with a compact circular node: just the play
// icon, source handle on the right, no hover-X (the cardinality
// invariant requires exactly one per version).
export function StartBlockNode(props: NodeProps<StartFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <MarkerCircleBlockNode
      {...props}
      fallbackIcon="play"
      handle="source"
      ariaLabel={t('blockType.start', { defaultValue: 'Start' })}
      handleAriaLabel={t('canvas.handle.out')}
    />
  )
}
