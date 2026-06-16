import { Link } from '@tanstack/react-router'
import { CheckCircle2, Circle } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

import { dueLabel } from '../dueLabel'
import type { Task } from '../types'

export type TaskRowProps = {
  item: Task
  selected?: boolean
}

/**
 * Compact rail row for the Taken inbox: leading status icon + task title +
 * relative due copy, with a status chip on the right. Active row = 3px
 * primary left accent + tinted bg. Rendered as a router `<Link>` for real
 * href semantics.
 */
export function TaskRow({ item, selected }: TaskRowProps): ReactElement {
  const { t } = useTranslation(['tasks'])
  const done = item.status === 'done'
  const StatusIcon = done ? CheckCircle2 : Circle

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: item.id }}
      data-active={selected ? 'true' : undefined}
      className={cn(
        'relative flex w-full items-center gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-surface-1',
        selected &&
          'bg-[color-mix(in_srgb,var(--color-primary-soft)_55%,var(--color-background))] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r-sm before:bg-primary',
      )}
    >
      <StatusIcon
        aria-hidden
        className={cn('size-4 shrink-0', done ? 'text-foreground-muted' : 'text-primary')}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-[13px] text-foreground',
            done ? 'font-normal text-foreground-muted line-through' : 'font-medium',
          )}
        >
          {item.title}
        </span>
        <span className="truncate text-[11px] tabular-nums text-foreground-muted">
          {item.due_at ? dueLabel(t, item.due_at) : t('tasks:due.none', { defaultValue: 'Geen datum' })}
        </span>
      </div>

      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
          done ? 'bg-surface-2 text-foreground-muted' : 'bg-primary-soft text-primary',
        )}
      >
        {t(`tasks:status.${item.status}`, { defaultValue: item.status })}
      </span>
    </Link>
  )
}
