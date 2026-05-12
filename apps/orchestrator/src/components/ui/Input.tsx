import * as React from 'react'

import { cn } from '@/lib/style/cn'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-[var(--color-border-1)] bg-[var(--color-surface-1)] px-3 py-2 text-sm',
        'placeholder:text-[var(--color-text-3)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
