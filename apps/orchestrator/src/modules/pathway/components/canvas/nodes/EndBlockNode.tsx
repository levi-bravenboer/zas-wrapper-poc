import { Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { BlockTypeIcon } from '../../../blockCatalogue'
import { laneAccent } from '../../../canvasLayout'
import { HANDLE_IDS, HANDLE_OFFSET } from '../../../constants/edge'

import type { BlockNodeData } from './BlockNode'
import { HandlePort } from './HandlePort'

export type EndFlowNode = Node<BlockNodeData, 'block'>

export const EndBlockNode = memo(EndBlockNodeImpl)

// Pathway-completion §A2: `end_pathway` is a terminal marker —
// cardinality ≥ 1 per version, lane=system, no per-kind config, no
// timing, no author-visible name (the canvas shape conveys it
// fully). The canvas renders it as a compact circular node (mirrors
// the §A1 Start treatment) with only the target handle. No hover-X
// — the publish gate requires at least one terminal so deletion
// would risk leaving the version unpublishable.
function EndBlockNodeImpl({ data, selected }: NodeProps<EndFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  const accent = data.lane ? laneAccent(data.lane) : 'var(--color-primary)'
  const isSelected = !!selected
  const ariaLabel = t('blockType.end_pathway', { defaultValue: 'Einde' })

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      data-selected={isSelected || undefined}
      // h-16 w-16 = 64px square, must stay in lockstep with
      // END_DIMENSIONS in blockDimensions.ts so the rendered circle
      // matches the xyflow node bounding box.
      className="group relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-card shadow-sm transition-[box-shadow,border-color] hover:border-[color:var(--color-border-strong)] data-[selected]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lane-accent)_22%,transparent)]"
      style={
        {
          ['--lane-accent' as string]: accent,
          borderColor: accent,
          background: `color-mix(in srgb, ${accent} 8%, var(--color-card))`,
        } as React.CSSProperties
      }
    >
      <BlockTypeIcon
        icon={data.blockType?.icon ?? 'square'}
        className="size-6"
        strokeWidth={1.8}
        style={{ color: accent }}
      />
      <HandlePort
        id={HANDLE_IDS.target}
        type="target"
        position={Position.Left}
        ariaLabel={t('canvas.handle.in')}
        style={{ left: HANDLE_OFFSET }}
      />
    </div>
  )
}
