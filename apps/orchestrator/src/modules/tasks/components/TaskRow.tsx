import { Link } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

import { dueLabel } from '../dueLabel'
import type { TaskItem } from '../types'
import { KindTile } from './KindTile'

export type TaskRowProps = {
  item: TaskItem
  selected?: boolean
}

/**
 * Compact rail row per design.md D7 (locks prototype v12):
 * kind tile leading + `family, given` + relative due copy. NO avatar, NO
 * INSZ, NO chevron — the rail is a 280px jump list; full patient identity
 * lives in the right pane. Active row = 3px primary left accent + tinted bg.
 *
 * Rendered as a router `<Link>` so the row gets a real href (cmd-click,
 * middle-click, preloading) instead of an onClick navigate.
 */
export function TaskRow({ item, selected }: TaskRowProps): ReactElement {
  const { t } = useTranslation(['tasks'])
  const patient = item.payload.patient
  const kind = item.payload.kind

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
      <KindTile kind={kind} size="sm" />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium text-foreground">
          {patient.family_name}, {patient.given_name}
        </span>
        <span className="truncate text-[11px] tabular-nums text-foreground-muted">
          {dueLabel(t, item.due_at)}
        </span>
      </div>
    </Link>
  )
}
