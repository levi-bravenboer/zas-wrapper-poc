import type { RJSFSchema } from '@rjsf/utils'
import { Trash2, X } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { BlockTypeIcon } from '../../blockCatalogue'
import { laneAccent } from '../../canvasLayout'
import type {
  BlockConfig,
  BlockConfigSchema,
  PathwayBlock,
  PathwayBlockType,
  PathwayLane,
} from '../../types'

import { ConfigForm } from './ConfigForm'

type Props = {
  block: PathwayBlock
  blockType: PathwayBlockType | null
  lane: PathwayLane | null
  onPatchConfig: (next: BlockConfig) => void
  onRename: (label: string) => void
  onClose: () => void
  onDelete: () => void
}

function toRJSFSchema(schema: BlockConfigSchema): RJSFSchema {
  return schema as RJSFSchema
}

export function BuilderDrawer({
  block,
  blockType,
  lane,
  onPatchConfig,
  onRename,
  onClose,
  onDelete,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const accent = lane ? laneAccent(lane) : 'var(--color-primary)'
  const typeLabel = t(`blockType.${block.type}`, { defaultValue: blockType?.label ?? block.type })

  return (
    <aside
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
          <BlockTypeIcon type={block.type} className="size-4" strokeWidth={1.7} />
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
        {blockType ? (
          <ConfigForm
            schema={toRJSFSchema(blockType.config_schema)}
            formData={block.config ?? {}}
            onChange={onPatchConfig}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
        )}
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
