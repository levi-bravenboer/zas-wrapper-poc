import { ChevronRight } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { phaseTint } from '../../canvasLayout'
import type { PathwayPhase, PathwayPhaseTemplate } from '../../types'

import { PhasePickerPopover } from './PhasePickerPopover'

type Props = {
  phases: PathwayPhase[]
  templates: PathwayPhaseTemplate[]
  onJumpToPhase: (phaseId: string) => void
  onAddPhase: (template: PathwayPhaseTemplate | null) => void
}

export function BuilderSubbar({
  phases,
  templates,
  onJumpToPhase,
  onAddPhase,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const sorted = [...phases].sort((a, b) => a.ord - b.ord)
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
        return (
          <span key={phase.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onJumpToPhase(phase.id)}
              aria-label={t('subbar.phaseLabel', { idx: i + 1 }) + ' ' + phase.label}
              className="inline-flex h-7 items-center gap-2 rounded-sm px-2.5 text-[12.5px] font-medium text-foreground hover:bg-black/[0.04]"
            >
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
