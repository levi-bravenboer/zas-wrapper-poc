import { Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { BlockTypeIcon } from '../../../blockCatalogue'
import { laneAccent } from '../../../canvasLayout'
import { HANDLE_IDS, HANDLE_OFFSET } from '../../../constants/edge'

import type { BlockNodeData } from './BlockNode'
import { HandlePort } from './HandlePort'

export type StartFlowNode = Node<BlockNodeData, 'block'>

export const StartBlockNode = memo(StartBlockNodeImpl)

// Pathway-completion §A1: `start` is a marker block — exactly one per
// pathway, lane=caregiver, no input_logic, no timing_policy. The
// canvas reflects that with a compact circular node: just the play
// icon, no subtitle, no target handle (it can never have an entry
// connection), no hover-X (the Start can never be deleted; the
// cardinality invariant requires exactly one per version).
function StartBlockNodeImpl({ data, selected }: NodeProps<StartFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  const accent = data.lane ? laneAccent(data.lane) : 'var(--color-primary)'
  const isSelected = !!selected
  const ariaLabel = t('blockType.start', { defaultValue: 'Start' })

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      data-selected={isSelected || undefined}
      // h-16 w-16 = 64px square, must stay in lockstep with
      // START_DIMENSIONS in blockDimensions.ts (the xyflow node
      // bounding box) so the visible circle matches the drag extent.
      className="group relative flex h-16 w-16 items-center justify-center rounded-full border bg-card shadow-sm transition-[box-shadow,border-color] hover:border-[color:var(--color-border-strong)] data-[selected]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lane-accent)_22%,transparent)]"
      style={
        {
          ['--lane-accent' as string]: accent,
          borderColor: accent,
          background: `color-mix(in srgb, ${accent} 8%, var(--color-card))`,
        } as React.CSSProperties
      }
    >
      <BlockTypeIcon
        icon={data.blockType?.icon ?? 'play'}
        className="size-6"
        strokeWidth={1.8}
        style={{ color: accent }}
      />
      <HandlePort
        id={HANDLE_IDS.source.plain}
        type="source"
        position={Position.Right}
        ariaLabel={t('canvas.handle.out')}
        style={{ right: HANDLE_OFFSET }}
      />
    </div>
  )
}
