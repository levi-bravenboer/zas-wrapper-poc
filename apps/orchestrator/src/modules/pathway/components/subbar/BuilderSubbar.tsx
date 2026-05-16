import { ChevronRight, GripVertical } from 'lucide-react'
import { useState, type DragEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { sortByOrd } from '@/lib/utils/ordinal'

import { phaseTint } from '../../canvasLayout'
import { DRAG_TYPES } from '../../constants/dragTypes'
import type { PathwayPhase, PathwayPhaseTemplate } from '../../types'

import { PhasePickerPopover } from './PhasePickerPopover'

type Props = {
  phases: PathwayPhase[]
  templates: PathwayPhaseTemplate[]
  onJumpToPhase: (phaseId: string) => void
  onAddPhase: (template: PathwayPhaseTemplate | null, customLabel?: string) => void
  onReorderPhase: (phaseId: string, toIndex: number) => void
}

export function BuilderSubbar({
  phases,
  templates,
  onJumpToPhase,
  onAddPhase,
  onReorderPhase,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const sorted = sortByOrd(phases)
  type DragState = { id: string; targetIndex: number | null }
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragId = drag?.id ?? null
  const dropIndex = drag?.targetIndex ?? null

  const onDragStart = (event: DragEvent<HTMLSpanElement>, id: string) => {
    setDrag({ id, targetIndex: null })
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_TYPES.PHASE_ID, id)
  }
  const onDragOverPhase = (event: DragEvent<HTMLSpanElement>, index: number) => {
    if (!drag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDrag({ id: drag.id, targetIndex: index })
  }
  const onDropPhase = (event: DragEvent<HTMLSpanElement>, index: number) => {
    event.preventDefault()
    const id = drag?.id ?? event.dataTransfer.getData(DRAG_TYPES.PHASE_ID)
    setDrag(null)
    if (!id) return
    const clamped = Math.max(0, Math.min(sorted.length - 1, index))
    onReorderPhase(id, clamped)
  }
  const onDragEnd = () => setDrag(null)

  return (
    <nav
      aria-label={t('subbar.navLabel')}
      data-slot="builder-subbar"
      className="relative flex h-11 items-center gap-0.5 px-3.5"
    >
      <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {t('subbar.jumpTo')}
      </span>
      {sorted.map((phase, i) => {
        const tint = phaseTint(i)
        const dragging = dragId === phase.id
        const dropTarget = dropIndex === i && dragId !== null && dragId !== phase.id
        return (
          <span
            key={phase.id}
            draggable
            onDragStart={(event) => onDragStart(event, phase.id)}
            onDragOver={(event) => onDragOverPhase(event, i)}
            onDrop={(event) => onDropPhase(event, i)}
            onDragEnd={onDragEnd}
            data-dragging={dragging ? 'true' : 'false'}
            data-droptarget={dropTarget ? 'true' : 'false'}
            className="inline-flex items-center gap-0.5 data-[dragging=true]:opacity-50 data-[droptarget=true]:ring-1 data-[droptarget=true]:ring-[color:var(--color-primary)] rounded-sm"
          >
            <button
              type="button"
              onClick={() => onJumpToPhase(phase.id)}
              aria-label={t('subbar.phaseLabel', { idx: i + 1 }) + ' ' + phase.label}
              className="inline-flex h-7 cursor-grab items-center gap-2 rounded-sm px-2.5 text-[12.5px] font-medium text-foreground hover:bg-black/[0.04] active:cursor-grabbing"
            >
              <GripVertical
                aria-hidden="true"
                className="size-3 text-muted-foreground opacity-60"
                strokeWidth={1.6}
              />
              <span
                aria-hidden="true"
                className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10.5px] font-semibold tabular-nums"
                style={{ background: tint.soft, color: tint.ink }}
              >
                {i + 1}
              </span>
              <span>{phase.label}</span>
            </button>
            {i < sorted.length - 1 && (
              <ChevronRight
                aria-hidden="true"
                className="size-3 text-[color:var(--color-border-strong)]"
              />
            )}
          </span>
        )
      })}
      <PhasePickerPopover templates={templates} onPick={onAddPhase} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.06) 50%, transparent 100%)',
        }}
      />
    </nav>
  )
}
