import { type ReactElement } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/style/cn'

type SkeletonProps = {
  className?: string
}

export function RowSkeleton({ className }: SkeletonProps): ReactElement {
  return (
    <div
      data-slot="row-skeleton"
      className={cn('flex items-center gap-3 rounded-md border border-border/50 p-3', className)}
    >
      <Skeleton className="size-9 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}
