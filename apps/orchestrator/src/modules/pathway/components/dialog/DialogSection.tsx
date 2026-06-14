import { type ReactElement, type ReactNode } from 'react'

type Props = {
  header: string
  children: ReactNode
}

// Shared shell for the bordered, header-stamped sections inside
// `BlockDialog` (config / input_logic / timing_policy). One place
// owns the border colour, padding, and header type-scale — every
// section stays visually identical.
export function DialogSection({ header, children }: Props): ReactElement {
  return (
    <section className="space-y-2 rounded-md border bg-muted/20 p-3">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {header}
      </h3>
      {children}
    </section>
  )
}
