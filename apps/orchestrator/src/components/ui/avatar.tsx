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

// Curated 8-colour palette. Each entry meets WCAG AA contrast against
// `text-white` foreground. Used to deterministically tint avatars by an
// identifier (typically `patient.id`) so the same subject always renders
// the same colour across the app.
const TINT_PALETTE = [
  'bg-teal-600 text-white',
  'bg-emerald-600 text-white',
  'bg-cyan-700 text-white',
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-purple-600 text-white',
  'bg-pink-600 text-white',
  'bg-rose-600 text-white',
] as const

function hashTintBy(value: string): number {
  // djb2 — fast, low-collision over short ascii strings (UUIDs).
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return Math.abs(hash) % TINT_PALETTE.length
}

export function getAvatarTintClass(tintBy: string): string {
  return TINT_PALETTE[hashTintBy(tintBy)]!
}

export type AvatarProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants> & {
    tintBy?: string
  }

export function Avatar({ className, size, tintBy, ...props }: AvatarProps) {
  const tintClass = tintBy ? getAvatarTintClass(tintBy) : undefined
  return (
    <AvatarPrimitive.Root
      className={cn(avatarVariants({ size }), tintClass, className)}
      {...props}
    />
  )
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

export type AvatarFallbackProps = React.ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Fallback
> & {
  // When the parent `Avatar` carries a `tintBy`, the fallback should not
  // re-apply the default muted background.
  tinted?: boolean
}

export function AvatarFallback({ className, tinted, ...props }: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex h-full w-full items-center justify-center font-medium',
        tinted ? 'bg-transparent text-current' : 'bg-muted text-foreground-muted',
        className,
      )}
      {...props}
    />
  )
}
