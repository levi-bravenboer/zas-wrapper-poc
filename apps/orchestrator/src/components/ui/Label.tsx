import * as LabelPrimitive from '@radix-ui/react-label'
import * as React from 'react'

import { cn } from '@/lib/style/cn'

export type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>

export function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  )
}
