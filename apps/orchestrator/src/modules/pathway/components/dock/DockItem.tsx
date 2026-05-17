import { useViewport } from '@xyflow/react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createBlockDragGhost } from '@/lib/utils/dragGhost'

import { BlockTypeIcon } from '../../blockCatalogue'
import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../../canvasLayout'
import { CANVAS_VIEWPORT } from '../../constants/canvas'
import { DRAG_TYPES } from '../../constants/dragTypes'
import type { PathwayBlockType } from '../../types'

type Props = {
  blockType: PathwayBlockType
  onAdd: () => void
  onDragStartType?: ((blockType: PathwayBlockType) => void) | undefined
  onDragEndType?: (() => void) | undefined
}

export function DockItem({
  blockType,
  onAdd,
  onDragStartType,
  onDragEndType,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const { zoom } = useViewport()
  const label = t(`blockType.${blockType.type}`, { defaultValue: blockType.label })
  const desc = t(`blockTypeDescription.${blockType.type}`, { defaultValue: '' })

  function onDragStart(event: React.DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData(DRAG_TYPES.BLOCK_TYPE, blockType.type)
    event.dataTransfer.setData('text/plain', blockType.type)
    event.dataTransfer.effectAllowed = 'copy'
    onDragStartType?.(blockType)
    const safeZoom = Math.min(
      Math.max(zoom || 1, CANVAS_VIEWPORT.minZoom),
      CANVAS_VIEWPORT.maxZoom,
    )
    const ghost = createBlockDragGhost({
      label,
      iconText: blockType.type.slice(0, 1).toUpperCase(),
      width: BLOCK_WIDTH * safeZoom,
      height: BLOCK_HEIGHT * safeZoom,
      zoom: safeZoom,
    })
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(
      ghost,
      (BLOCK_WIDTH * safeZoom) / 2,
      (BLOCK_HEIGHT * safeZoom) / 2,
    )
    window.setTimeout(() => ghost.remove(), 0)
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEndType}
      className="inline-flex cursor-grab active:cursor-grabbing"
    >
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
    </div>
  )
}
