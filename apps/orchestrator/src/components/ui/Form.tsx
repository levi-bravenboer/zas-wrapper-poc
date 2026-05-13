import * as React from 'react'

import { cn } from '@/lib/style/cn'

export function FormField({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />
}

export function FormMessage({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null
  return (
    <p role="alert" className={cn('text-sm text-destructive', className)} {...props}>
      {children}
    </p>
  )
}

export function FormDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}
