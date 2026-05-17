import type { ReactElement, ReactNode } from 'react'

import { Label } from '@/components/ui/label'

type Props = {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
}

export function InspectorField({ label, htmlFor, hint, children }: Props): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
