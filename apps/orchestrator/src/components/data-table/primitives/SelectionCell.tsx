import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/style/cn'

import { stickyFirst } from '../styles'

import { Cell, HeaderCell } from './Table'

export interface SelectionHeaderProps {
  state: 'all' | 'some' | 'none'
  onToggle: () => void
  sticky?: boolean
  label?: string
}

export function SelectionHeader({
  state,
  onToggle,
  sticky = true,
  label = 'Select page',
}: SelectionHeaderProps) {
  return (
    <HeaderCell className={cn('w-10', sticky && stickyFirst)}>
      <Checkbox
        aria-label={label}
        checked={state === 'all' ? true : state === 'some' ? 'indeterminate' : false}
        onCheckedChange={() => onToggle()}
      />
    </HeaderCell>
  )
}

export interface SelectionCellProps {
  rowId: string
  checked: boolean
  onToggle: (id: string) => void
  sticky?: boolean
  label?: string
}

export function SelectionCell({
  rowId,
  checked,
  onToggle,
  sticky = true,
  label,
}: SelectionCellProps) {
  return (
    <Cell data-stop-row-click="" className={cn(sticky && stickyFirst)}>
      <Checkbox
        aria-label={label ?? `Select row ${rowId}`}
        checked={checked}
        onCheckedChange={() => onToggle(rowId)}
        onClick={(e) => e.stopPropagation()}
      />
    </Cell>
  )
}
