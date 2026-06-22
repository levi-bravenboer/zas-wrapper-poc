import { type DragEvent, type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { sortByOrd } from '@/lib/utils/ordinal'

import { DRAG_TYPES } from '../../constants/dragTypes'
import type { PathwayPhase, PathwayPhaseTemplate } from '../../types'

import { PhasePickerPopover } from './PhasePickerPopover'
import { PhasePill } from './PhasePill'

type Props = {
  phases: PathwayPhase[]
  templates: PathwayPhaseTemplate[]
  onJumpToPhase: (phaseId: string) => void
  onAddPhase: (template: PathwayPhaseTemplate | null, customLabel?: string) => void
  onReorderPhase: (phaseId: string, toIndex: number) => void
  onRenamePhase: (phaseId: string, label: string) => void
  onRequestDeletePhase: (phaseId: string) => void
}

export function BuilderSubbar({
  phases,
  templates,
  onJumpToPhase,
  onAddPhase,
  onReorderPhase,
  onRenamePhase,
  onRequestDeletePhase,
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
      {sorted.map((phase, i) => (
        <PhasePill
          key={phase.id}
          phase={phase}
          index={i}
          dragging={dragId === phase.id}
          dropTarget={dropIndex === i && dragId !== null && dragId !== phase.id}
          onJump={() => onJumpToPhase(phase.id)}
          onRename={(label) => onRenamePhase(phase.id, label)}
          onRequestDelete={() => onRequestDeletePhase(phase.id)}
          onDragStart={(event) => onDragStart(event, phase.id)}
          onDragOver={(event) => onDragOverPhase(event, i)}
          onDrop={(event) => onDropPhase(event, i)}
          onDragEnd={onDragEnd}
        />
      ))}
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
