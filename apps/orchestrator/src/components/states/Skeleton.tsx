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

export function CardSkeleton({ className }: SkeletonProps): ReactElement {
  return (
    <div
      data-slot="card-skeleton"
      className={cn('flex flex-col gap-3 rounded-lg border border-border/50 p-4', className)}
    >
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function DetailSkeleton({ className }: SkeletonProps): ReactElement {
  return (
    <div data-slot="detail-skeleton" className={cn('flex flex-col gap-6', className)}>
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="flex flex-col gap-2">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  )
}
