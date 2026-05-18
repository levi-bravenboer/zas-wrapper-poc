import { AlertCircle, Trash2, X } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { BlockTypeIcon } from '../../blockCatalogue'
import { laneAccent } from '../../canvasLayout'
import { CONFIG_SCHEMAS, defaultConfig, type ConfigForSemantics } from '../../configSchemas'
import type {
  BlockConfig,
  PathwayBlock,
  PathwayBlockBranch,
  PathwayBlockType,
  PathwayLane,
} from '../../types'

import { AppointmentInspector } from './inspectors/AppointmentInspector'
import { DecisionInspector } from './inspectors/DecisionInspector'
import { FormInspector } from './inspectors/FormInspector'
import { MessageInspector } from './inspectors/MessageInspector'
import { MilestoneInspector } from './inspectors/MilestoneInspector'
import { PathwayLinkInspector } from './inspectors/PathwayLinkInspector'
import { TaskInspector } from './inspectors/TaskInspector'
import { WaitInspector } from './inspectors/WaitInspector'

type Props = {
  block: PathwayBlock
  blockType: PathwayBlockType | null
  lane: PathwayLane | null
  blocks: PathwayBlock[]
  branches: PathwayBlockBranch[]
  currentPathwayId: string
  onPatchConfig: (next: BlockConfig) => void
  onRename: (label: string) => void
  onClose: () => void
  onDelete: () => void
}

export function BuilderDrawer({
  block,
  blockType,
  lane,
  blocks,
  branches,
  currentPathwayId,
  onPatchConfig,
  onRename,
  onClose,
  onDelete,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const accent = lane ? laneAccent(lane) : 'var(--color-primary)'
  const typeLabel = t(`blockType.${block.type}`, { defaultValue: blockType?.label ?? block.type })

  const parsed = useMemo(() => {
    if (!blockType) return null
    return CONFIG_SCHEMAS[blockType.semantics].safeParse(block.config ?? {})
  }, [blockType, block.config])

  return (
    <aside
      data-slot="block-inspector"
      className="absolute inset-y-0 right-0 z-20 flex w-[360px] flex-col gap-3 border-l bg-white/95 shadow-xl backdrop-blur-md"
      style={{ borderLeftColor: 'var(--hairline)' }}
    >
      <header
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderBottomColor: 'var(--hairline)' }}
      >
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm"
          style={{
            background: `color-mix(in srgb, ${accent} 12%, var(--card))`,
            color: accent,
          }}
        >
          <BlockTypeIcon icon={blockType?.icon} className="size-4" strokeWidth={1.7} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <input
            value={block.label ?? ''}
            placeholder={typeLabel}
            onChange={(e) => onRename(e.target.value)}
            className="bg-transparent text-[14px] font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
          />
          <span className="text-[11px] text-muted-foreground">
            {typeLabel}
            {lane && (
              <>
                {' · '}
                {t(`lane.${lane.lane_kind_code}`, { defaultValue: lane.label })}
              </>
            )}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('drawer.close')}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('drawer.configHeader')}
        </h3>
        {blockType && parsed && !parsed.success && (
          <div
            role="alert"
            className="mb-3 flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive"
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="size-4" />
              {t('drawer.parseError.title')}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPatchConfig(defaultConfig(blockType.semantics))}
            >
              {t('drawer.parseError.reset')}
            </Button>
          </div>
        )}
        {blockType && parsed && parsed.success && (
          <InspectorSwitch
            blockType={blockType}
            block={block}
            data={parsed.data}
            blocks={blocks}
            branches={branches}
            currentPathwayId={currentPathwayId}
            onPatchConfig={onPatchConfig}
          />
        )}
        {!blockType && <p className="text-xs text-muted-foreground">{typeLabel}</p>}
      </div>

      <footer
        className="flex items-center justify-between border-t px-4 py-3"
        style={{ borderTopColor: 'var(--hairline)' }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
          {t('drawer.delete')}
        </Button>
        <Button type="button" onClick={onClose}>
          {t('drawer.done')}
        </Button>
      </footer>
    </aside>
  )
}

type SwitchProps = {
  blockType: PathwayBlockType
  block: PathwayBlock
  data: ConfigForSemantics<PathwayBlockType['semantics']>
  blocks: PathwayBlock[]
  branches: PathwayBlockBranch[]
  currentPathwayId: string
  onPatchConfig: (next: BlockConfig) => void
}

function InspectorSwitch({
  blockType,
  block,
  data,
  blocks,
  branches,
  currentPathwayId,
  onPatchConfig,
}: SwitchProps): ReactElement | null {
  const semantics = blockType.semantics
  switch (semantics) {
    case 'appointment':
      return (
        <AppointmentInspector
          config={data as ConfigForSemantics<'appointment'>}
          onChange={onPatchConfig}
        />
      )
    case 'task':
      return <TaskInspector config={data as ConfigForSemantics<'task'>} onChange={onPatchConfig} />
    case 'message':
      return (
        <MessageInspector config={data as ConfigForSemantics<'message'>} onChange={onPatchConfig} />
      )
    case 'form':
      return <FormInspector config={data as ConfigForSemantics<'form'>} onChange={onPatchConfig} />
    case 'decision':
      return (
        <DecisionInspector
          config={data as ConfigForSemantics<'decision'>}
          branches={branches}
          onChange={onPatchConfig}
        />
      )
    case 'milestone':
      return (
        <MilestoneInspector
          config={data as ConfigForSemantics<'milestone'>}
          onChange={onPatchConfig}
        />
      )
    case 'wait':
      return (
        <WaitInspector
          config={data as ConfigForSemantics<'wait'>}
          blocks={blocks}
          currentBlockId={block.id}
          onChange={onPatchConfig}
        />
      )
    case 'pathway_link':
      return (
        <PathwayLinkInspector
          config={data as ConfigForSemantics<'pathway_link'>}
          currentPathwayId={currentPathwayId}
          onChange={onPatchConfig}
        />
      )
    default: {
      // Exhaustiveness — if a new semantics is added without a case, schemas map ensures TS will catch it.
      void (CONFIG_SCHEMAS satisfies Record<PathwayBlockType['semantics'], unknown>)
      return null
    }
  }
}
