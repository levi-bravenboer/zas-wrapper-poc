import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/style/cn'

export const Tabs = TabsPrimitive.Root

const tabsListVariants = cva('inline-flex items-center', {
  variants: {
    variant: {
      underline: 'gap-4 border-b border-border',
      pill: 'gap-1 rounded-md bg-surface-2 p-1',
    },
  },
  defaultVariants: { variant: 'underline' },
})

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        underline:
          'border-b-2 border-transparent px-1 pb-2 text-foreground-muted hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
        pill: 'rounded-sm px-3 py-1 text-foreground-muted hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs',
      },
    },
    defaultVariants: { variant: 'underline' },
  },
)

export type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>

export function TabsList({ className, variant, ...props }: TabsListProps) {
  return <TabsPrimitive.List className={cn(tabsListVariants({ variant }), className)} {...props} />
}

export type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants>

export function TabsTrigger({ className, variant, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger className={cn(tabsTriggerVariants({ variant }), className)} {...props} />
  )
}

export type TabsContentProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>

export function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 focus-visible:outline-none', className)}
      {...props}
    />
  )
}
