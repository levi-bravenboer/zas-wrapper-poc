import { Link } from '@tanstack/react-router'
import { CheckCircle2, Circle } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { RailRow } from '@/components/rail'
import { cn } from '@/lib/style/cn'

import { dueLabel } from '../dueLabel'
import type { Task } from '../types'

export type TaskRowProps = {
  item: Task
  selected?: boolean
}

/**
 * Compact rail row for the Taken inbox: leading status icon + task title +
 * relative due copy, with a status chip on the right. Built on the shared
 * `<RailRow>`; the `render` prop makes the row a router `<Link>` and carries the
 * `data-active` flag for the selected row.
 */
export function TaskRow({ item, selected }: TaskRowProps): ReactElement {
  const { t } = useTranslation(['tasks'])
  const done = item.status === 'done'
  const StatusIcon = done ? CheckCircle2 : Circle

  return (
    <RailRow
      selected={selected ?? false}
      leading={
        <StatusIcon
          aria-hidden
          className={cn('size-4 shrink-0', done ? 'text-foreground-muted' : 'text-primary')}
        />
      }
      primary={
        <span className={done ? 'font-normal text-foreground-muted line-through' : undefined}>
          {item.title}
        </span>
      }
      secondary={item.due_at ? dueLabel(t, item.due_at) : t('tasks:due.none')}
      trailing={
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            done ? 'bg-surface-2 text-foreground-muted' : 'bg-primary-soft text-primary',
          )}
        >
          {t(`tasks:status.${item.status}`, { defaultValue: item.status })}
        </span>
      }
      render={({ content, className }) => (
        <Link
          to="/tasks/$taskId"
          params={{ taskId: item.id }}
          data-active={selected ? 'true' : undefined}
          className={className}
        >
          {content}
        </Link>
      )}
    />
  )
}
