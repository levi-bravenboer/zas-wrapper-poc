import type { ReactElement, ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/style/cn'

export type EntityDetailSingleColumnProps = {
  children: ReactNode
  className?: string
}

export function EntityDetailSingleColumn({
  children,
  className,
}: EntityDetailSingleColumnProps): ReactElement {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">{children}</CardContent>
      </Card>
    </div>
  )
}
