import * as React from 'react'

import { cn } from '@/lib/style/cn'

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div data-slot="skeleton" className={cn('shimmer rounded-md', className)} {...props} />
}
