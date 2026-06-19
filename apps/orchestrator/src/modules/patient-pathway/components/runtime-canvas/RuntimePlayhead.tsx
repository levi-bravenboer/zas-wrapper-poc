import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

export interface RuntimePlayheadProps {
  x: number
  height: number
}

const HEAD_OFFSET = 40

// Video-editor style playhead marking the current position (active step):
// a labelled "Nu" head with a downward pointer, over a dashed vertical line.
export function RuntimePlayhead({ x, height }: RuntimePlayheadProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
      style={{ left: x, top: -HEAD_OFFSET, zIndex: 6 }}
    >
      <div className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md">
        {t('timeline.state.next')}
      </div>
      <div
        className="size-2 -translate-y-1/2 rotate-45 bg-primary"
        style={{ borderRadius: 1 }}
        aria-hidden
      />
      <div
        className="w-px"
        style={{
          height,
          backgroundImage:
            'repeating-linear-gradient(to bottom, var(--color-primary) 0 6px, transparent 6px 12px)',
        }}
        aria-hidden
      />
    </div>
  )
}
