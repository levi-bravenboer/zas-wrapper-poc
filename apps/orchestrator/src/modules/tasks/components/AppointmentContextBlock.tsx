import { Clock3, ExternalLink, MapPin, UserRound, Video } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { dueLabel } from '../dueLabel'
import type { TaskItem } from '../types'

import { KindTile } from './KindTile'

export type AppointmentContextBlockProps = {
  task: TaskItem
}

/**
 * Slim flat strip rendered above the `<EntityDetailTabs>` on the task detail
 * route (D-CTX-BLOCK). Reads as "this task is what brought you here": kind
 * tile, title, kind label badge, meta (relative due + modality + location +
 * lead), and a deep-link button to the underlying appointment.
 *
 * Surface-agnostic: no router import, no shell coupling. Takes a `TaskItem`
 * and renders. The `Open afspraak` button is a no-op v1 (no `/appointments`
 * surface ships); a host can wrap and pass through later.
 */
export function AppointmentContextBlock({ task }: AppointmentContextBlockProps): ReactElement {
  const { t } = useTranslation(['tasks', 'appointment'])
  const payload = task.payload
  const lead = payload.participants.find((p) => p.role === 'lead')
  const ModalityIcon = payload.modality === 'online' ? Video : MapPin

  return (
    <section
      data-slot="appointment-context-block"
      className="flex items-center gap-3 rounded-md border border-border bg-[color-mix(in_srgb,var(--color-primary-soft)_25%,var(--color-background))] px-4 py-3"
    >
      <KindTile kind={payload.kind} size="md" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-medium text-foreground">{task.title}</span>
          <Badge variant="soft">{t(`appointment:kind.${payload.kind}`)}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock3 aria-hidden className="size-3.5" />
            {dueLabel(t, task.due_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ModalityIcon aria-hidden className="size-3.5" />
            {t(`appointment:modality.${payload.modality}`)}
            {payload.location_text ? ` · ${payload.location_text}` : ''}
          </span>
          {lead ? (
            <span className="inline-flex items-center gap-1">
              <UserRound aria-hidden className="size-3.5" />
              {t('tasks:context.lead', { name: lead.user_display_name })}
            </span>
          ) : null}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        aria-disabled
        title={t('tasks:context.open_appointment_unavailable')}
        onClick={(event) => event.preventDefault()}
      >
        <ExternalLink aria-hidden className="size-3.5" />
        {t('tasks:context.open_appointment')}
      </Button>
    </section>
  )
}
