import type { ReactElement } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function EntityFormSkeleton(): ReactElement {
  return (
    <>
      <div className="flex flex-col gap-4 px-6 pt-6 pb-4" data-slot="entity-form-skeleton-header">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div className="px-6 pb-24">
        <Card>
          <CardContent className="flex flex-col gap-6 pt-6">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div
        className="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-6 py-3"
        data-slot="entity-form-skeleton-footer"
      >
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </>
  )
}
