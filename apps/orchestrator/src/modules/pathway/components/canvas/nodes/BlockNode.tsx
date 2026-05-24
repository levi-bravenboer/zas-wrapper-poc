import { type Node, type NodeProps } from '@xyflow/react'
import type { TFunction } from 'i18next'
import { memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { BlockTypeIcon } from '../../../blockCatalogue'
import { blockSemanticsSummary } from '../../../blockCatalogue.utils'
import { laneAccent } from '../../../canvasLayout'
import type {
  BlockSemantics,
  PathwayBlock,
  PathwayBlockType,
  PathwayLane,
  PathwayTimingValue,
} from '../../../types'

function translateSemanticsSummary(
  t: TFunction<'pathway'>,
  semantics: BlockSemantics | undefined,
  value: string,
): string {
  // For enum-valued semantics, reuse the inspector option keys already
  // present in the pathway namespace. Free-text summaries (criterion, note,
  // appointment kind, form question count) pass through unchanged.
  switch (semantics) {
    case 'task':
      return t(`inspector.task.assigneeOption.${value}`, { defaultValue: value })
    case 'message':
      return t(`inspector.message.channelOption.${value}`, { defaultValue: value })
    case 'wait':
      return t(`eventType.${value}`, { defaultValue: value })
    case 'pathway_link':
      return t(`inspector.pathwayLink.modeOption.${value}`, { defaultValue: value })
    default:
      return value
  }
}

import { BlockNodeHandles } from './BlockNodeHandles'
import { DayChip } from './DayChip'
import { useBlockNodeStyles } from './useBlockNodeStyles'

export type BlockNodeData = {
  block: PathwayBlock
  blockType: PathwayBlockType | null
  lane: PathwayLane | null
  duration: PathwayTimingValue | null
  isEntry: boolean
}

export type BlockFlowNode = Node<BlockNodeData, 'block'>

export const BlockNode = memo(BlockNodeImpl)

function BlockNodeImpl({ data, selected }: NodeProps<BlockFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  const accent = data.lane ? laneAccent(data.lane) : 'var(--color-primary)'
  const typeLabel = t(`blockType.${data.block.type}`, {
    defaultValue: data.blockType?.label ?? data.block.type,
  })
  const name = data.block.label?.trim() || typeLabel
  const semanticsSummary = blockSemanticsSummary(data.blockType?.semantics, data.block.config)
  const summaryLabel = semanticsSummary
    ? translateSemanticsSummary(t, data.blockType?.semantics, semanticsSummary)
    : null
  const isBranch = !!data.blockType?.supports_branches
  const isSelected = !!selected
  const { containerStyle, iconStyle, railStyle } = useBlockNodeStyles({
    accent,
    selected: isSelected,
    isBranch,
  })

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${name}, type ${typeLabel}`}
      data-selected={isSelected || undefined}
      className="relative grid grid-cols-[4px_36px_1fr] grid-rows-[auto_auto] rounded-[6px] border bg-card shadow-sm transition-[box-shadow,border-color] hover:border-[color:var(--color-border-strong)] data-[selected]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lane-accent)_22%,transparent)]"
      style={containerStyle}
    >
      <div className="row-span-2 rounded-l-[5px]" style={railStyle} aria-hidden="true" />
      <div
        className="row-span-2 my-auto ml-1 inline-flex h-7 w-7 items-center justify-center rounded-sm"
        style={iconStyle}
      >
        <BlockTypeIcon icon={data.blockType?.icon} className="size-4" strokeWidth={1.7} />
      </div>
      <div className="flex flex-col gap-0.5 pr-2.5 pt-2">
        <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
          {name}
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          <span className="truncate">{summaryLabel ?? typeLabel}</span>
          {data.duration && (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-[2.5px] w-[2.5px] rounded-full bg-current opacity-45"
              />
              <DayChip value={data.duration} />
            </>
          )}
        </span>
      </div>
      {data.isEntry && (
        <span
          role="status"
          aria-label={t('entry.badge')}
          className="absolute -top-px -left-px z-[5] px-[7px] py-[3px] text-[9px] font-bold uppercase tracking-[0.09em] text-white"
          style={{
            background: 'var(--color-primary)',
            borderTopLeftRadius: 6,
            borderBottomRightRadius: 6,
          }}
        >
          {t('entry.badge')}
        </span>
      )}

      <BlockNodeHandles isBranch={isBranch} />
    </div>
  )
}
