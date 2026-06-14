import { Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, type ReactElement } from 'react'

import { BlockTypeIcon } from '../../../blockCatalogue'
import { laneAccent } from '../../../canvasLayout'
import { HANDLE_IDS, HANDLE_OFFSET } from '../../../constants/edge'

import type { BlockNodeData } from './BlockNode'
import { HandlePort } from './HandlePort'

export type MarkerFlowNode = Node<BlockNodeData, 'block'>

type Props = NodeProps<MarkerFlowNode> & {
  /** Lucide icon name fallback when blockType is missing. */
  fallbackIcon: string
  /** Direction of the single handle: `source` for the head marker
   * (Start), `target` for the terminal marker (End). */
  handle: 'source' | 'target'
  /** Aria label rendered on the circle. */
  ariaLabel: string
  /** Aria label of the handle. */
  handleAriaLabel: string
  /** Optional visual emphasis: `strong` thickens the border (used by
   * EndPathway so the terminal reads heavier than Start). */
  emphasis?: 'soft' | 'strong'
}

// Pathway-completion §A1 / §A2: shared shell for marker blocks
// (Start, EndPathway). The shape — circular, no subtitle, single
// handle, no hover-X — is identical across markers; only the handle
// direction, fallback icon, and aria copy change. h-16 w-16 = 64px,
// must stay in lockstep with START_DIMENSIONS / END_DIMENSIONS in
// blockDimensions.ts so the rendered circle matches the xyflow node
// bounding box.
export const MarkerCircleBlockNode = memo(MarkerCircleBlockNodeImpl)

function MarkerCircleBlockNodeImpl({
  data,
  selected,
  fallbackIcon,
  handle,
  ariaLabel,
  handleAriaLabel,
  emphasis = 'soft',
}: Props): ReactElement {
  const accent = data.lane ? laneAccent(data.lane) : 'var(--color-primary)'
  const isSelected = !!selected
  const borderClass = emphasis === 'strong' ? 'border-2' : 'border'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      data-selected={isSelected || undefined}
      className={`group relative flex h-16 w-16 items-center justify-center rounded-full ${borderClass} bg-card shadow-sm transition-[box-shadow,border-color] hover:border-[color:var(--color-border-strong)] data-[selected]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lane-accent)_22%,transparent)]`}
      style={
        {
          ['--lane-accent' as string]: accent,
          borderColor: accent,
          background: `color-mix(in srgb, ${accent} 8%, var(--color-card))`,
        } as React.CSSProperties
      }
    >
      <BlockTypeIcon
        icon={data.blockType?.icon ?? fallbackIcon}
        className="size-6"
        strokeWidth={1.8}
        style={{ color: accent }}
      />
      {handle === 'source' ? (
        <HandlePort
          id={HANDLE_IDS.source.plain}
          type="source"
          position={Position.Right}
          ariaLabel={handleAriaLabel}
          style={{ right: HANDLE_OFFSET }}
        />
      ) : (
        <HandlePort
          id={HANDLE_IDS.target}
          type="target"
          position={Position.Left}
          ariaLabel={handleAriaLabel}
          style={{ left: HANDLE_OFFSET }}
        />
      )}
    </div>
  )
}
