import { useState, type KeyboardEvent, type ReactElement } from 'react'
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

function NotePost({ note }: { note: Note }): ReactElement {
  return (
    <li className="flex items-start gap-3">
      <PersonAvatar
        size="sm"
        name={note.author_display_name}
        tintId={note.author_user_id}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{note.author_display_name}</span>
          <span className="text-[11px] text-foreground-muted">
            {formatDateTimeOrDash(note.created_at, 'nl')}
          </span>
        </div>
        <p className="whitespace-pre-wrap rounded-lg bg-surface-1 px-3 py-2 text-sm text-foreground">
          {note.body}
        </p>
      </div>
    </li>
  )
}

/** Attributed notes feed (posts) for any owner entity. */
export function NotesPanel({ ownerType, ownerId }: NotesPanelProps): ReactElement {
  const { t } = useTranslation(['collaboration'])
  const notes = useNotes(ownerType, ownerId)
  const addNote = useAddNote(ownerType, ownerId)
  const [draft, setDraft] = useState('')

  const items = notes.data ?? []

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
        <CardTitle className="text-base">
          {t('collaboration:notes.title', { defaultValue: 'Notities' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {t('collaboration:notes.empty', { defaultValue: 'Nog geen notities.' })}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((note) => (
              <NotePost key={note.id} note={note} />
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
