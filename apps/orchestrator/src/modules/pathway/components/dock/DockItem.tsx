import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { BlockTypeIcon } from '../../blockCatalogue'
import type { PathwayBlockType } from '../../types'

type Props = {
  blockType: PathwayBlockType
  onAdd: () => void
}

// Pathway-completion § C2: the dock is click-only. Clicking a tile opens
// the block dialog (add mode); dragging onto the canvas is retired —
// placement is computed by the auto-layout pass.
export function DockItem({ blockType, onAdd }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const label = t(`blockType.${blockType.type}`, { defaultValue: blockType.label })
  const desc = t(`blockTypeDescription.${blockType.type}`, { defaultValue: '' })

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onAdd}
            aria-label={t('dock.addLabel', { label })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-black/[0.05] hover:text-foreground"
          >
            <BlockTypeIcon icon={blockType.icon} className="size-4" strokeWidth={1.8} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-semibold">{label}</span>
            {desc && <span className="text-[11px] text-muted-foreground">{desc}</span>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
