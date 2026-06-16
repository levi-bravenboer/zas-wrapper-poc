import type { LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/style/cn'

export type DetailCardProps = {
  title: ReactNode
  icon?: LucideIcon
  children: ReactNode
}

/** "Details" card for entity detail pages: a titled card wrapping a responsive
 *  grid of `<DetailRow>` label/value pairs (two columns from `sm` up). Rows
 *  marked `wide` span the full width. */
export function DetailCard({ title, icon: Icon, children }: DetailCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon ? <Icon className="size-4 text-foreground-muted" aria-hidden /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </CardContent>
    </Card>
  )
}

export type DetailRowProps = {
  label: ReactNode
  children: ReactNode
  /** Span both grid columns (for long values: descriptions, participant lists). */
  wide?: boolean
}

export function DetailRow({ label, children, wide }: DetailRowProps): ReactElement {
  return (
    <div className={cn('flex flex-col gap-0.5', wide && 'sm:col-span-2 lg:col-span-3')}>
      <span className="text-xs text-foreground-muted">{label}</span>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}
