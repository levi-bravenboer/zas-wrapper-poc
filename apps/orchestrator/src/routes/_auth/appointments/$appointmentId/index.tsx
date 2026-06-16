// surface-opt-out: app-only
import { createFileRoute, Link } from '@tanstack/react-router'
import { Paperclip, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  EntityDetailPage,
  EntityDetailSkeleton,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { useSession } from '@/modules/auth/hooks'
import {
  useAddNote,
  useAppointmentQuery,
  useAttachmentsQuery,
  useDeleteAttachment,
  useNotesQuery,
  useUploadAttachment,
} from '@/modules/appointment/hooks'
import { getAttachmentUrl } from '@/modules/appointment/api'

export const Route = createFileRoute('/_auth/appointments/$appointmentId/')({
  component: AppointmentDetailRoute,
})

function NotesSection({ appointmentId }: { appointmentId: string }): ReactElement {
  const { t } = useTranslation(['appointment'])
  const notes = useNotesQuery(appointmentId)
  const addNote = useAddNote(appointmentId)
  const [draft, setDraft] = useState('')

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('appointment:notes.title', { defaultValue: 'Notities' })}
      </h3>
      <ul className="flex flex-col gap-2">
        {(notes.data ?? []).map((note) => (
          <li key={note.id} className="rounded-md border border-border/60 p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-foreground-muted">
              <span className="font-medium text-foreground">{note.author_display_name}</span>
              <span>{formatDateTimeOrDash(note.created_at, 'nl')}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
          </li>
        ))}
        {notes.data?.length === 0 ? (
          <li className="text-sm text-foreground-muted">
            {t('appointment:notes.empty', { defaultValue: 'Nog geen notities.' })}
          </li>
        ) : null}
      </ul>
      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={t('appointment:notes.placeholder', { defaultValue: 'Voeg een notitie toe…' })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim() || addNote.isPending}
            onClick={() =>
              addNote.mutate(draft.trim(), { onSuccess: () => setDraft('') })
            }
          >
            {t('appointment:notes.add', { defaultValue: 'Toevoegen' })}
          </Button>
        </div>
      </div>
    </section>
  )
}

function AttachmentsSection({
  appointmentId,
  currentUserId,
}: {
  appointmentId: string
  currentUserId: string | undefined
}): ReactElement {
  const { t } = useTranslation(['appointment'])
  const attachments = useAttachmentsQuery(appointmentId)
  const upload = useUploadAttachment(appointmentId)
  const remove = useDeleteAttachment(appointmentId)
  const fileRef = useRef<HTMLInputElement>(null)

  async function download(attachmentId: string): Promise<void> {
    const url = await getAttachmentUrl(appointmentId, attachmentId)
    window.open(url, '_blank', 'noopener')
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('appointment:attachments.title', { defaultValue: 'Documenten' })}
      </h3>
      <ul className="flex flex-col gap-2">
        {(attachments.data ?? []).map((att) => (
          <li
            key={att.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-sm"
          >
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 text-left hover:underline"
              onClick={() => void download(att.id)}
            >
              <Paperclip className="size-4 shrink-0 text-foreground-muted" />
              <span className="truncate">{att.filename}</span>
            </button>
            <div className="flex shrink-0 items-center gap-2 text-xs text-foreground-muted">
              <span>{att.uploader_display_name}</span>
              {att.uploaded_by === currentUserId ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('appointment:attachments.delete', { defaultValue: 'Verwijderen' })}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(att.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {attachments.data?.length === 0 ? (
          <li className="text-sm text-foreground-muted">
            {t('appointment:attachments.empty', { defaultValue: 'Nog geen documenten.' })}
          </li>
        ) : null}
      </ul>
      <div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload.mutate(file)
            e.target.value = ''
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {t('appointment:attachments.upload', { defaultValue: 'Document uploaden' })}
        </Button>
      </div>
    </section>
  )
}

function AppointmentDetailRoute(): ReactElement {
  const { t } = useTranslation(['appointment'])
  const { appointmentId } = Route.useParams()
  const query = useAppointmentQuery(appointmentId)
  const session = useSession()

  if (query.isLoading) return <EntityDetailSkeleton />
  if (query.error) {
    if (isApiError(query.error) && query.error.status === 404) {
      return <EntityNotFound backTo={{ to: '/appointments' }} />
    }
    return <EntityErrorCard onRetry={() => void query.refetch()} />
  }

  const appt = query.data
  if (!appt) return <EntityNotFound backTo={{ to: '/appointments' }} />

  const patient = appt.patient
  const lead = appt.participants.find((p) => p.role === 'lead')

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">{t(`appointment:kind.${appt.kind}`, { defaultValue: appt.kind })}</Badge>
      <span className="text-sm text-muted-foreground">
        {formatDateTimeOrDash(appt.starts_at, 'nl')}
        {appt.location_text ? ` · ${appt.location_text}` : ''}
      </span>
    </div>
  )

  return (
    <EntityDetailPage
      title={appt.title}
      subtitle={subtitle}
      back={{ to: '/appointments' }}
      actions={
        <Button asChild variant="outline">
          <Link to="/patients/$patientId" params={{ patientId: patient.id }}>
            {t('appointment:openPatient', { defaultValue: 'Open patiënt' })}
          </Link>
        </Button>
      }
      body={
        <div className="flex flex-col gap-6 p-1">
          <section className="grid grid-cols-2 gap-2 text-sm">
            <Field label={t('appointment:field.patient', { defaultValue: 'Patiënt' })}>
              {patient.family_name}, {patient.given_name}
            </Field>
            <Field label={t('appointment:field.modality', { defaultValue: 'Modaliteit' })}>
              {t(`appointment:modality.${appt.modality}`, { defaultValue: appt.modality })}
            </Field>
            <Field label={t('appointment:field.lead', { defaultValue: 'Hoofdbehandelaar' })}>
              {lead?.user_display_name ?? '—'}
            </Field>
            <Field label={t('appointment:field.status', { defaultValue: 'Status' })}>
              {appt.status}
            </Field>
          </section>
          <NotesSection appointmentId={appt.id} />
          <AttachmentsSection appointmentId={appt.id} currentUserId={session.data?.id} />
        </div>
      }
    />
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  )
}
