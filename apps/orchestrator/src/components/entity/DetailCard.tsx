import type { ReactElement, ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type DetailCardProps = {
  title: ReactNode
  children: ReactNode
}

/** Left-column "Details" card for entity detail pages: a titled card wrapping a
 *  vertical list of `<DetailRow>` label/value pairs. */
export function DetailCard({ title, children }: DetailCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">{children}</CardContent>
    </Card>
  )
}

export type DetailRowProps = {
  label: ReactNode
  children: ReactNode
}

export function DetailRow({ label, children }: DetailRowProps): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-foreground-muted">{label}</span>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}
