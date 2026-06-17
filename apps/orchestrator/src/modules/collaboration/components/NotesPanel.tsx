import {
  Calendar,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  User,
  Workflow,
} from 'lucide-react'
import { type KeyboardEvent, type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'

import { useAddNote, useNotes } from '../hooks'
import type { Note, OwnerType } from '../types'

export type NotesPanelProps = {
  ownerType: OwnerType
  ownerId: string
}

const OWNER_ICON: Record<OwnerType, LucideIcon> = {
  appointment: Calendar,
  task: ListChecks,
  pathway_step: Workflow,
  patient: User,
}

function NotePost({ note, showSource }: { note: Note; showSource: boolean }): ReactElement {
  // Source chip (where the note lives). Hidden when notes are grouped by source
  // (the group header already shows it).
  const OwnerIcon = OWNER_ICON[note.owner_type] ?? MessageSquareText
  return (
    <li className="flex items-start gap-3">
      <PersonAvatar
        size="sm"
        name={note.author_display_name}
        tintId={note.author_user_id}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {note.author_display_name}
            </span>
            {showSource && note.owner_label ? (
              <span
                className="inline-flex min-w-0 items-center gap-1 rounded-full bg-primary-soft/50 px-2 py-0.5 text-[11px] font-medium text-primary"
                title={note.owner_label}
              >
                <OwnerIcon className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{note.owner_label}</span>
              </span>
            ) : null}
          </div>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-foreground-muted">
            {formatDateTimeOrDash(note.created_at, 'nl')}
          </span>
        </div>
        <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface-1 px-3 py-2 text-sm text-foreground">
          {note.body}
        </p>
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

/** Attributed notes feed (posts) for any owner entity. */
export function NotesPanel({ ownerType, ownerId }: NotesPanelProps): ReactElement {
  const { t } = useTranslation(['collaboration'])
  const notes = useNotes(ownerType, ownerId)
  const addNote = useAddNote(ownerType, ownerId)
  const [draft, setDraft] = useState('')

  const items = notes.data ?? []
  // The patient view aggregates notes across owners — group them by source.
  const groups = ownerType === 'patient' ? groupBySource(items) : null

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-7 place-items-center rounded-md bg-primary-soft/60 text-primary">
            <MessageSquareText className="size-4" aria-hidden />
          </span>
          {t('collaboration:notes.title', { defaultValue: 'Notities' })}
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
            {t('collaboration:notes.empty', { defaultValue: 'Nog geen notities.' })}
          </p>
        ) : groups ? (
          <div className="flex flex-col gap-5">
            {groups.map((group) => {
              const GroupIcon = OWNER_ICON[group.ownerType] ?? MessageSquareText
              const label =
                group.label ??
                t('collaboration:notes.directOnPatient', { defaultValue: 'Direct op patiënt' })
              return (
                <section key={group.key} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                    <GroupIcon className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                  </div>
                  <ul className="flex flex-col gap-4">
                    {group.notes.map((note) => (
                      <NotePost key={note.id} note={note} showSource={false} />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((note) => (
              <NotePost key={note.id} note={note} showSource={true} />
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={t('collaboration:notes.placeholder', {
              defaultValue: 'Voeg een notitie toe…',
            })}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-foreground-muted">
              {t('collaboration:notes.hint', { defaultValue: '⌘/Ctrl + Enter om te versturen' })}
            </span>
            <Button size="sm" disabled={!draft.trim() || addNote.isPending} onClick={submit}>
              {t('collaboration:notes.add', { defaultValue: 'Toevoegen' })}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
