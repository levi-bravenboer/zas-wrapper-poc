import { useQuery } from '@tanstack/react-query'
import { type Node, type NodeProps } from '@xyflow/react'
import { memo, type ReactElement } from 'react'

import type { ConfigForSemantics } from '../../../../../configSchemas'
import {
  computeLusciiProgramDimensions,
  type BlockDimensions,
} from '../../../../../utils/blockDimensions'
import type { BlockNodeData } from '../../BlockNode'

import { getLusciiProgram } from './api'
import { lusciiKeys } from './keys'
import { LusciiProgramHeader } from './LusciiProgramHeader'
import { LusciiProgramThumbnail } from './LusciiProgramThumbnail'
import { buildSubLine } from './subLine'
import type { LusciiProgramData } from './types'

// Extend the generic `BlockNodeData` rather than reinvent it — keeps the
// router's prop-shape variance manageable (a plain `as` cast in
// `BlockNodeRouter` instead of `as unknown as`) and inherits future
// additions (duration / isEntry) without redeclaration.
export type LusciiProgramBlockNodeData = BlockNodeData & {
  /** Optional eager-resolved program — when supplied by the parent (e.g. a
   * preview surface), the node renders it directly. When absent, the node
   * fetches via TanStack against `config.program_id`. */
  resolvedProgram?: LusciiProgramData | null
}

export type LusciiProgramFlowNode = Node<LusciiProgramBlockNodeData, 'block'>

type LusciiConfig = ConfigForSemantics<'external_program'>

export const LusciiProgramBlockNode = memo(LusciiProgramBlockNodeImpl)

function LusciiProgramBlockNodeImpl({
  data,
  selected,
}: NodeProps<LusciiProgramFlowNode>): ReactElement {
  // reason: `block.config` is the union of all per-semantics configs at the
  // generic site; narrow to the Luscii-shaped variant here. The runtime
  // contract is enforced by `CONFIG_SCHEMAS.external_program` at the
  // BuilderDrawer save path, so this narrowing is safe to perform with `as`.
  const config = (data.block.config ?? {}) as LusciiConfig
  const empty = !config.program_id

  // Resolve the program: parent override wins (preview/test surfaces), else
  // fetch via TanStack so the same cache feeds the inspector and the node.
  const programQuery = useQuery({
    queryKey: lusciiKeys.program(config.program_id ?? ''),
    queryFn: () => getLusciiProgram(config.program_id ?? ''),
    enabled: data.resolvedProgram === undefined && Boolean(config.program_id),
  })
  const program = data.resolvedProgram ?? programQuery.data ?? null

  const dims: BlockDimensions = computeLusciiProgramDimensions(program)
  const subLine = buildSubLine(program, config.protocol_id ?? null, config.mode ?? null)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        empty
          ? 'Luscii Program — pick a program'
          : `Luscii Program: ${program?.name ?? config.program_id ?? 'unknown'}`
      }
      data-slot="luscii-program-block"
      data-selected={selected ? 'true' : 'false'}
      className="relative overflow-hidden rounded-[10px] border border-border bg-card shadow-sm transition-[box-shadow,border-color] hover:border-[color:var(--color-border-strong)] data-[selected=true]:border-[color:var(--lane-external)] data-[selected=true]:shadow-[0_0_0_4px_color-mix(in_srgb,var(--lane-external)_22%,transparent),var(--shadow-md)]"
      style={{ width: dims.width, height: dims.height }}
    >
      {/* Rail */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-[1] w-1 rounded-l-[9px]"
        style={{
          background:
            'linear-gradient(180deg, var(--lane-external) 0%, color-mix(in srgb, var(--lane-external) 70%, black) 100%)',
        }}
      />
      {/* Body thumbnail (under the title chip + provider badge) */}
      <LusciiProgramThumbnail data={program} width={dims.width} height={dims.height} />
      {/* Title overlay */}
      <LusciiProgramHeader programName={program?.name ?? null} subLine={subLine} empty={empty} />
      {/* Provider corner badge */}
      <span
        aria-hidden="true"
        className="absolute -right-px -top-px z-[5] inline-flex items-center gap-[3px] rounded-bl-[8px] rounded-tr-[10px] px-1.5 py-[3px] text-[9px] font-bold uppercase tracking-[0.09em] text-white"
        style={{ background: 'oklch(0.45 0.18 250)' }}
      >
        Luscii
      </span>
    </div>
  )
}
