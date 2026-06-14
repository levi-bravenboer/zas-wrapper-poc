import { type ReactElement, type ReactNode } from 'react'

import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Tone = 'primary' | 'destructive'

type Props = {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Visual tone of the icon square. `destructive` for confirm-delete /
   *  irreversible flows; `primary` (default) for additive dialogs. */
  tone?: Tone
}

const TONE_CLASS: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive',
}

// Shared dialog header (used by BlockDialog + ConfirmDeleteBlockDialog).
export function DialogHero({
  icon,
  title,
  description,
  tone = 'primary',
}: Props): ReactElement {
  return (
    <DialogHeader className="border-b px-5 py-4" style={{ borderColor: 'var(--hairline)' }}>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${TONE_CLASS[tone]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-[15px]">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-[12px]">{description}</DialogDescription>
          )}
        </div>
      </div>
    </DialogHeader>
  )
}
