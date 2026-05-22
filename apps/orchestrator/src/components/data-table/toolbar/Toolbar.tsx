/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'

import { cn } from '@/lib/style/cn'

import { toolbarRoot } from '../styles'

export interface TypeaheadEditorRenderProps {
  value: string | null
  onChange: (value: string | null) => void
}

// Allows model-field autocomplete while permitting virtual backend filter
// keys (e.g. `is_open`, `has_practitioner`) that aren't columns on T.
type FilterKey<T> = (keyof T & string) | (string & {})

export type DataTableFilter<T> =
  | {
      type: 'select'
      key: FilterKey<T>
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | {
      type: 'multi'
      key: FilterKey<T>
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | { type: 'date-range'; key: FilterKey<T>; label: string }
  | { type: 'text'; key: FilterKey<T>; label: string }
  | {
      type: 'typeahead'
      key: FilterKey<T>
      label: string
      renderEditor: (props: TypeaheadEditorRenderProps) => ReactNode
      formatValue?: (value: string) => string | null
    }
  | {
      type: 'boolean'
      key: FilterKey<T>
      label: string
      trueLabel?: string
      falseLabel?: string
    }

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
