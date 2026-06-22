import { GripVertical, Pencil, X } from 'lucide-react'
import { type DragEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { useEditableField } from '@/lib/hooks/useEditableField'

import { phaseTint } from '../../canvasLayout'
import type { PathwayPhase } from '../../types'

type Props = {
  phase: PathwayPhase
  index: number
  dragging: boolean
  dropTarget: boolean
  onJump: () => void
  onRename: (label: string) => void
  onRequestDelete: () => void
  onDragStart: (event: DragEvent<HTMLSpanElement>) => void
  onDragOver: (event: DragEvent<HTMLSpanElement>) => void
  onDrop: (event: DragEvent<HTMLSpanElement>) => void
  onDragEnd: () => void
}

export function PhasePill({
  phase,
  index,
  dragging,
  dropTarget,
  onJump,
  onRename,
  onRequestDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const tint = phaseTint(index)
  const { editing, draft, inputRef, startEditing, setDraft, commit, onKeyDown } = useEditableField({
    value: phase.label,
    onCommit: onRename,
  })

  return (
    <span
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-dragging={dragging ? 'true' : 'false'}
      data-droptarget={dropTarget ? 'true' : 'false'}
      className="group/phase inline-flex items-center gap-0.5 rounded-sm data-[dragging=true]:opacity-50 data-[droptarget=true]:ring-1 data-[droptarget=true]:ring-[color:var(--color-primary)]"
    >
      <span className="inline-flex h-7 items-center gap-2 rounded-sm px-2.5 text-[12.5px] font-medium text-foreground">
        <GripVertical
          aria-hidden="true"
          className="size-3 cursor-grab text-muted-foreground opacity-60 active:cursor-grabbing"
          strokeWidth={1.6}
        />
        <span
          aria-hidden="true"
          className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10.5px] font-semibold tabular-nums"
          style={{ background: tint.soft, color: tint.ink }}
        >
          {index + 1}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            aria-label={t('subbar.renamePhase')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            size={Math.max(6, draft.length + 1)}
            className="bg-transparent text-[12.5px] font-medium text-foreground outline-none focus:underline"
          />
        ) : (
          <button
            type="button"
            onClick={onJump}
            aria-label={t('subbar.phaseJumpLabel', { idx: index + 1, label: phase.label })}
            className="rounded-sm hover:underline"
          >
            {phase.label}
          </button>
        )}
      </span>
      {!editing && (
        <span className="inline-flex items-center opacity-0 transition-opacity group-hover/phase:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label={t('subbar.renamePhase')}
            className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
            onClick={startEditing}
          >
            <Pencil className="size-3" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            aria-label={t('subbar.deletePhase')}
            className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onRequestDelete}
          >
            <X className="size-3" strokeWidth={1.8} />
          </button>
        </span>
      )}
    </span>
  )
}
