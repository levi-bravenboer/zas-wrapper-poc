import type { ReactElement } from 'react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function EntityDetailSkeleton(): ReactElement {
  return (
    <>
      <div className="flex flex-col gap-4 px-6 pt-6 pb-4" data-slot="entity-detail-skeleton-header">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="px-6 pb-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
