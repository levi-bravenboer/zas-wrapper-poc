import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type Node, type NodeProps } from '@xyflow/react'
import { ArrowUpRight } from 'lucide-react'
import { memo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { getPathway, getPathwaySummary } from '../../../../../api'
import type { ConfigForSemantics } from '../../../../../configSchemas'
import { pathwayKeys } from '../../../../../keys'
import { useBuilderFlush } from '../../../useBuilderFlush'
import type { BlockNodeData } from '../../BlockNode'
import { BlockNodeHandles } from '../../BlockNodeHandles'

import { NestedPathwayHeader } from './NestedPathwayHeader'
import { NestedPathwayThumbnail } from './NestedPathwayThumbnail'

export type NestedPathwayBlockNodeData = BlockNodeData

export type NestedPathwayFlowNode = Node<NestedPathwayBlockNodeData, 'block'>

type NestedConfig = ConfigForSemantics<'pathway_link'>

// 40% larger than the previous compact card (was 280×200). Same outer chrome
// pattern as the Luscii block — left rail, glass title chip overlay, corner
// badge, meta chip — only the body content differs (renders a mini-DAG of
// the linked child pathway instead of a vendor program).
const BLOCK_WIDTH = 392
const BLOCK_HEIGHT = 280

export const NestedPathwayBlockNode = memo(NestedPathwayBlockNodeImpl)

function NestedPathwayBlockNodeImpl({
  data,
  selected,
}: NodeProps<NestedPathwayFlowNode>): ReactElement {
  const { t } = useTranslation('pathway')
  const { flush, saveState } = useBuilderFlush()

  const config = (data.block.config ?? {}) as NestedConfig
  const targetId = config.target_pathway_id ?? null
  const empty = !targetId

  const summaryQuery = useQuery({
    queryKey: targetId
      ? pathwayKeys.summary(targetId)
      : (['pathway', 'summary', '__none__'] as const),
    queryFn: () => (targetId ? getPathwaySummary(targetId) : Promise.resolve(null)),
    enabled: Boolean(targetId),
  })
  const summary = summaryQuery.data ?? null

  // Fetch the child's full version definition so the thumbnail can render a
  // real mini-DAG. The target picker already filters to pathways with at
  // least one published version, so this resolves to that version.
  const detailQuery = useQuery({
    queryKey: targetId
      ? pathwayKeys.detail(targetId)
      : (['pathway', 'detail', '__none__'] as const),
    queryFn: () => (targetId ? getPathway(targetId) : Promise.resolve(null)),
    enabled: Boolean(targetId),
  })
  const detail = detailQuery.data ?? null

  const subLine = summary?.latest_published_version_id
    ? `v · ${summary.latest_published_version_id.slice(0, 8)}`
    : null

  return (
    <div
      role="group"
      aria-label={
        empty
          ? t('inspector.pathwayLink.emptyAria')
          : `${t('inspector.pathwayLink.headerLabel')}: ${summary?.name ?? targetId}`
      }
      data-slot="nested-pathway-block"
      data-selected={selected || undefined}
      className="relative"
      style={{
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        ['--lane-accent' as string]: 'var(--lane-system)',
      }}
    >
      <div
        data-selected={selected || undefined}
        className="absolute inset-0 overflow-hidden rounded-[10px] border border-border bg-card shadow-sm transition-[box-shadow,border-color] hover:border-[color:var(--color-border-strong)] data-[selected]:border-[color:var(--lane-system)] data-[selected]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lane-system)_22%,transparent),var(--shadow-md)]"
      >
        {/* Left rail — internal-source accent */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-[1] w-1 rounded-l-[9px]"
          style={{
            backgroundImage:
              'linear-gradient(180deg, var(--lane-system) 0%, color-mix(in srgb, var(--lane-system) 70%, black) 100%)',
          }}
        />

        {/* Body thumbnail — mini-DAG of the child pathway */}
        {detail?.version && !empty ? (
          <NestedPathwayThumbnail
            phases={detail.version.phases ?? []}
            lanes={detail.version.lanes ?? []}
            blocks={detail.version.blocks ?? []}
            edges={detail.version.edges ?? []}
            width={BLOCK_WIDTH}
            height={BLOCK_HEIGHT}
          />
        ) : null}

        {/* Title overlay */}
        <NestedPathwayHeader
          pathwayName={summary?.name ?? null}
          subLine={subLine}
          empty={empty}
          emptyLabel={t('inspector.pathwayLink.emptyTitle')}
        />

        {/* Provider corner badge — internal source */}
        <span
          aria-hidden="true"
          className="absolute -right-px -top-px z-[5] inline-flex items-center gap-[3px] rounded-bl-[8px] rounded-tr-[10px] px-1.5 py-[3px] text-[9px] font-bold uppercase tracking-[0.09em] text-white"
          style={{ background: 'var(--lane-system)' }}
        >
          Pad
        </span>

        {/* Bottom meta chip — counts + Open CTA */}
        {!empty && summary && (
          <div
            data-slot="nested-pathway-meta"
            className="pointer-events-auto absolute bottom-2 left-3 right-3 z-10 flex items-center justify-between gap-2 rounded-md border border-white/70 bg-white/90 px-2.5 py-1.5 text-[10.5px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur"
            style={{ backdropFilter: 'blur(10px) saturate(160%)' }}
          >
            <div className="flex items-center gap-3 font-mono text-muted-foreground">
              <span>
                <span className="text-foreground">{summary.lane_count}</span>{' '}
                {t('inspector.pathwayLink.summary.lanes')}
              </span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>
                <span className="text-foreground">{summary.block_count}</span>{' '}
                {t('inspector.pathwayLink.summary.blocks')}
              </span>
            </div>
            <Link
              to="/pathways/$pathwayId"
              params={{ pathwayId: targetId ?? '' }}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => flush()}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 font-medium text-foreground hover:bg-muted"
              style={{ borderColor: 'var(--hairline)' }}
            >
              <span>{t('inspector.pathwayLink.openChild')}</span>
              {saveState === 'saving' && (
                <span className="text-[9px] text-muted-foreground">{t('save.saving')}</span>
              )}
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        )}
      </div>

      <BlockNodeHandles isBranch={false} />
    </div>
  )
}
