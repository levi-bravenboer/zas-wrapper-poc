import { Loader2 } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

export type SaveState = 'clean' | 'dirty' | 'saving' | 'error'

type Props = { state: SaveState }

export function SaveStatusPill({ state }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const dotColor = {
    clean: 'bg-success',
    dirty: 'bg-warning',
    saving: 'bg-muted-foreground',
    error: 'bg-destructive',
  }[state]
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex h-7 items-center gap-2 rounded-full border bg-white/70 px-3 text-[12px] font-medium text-foreground shadow-xs backdrop-blur-sm"
    >
      {state === 'saving' ? (
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-1.5 rounded-full',
            dotColor,
            state === 'dirty' && 'animate-[pulseDot_1.6s_ease-in-out_infinite]',
          )}
        />
      )}
      <span>{t(`status.${state}`)}</span>
    </span>
  )
}
