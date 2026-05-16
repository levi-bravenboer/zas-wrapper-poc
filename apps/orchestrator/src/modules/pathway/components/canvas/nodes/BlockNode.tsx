import { Position, type NodeProps } from '@xyflow/react'
import { type CSSProperties, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { BlockTypeIcon } from '../../../blockCatalogue'
import { laneAccent } from '../../../canvasLayout'
import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayLane,
  PathwayTimingValue,
} from '../../../types'

import { DayChip } from './DayChip'
import { HandlePort } from './HandlePort'

export type BlockNodeData = {
  block: PathwayBlock
  blockType: PathwayBlockType | null
  lane: PathwayLane | null
  duration: PathwayTimingValue | null
  isEntry: boolean
}

export function BlockNode({ data, selected }: NodeProps): ReactElement {
  const { t } = useTranslation('pathway')
  const d = data as unknown as BlockNodeData
  const accent = d.lane ? laneAccent(d.lane) : 'var(--color-primary)'
  const typeLabel = t(`blockType.${d.block.type}`, {
    defaultValue: d.blockType?.label ?? d.block.type,
  })
  const name = d.block.label?.trim() || typeLabel
  const isBranch = Boolean(d.blockType?.supports_branches)

  const style = {
    '--lane-accent': accent,
    width: 240,
    height: 64,
  } as CSSProperties

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${name}, type ${typeLabel}`}
      data-selected={selected ? 'true' : 'false'}
      className="relative grid grid-cols-[4px_36px_1fr] grid-rows-[auto_auto] rounded-[6px] border bg-card shadow-sm transition-[box-shadow,border-color] hover:border-[color:var(--color-border-strong)] data-[selected=true]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lane-accent)_22%,transparent)]"
      style={{
        ...style,
        borderColor: selected ? accent : undefined,
        borderWidth: selected ? 1.5 : 1,
        borderStyle: isBranch ? 'dashed' : 'solid',
      }}
    >
      <div
        className="row-span-2 rounded-l-[5px]"
        style={{ background: accent }}
        aria-hidden="true"
      />
      <div
        className="row-span-2 my-auto ml-1 inline-flex h-7 w-7 items-center justify-center rounded-sm"
        style={{
          background: 'color-mix(in srgb, var(--lane-accent) 12%, var(--card))',
          color: accent,
        }}
      >
        <BlockTypeIcon type={d.block.type} className="size-4" strokeWidth={1.7} />
      </div>
      <div className="flex flex-col gap-0.5 pr-2.5 pt-2">
        <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
          {name}
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          <span className="truncate">{typeLabel}</span>
          {d.duration && (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-[2.5px] w-[2.5px] rounded-full bg-current opacity-45"
              />
              <DayChip value={d.duration} />
            </>
          )}
        </span>
      </div>
      {d.isEntry && (
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

      <HandlePort
        id="in"
        type="target"
        position={Position.Left}
        ariaLabel="Verbinding in"
        style={{ left: -6 }}
      />
      {isBranch ? (
        <>
          <HandlePort
            id="yes"
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding ja-tak"
            style={{ right: -6, top: '28%' }}
          />
          <HandlePort
            id="no"
            type="source"
            position={Position.Right}
            ariaLabel="Verbinding nee-tak"
            style={{ right: -6, top: '72%' }}
          />
        </>
      ) : (
        <HandlePort
          id="out"
          type="source"
          position={Position.Right}
          ariaLabel="Verbinding uit"
          style={{ right: -6 }}
        />
      )}
    </div>
  )
}
