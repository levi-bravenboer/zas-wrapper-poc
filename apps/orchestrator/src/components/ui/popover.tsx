import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'

import { cn } from '@/lib/style/cn'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor
export const PopoverPortal = PopoverPrimitive.Portal

export type PopoverContentProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 6,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-md border border-border bg-background p-2 text-foreground shadow-md outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          className,
        )}
        {...props}
      />
    </PopoverPortal>
  )
}
