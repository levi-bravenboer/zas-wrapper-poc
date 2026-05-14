import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/style/cn'

const avatarVariants = cva('relative flex shrink-0 overflow-hidden rounded-full bg-muted', {
  variants: {
    size: {
      sm: 'h-7 w-7 text-xs',
      md: 'h-9 w-9 text-sm',
      lg: 'h-12 w-12 text-base',
    },
  },
  defaultVariants: { size: 'md' },
})

export type AvatarProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants>

export function Avatar({ className, size, ...props }: AvatarProps) {
  return <AvatarPrimitive.Root className={cn(avatarVariants({ size }), className)} {...props} />
}

export type AvatarImageProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>

export function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  )
}

export type AvatarFallbackProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>

export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex h-full w-full items-center justify-center bg-muted font-medium text-foreground-muted',
        className,
      )}
      {...props}
    />
  )
}
