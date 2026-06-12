import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/style/cn'

import { KindTile } from './components/KindTile'
import { dueLabel } from './dueLabel'
import type { TaskItem } from './types'

function initials(family: string, given: string): string {
  const f = family.charAt(0) ?? ''
  const g = given.charAt(0) ?? ''
  return `${g}${f}`.toUpperCase()
}

export type TaskRowProps = {
  item: TaskItem
  selected?: boolean
}

export function TaskRow({ item, selected }: TaskRowProps): ReactElement {
  const { t } = useTranslation(['tasks', 'appointment'])
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const patient = item.payload.patient
  const kind = item.payload.kind

  const onClick = (): void => {
    if (isMobile) {
      // Mobile is out of scope v1; fall through to the standalone patient route
      // so a phone caregiver still reaches the same patient detail.
      void navigate({ to: '/patients/$patientId', params: { patientId: patient.id } })
    } else {
      void navigate({ to: '/tasks/$taskId', params: { taskId: item.id } })
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/60',
        selected && 'bg-muted',
      )}
    >
      <Avatar tintBy={patient.id} size="md">
        <AvatarFallback tinted>{initials(patient.family_name, patient.given_name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {patient.family_name}, {patient.given_name}
        </span>
        <span className="truncate text-xs text-foreground-muted">
          {patient.insz ? `${patient.insz} · ` : ''}
          {t(`appointment:kind.${kind}`)} · {dueLabel(t, item.due_at)}
        </span>
      </div>

      <KindTile kind={kind} size="sm" className="hidden sm:flex" />
      <ChevronRight aria-hidden className="size-4 text-foreground-muted" />
    </button>
  )
}
