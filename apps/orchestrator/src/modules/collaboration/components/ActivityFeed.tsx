import {
  Calendar,
  Download,
  Eye,
  FileText,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  Paperclip,
  Trash2,
  User,
  Workflow,
} from 'lucide-react'
import { type KeyboardEvent, type ReactElement, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/style/cn'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { useSession } from '@/modules/auth/hooks'

import { getNoteFileUrl } from '../api'
import { useAddNote, useDeleteNote, useNotes, useUploadFileNote } from '../hooks'
import { type FileNote, isFileNote, type Note, type OwnerType } from '../types'

import { FilePreviewDialog } from './FilePreviewDialog'

export type ActivityFeedProps = {
  ownerType: OwnerType
  ownerId: string
}

const OWNER_ICON: Record<OwnerType, LucideIcon> = {
  appointment: Calendar,
  task: ListChecks,
  pathway_step: Workflow,
  patient: User,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

type ItemActions = {
  canDelete: boolean
  onPreview: (note: FileNote) => void | Promise<void>
  onDownload: (note: FileNote) => void | Promise<void>
  onDelete: (noteId: string) => void
  deleting: boolean
}

function SourceChip({ note }: { note: Note }): ReactElement | null {
  if (!note.owner_label) return null
  const Icon = OWNER_ICON[note.owner_type] ?? MessageSquareText
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1 rounded-full bg-primary-soft/50 px-2 py-0.5 text-[11px] font-medium text-primary"
      title={note.owner_label}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{note.owner_label}</span>
    </span>
  )
}

function FileBody({ note, actions }: { note: FileNote; actions: ItemActions }): ReactElement {
  const { t } = useTranslation(['collaboration'])
  return (
    <div className="group flex items-center gap-3 rounded-2xl rounded-tl-sm border border-border/60 bg-surface-1 px-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft/50 text-primary">
        <FileText className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{note.filename}</span>
        <span className="truncate text-[11px] text-foreground-muted">{formatBytes(note.size)}</span>
      </div>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('collaboration:files.preview')}
          onClick={() => void actions.onPreview(note)}
        >
          <Eye className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('collaboration:files.download')}
          onClick={() => void actions.onDownload(note)}
        >
          <Download className="size-4" />
        </Button>
        {actions.canDelete ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            aria-label={t('collaboration:files.delete')}
            disabled={actions.deleting}
            onClick={() => actions.onDelete(note.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function TextBody({ note, actions }: { note: Note; actions: ItemActions }): ReactElement {
  const { t } = useTranslation(['collaboration'])
  return (
    <div className="group flex items-start gap-2">
      <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface-1 px-3 py-2 text-sm text-foreground">
        {note.body}
      </p>
      {actions.canDelete ? (
        <Button
          variant="ghost"
          size="icon"
          className="mt-0.5 size-7 shrink-0 text-destructive opacity-0 transition-opacity hover:text-destructive focus-within:opacity-100 group-hover:opacity-100"
          aria-label={t('collaboration:notes.delete')}
          disabled={actions.deleting}
          onClick={() => actions.onDelete(note.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}

function ActivityItem({
  note,
  showSource,
  actions,
}: {
  note: Note
  showSource: boolean
  actions: ItemActions
}): ReactElement {
  return (
    <li className="flex items-start gap-3">
      <PersonAvatar
        size="sm"
        name={note.author_display_name}
        tintId={note.author_user_id}
        person={{ kind: 'user', id: note.author_user_id }}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {note.author_display_name}
            </span>
            {showSource ? <SourceChip note={note} /> : null}
          </div>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-foreground-muted">
            {formatDateTimeOrDash(note.created_at, 'nl')}
          </span>
        </div>
        {isFileNote(note) ? (
          <FileBody note={note} actions={actions} />
        ) : (
          <TextBody note={note} actions={actions} />
        )}
      </div>
    </li>
  )
}

interface NoteGroup {
  key: string
  ownerType: OwnerType
  label: string | null
  notes: Note[]
}

function groupBySource(notes: Note[]): NoteGroup[] {
  const map = new Map<string, NoteGroup>()
  for (const note of notes) {
    const key = `${note.owner_type}:${note.owner_id}`
    const existing = map.get(key)
    if (existing) existing.notes.push(note)
    else
      map.set(key, {
        key,
        ownerType: note.owner_type,
        label: note.owner_label ?? null,
        notes: [note],
      })
  }
  const newest = (g: NoteGroup): number =>
    Math.max(...g.notes.map((n) => new Date(n.created_at).getTime()))
  return [...map.values()].sort((a, b) => newest(b) - newest(a))
}

/** Single activity feed for an owner entity: text notes and file notes
 *  interleaved, grouped by source on the patient aggregate. Composer posts a
 *  text note or attaches files (each a file note). */
export function ActivityFeed({ ownerType, ownerId }: ActivityFeedProps): ReactElement {
  const { t } = useTranslation(['collaboration'])
  const notes = useNotes(ownerType, ownerId)
  const addNote = useAddNote(ownerType, ownerId)
  const uploadFile = useUploadFileNote(ownerType, ownerId)
  const removeNote = useDeleteNote(ownerType, ownerId)
  const session = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [preview, setPreview] = useState<{ note: FileNote; url: string } | null>(null)

  const items = notes.data ?? []
  // The patient view aggregates notes across owners — group them by source.
  const groups = ownerType === 'patient' ? groupBySource(items) : null

  const actionsFor = (note: Note): ItemActions => ({
    canDelete: note.author_user_id === session.data?.id,
    onPreview: async (n) => setPreview({ note: n, url: await getNoteFileUrl(ownerType, ownerId, n.id) }),
    onDownload: async (n) => {
      window.open(await getNoteFileUrl(ownerType, ownerId, n.id), '_blank', 'noopener')
    },
    onDelete: (noteId) => removeNote.mutate(noteId),
    deleting: removeNote.isPending,
  })

  const submit = (): void => {
    const body = draft.trim()
    if (!body || addNote.isPending) return
    addNote.mutate(body, { onSuccess: () => setDraft('') })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const pickFiles = (files: FileList | null): void => {
    if (!files) return
    for (const file of Array.from(files)) uploadFile.mutate(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-7 place-items-center rounded-md bg-primary-soft/60 text-primary">
            <MessageSquareText className="size-4" aria-hidden />
          </span>
          {t('collaboration:notes.title')}
          {items.length > 0 ? (
            <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground-muted tabular-nums">
              {items.length}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {t('collaboration:notes.empty')}
          </p>
        ) : groups ? (
          <div className="flex flex-col gap-5">
            {groups.map((group) => {
              const GroupIcon = OWNER_ICON[group.ownerType] ?? MessageSquareText
              const label =
                group.label ??
                t('collaboration:notes.directOnPatient')
              return (
                <section key={group.key} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                    <GroupIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                  </div>
                  <ul className="flex flex-col gap-4">
                    {group.notes.map((note) => (
                      <ActivityItem
                        key={note.id}
                        note={note}
                        showSource={false}
                        actions={actionsFor(note)}
                      />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((note) => (
              <ActivityItem
                key={note.id}
                note={note}
                showSource={true}
                actions={actionsFor(note)}
              />
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              pickFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={t('collaboration:notes.placeholder')}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('gap-1.5', uploadFile.isPending && 'opacity-70')}
              disabled={uploadFile.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="size-4" />
              {uploadFile.isPending
                ? t('collaboration:files.uploading')
                : t('collaboration:files.attach')}
            </Button>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-foreground-muted sm:inline">
                {t('collaboration:notes.hint')}
              </span>
              <Button size="sm" disabled={!draft.trim() || addNote.isPending} onClick={submit}>
                {t('collaboration:notes.add')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <FilePreviewDialog
        note={preview?.note ?? null}
        url={preview?.url ?? null}
        onClose={() => setPreview(null)}
      />
    </Card>
  )
}
