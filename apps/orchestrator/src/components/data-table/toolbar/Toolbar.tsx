import type { ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

import { toolbarRoot } from '../styles'

export type DataTableFilter<T> =
  | {
      type: 'select'
      key: keyof T & string
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | {
      type: 'multi'
      key: keyof T & string
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | { type: 'date-range'; key: keyof T & string; label: string }
  | { type: 'text'; key: keyof T & string; label: string }

function Root({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(toolbarRoot, className)} data-testid="data-table-toolbar">
      {children}
    </div>
  )
}

function Search({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-1 items-center', className)}>{children}</div>
}

function Filters({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-2', className)}>{children}</div>
}

export const Toolbar = { Root, Search, Filters, Actions }
