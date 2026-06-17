import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

export interface RuntimePlayheadProps {
  x: number
  height: number
}

// Video-editor style playhead: a vertical line marking the current position
// (the active step) in the pathway. Rendered in flow coordinates.
export function RuntimePlayhead({ x, height }: RuntimePlayheadProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2"
      style={{ left: x, top: 0, height, zIndex: 5 }}
    >
      <div className="mx-auto h-full w-0.5" style={{ backgroundColor: 'var(--color-primary)' }} />
      <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
        {t('timeline.state.next')}
      </span>
    </div>
  )
}
