import { type Node, type NodeProps } from '@xyflow/react'
import { Check } from 'lucide-react'
import { memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { BlockTypeIcon } from '@/modules/pathway/blockCatalogue'
import { BlockNodeHandles } from '@/modules/pathway/components/canvas/nodes/BlockNodeHandles'
import { legacyBlockType, type PathwayBlock, type PathwayBlockType } from '@/modules/pathway/types'

import { RUNTIME_STATE_COLOR, type RuntimeBlockStatus } from './runtimeState'

export interface RuntimeNodeData {
  block: PathwayBlock
  blockType: PathwayBlockType | null
  status: RuntimeBlockStatus | undefined
  [key: string]: unknown
}

export type RuntimeFlowNode = Node<RuntimeNodeData, 'runtime'>

function RuntimeBlockNodeImpl({ data }: NodeProps<RuntimeFlowNode>): ReactElement {
  const { t, i18n } = useTranslation('pathway')
  const { block, blockType, status } = data
  const state = status?.state ?? 'pending'
  const legacyType = legacyBlockType(block)
  const typeLabel = t(`blockType.${legacyType}`, { defaultValue: blockType?.label ?? legacyType })
  const name = block.name?.trim() || typeLabel
  const isBranch = !!blockType?.supports_branches

  const finished = state === 'finished'
  const active = state === 'active'
  const skipped = state === 'skipped'
  const dim = state === 'upcoming' || state === 'pending' || skipped
  // No swimlanes here — the rail conveys runtime state instead of lane.
  const railColor = RUNTIME_STATE_COLOR[state]
  const isMarker = block.kind === 'start' || block.kind === 'end_pathway'

  if (isMarker) {
    return (
      <div
        className={cn(
          'relative grid h-full w-full place-items-center rounded-full border-2 bg-card transition-opacity',
          dim && 'opacity-55',
        )}
        style={{ borderColor: railColor }}
        title={name}
      >
        <BlockTypeIcon
          icon={blockType?.icon}
          className="size-5 text-muted-foreground"
          strokeWidth={1.8}
        />
        {finished ? (
          <span
            className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full text-white"
            style={{ backgroundColor: RUNTIME_STATE_COLOR.finished }}
            aria-hidden
          >
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        ) : null}
        <BlockNodeHandles isBranch={false} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative grid h-full w-full grid-cols-[3px_28px_1fr] items-stretch overflow-hidden rounded-lg border bg-card transition-opacity',
        active ? 'border-primary shadow-md' : 'shadow-sm',
        dim && 'opacity-55',
      )}
    >
      <div className="row-span-2" style={{ backgroundColor: railColor }} aria-hidden />
      <div
        className={cn(
          'my-auto ml-1.5 grid size-7 place-items-center rounded-md',
          finished ? 'text-[color:var(--color-success)]' : 'bg-muted text-muted-foreground',
        )}
        style={
          finished
            ? { backgroundColor: 'color-mix(in srgb, var(--color-success) 14%, transparent)' }
            : undefined
        }
      >
        <BlockTypeIcon icon={blockType?.icon} className="size-4" strokeWidth={1.7} />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 px-2.5 py-1.5">
        <span
          className={cn(
            'truncate text-[13px] font-semibold tracking-tight text-foreground',
            skipped && 'line-through',
          )}
        >
          {name}
        </span>
        {finished && status?.completedAt ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {formatDateOrDash(status.completedAt, i18n.language)}
            {status.completedByName ? ` · ${status.completedByName}` : ''}
          </span>
        ) : (
          <span className="truncate text-[11px] text-muted-foreground">{typeLabel}</span>
        )}
      </div>

      {finished ? (
        <span
          className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full text-white"
          style={{ backgroundColor: RUNTIME_STATE_COLOR.finished }}
          aria-hidden
        >
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      ) : null}

      <BlockNodeHandles isBranch={isBranch} />
    </div>
  )
}

export const RuntimeBlockNode = memo(RuntimeBlockNodeImpl)
