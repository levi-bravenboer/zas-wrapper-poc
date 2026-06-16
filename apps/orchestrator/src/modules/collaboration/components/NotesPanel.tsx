import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'

import { useAddNote, useNotes } from '../hooks'
import type { OwnerType } from '../types'

export type NotesPanelProps = {
  ownerType: OwnerType
  ownerId: string
}

/** Append-only attributed notes feed for any owner entity. */
export function NotesPanel({ ownerType, ownerId }: NotesPanelProps): ReactElement {
  const { t } = useTranslation(['collaboration'])
  const notes = useNotes(ownerType, ownerId)
  const addNote = useAddNote(ownerType, ownerId)
  const [draft, setDraft] = useState('')

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('collaboration:notes.title', { defaultValue: 'Notities' })}
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
            {t('collaboration:notes.empty', { defaultValue: 'Nog geen notities.' })}
          </li>
        ) : null}
      </ul>
      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={t('collaboration:notes.placeholder', { defaultValue: 'Voeg een notitie toe…' })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim() || addNote.isPending}
            onClick={() => addNote.mutate(draft.trim(), { onSuccess: () => setDraft('') })}
          >
            {t('collaboration:notes.add', { defaultValue: 'Toevoegen' })}
          </Button>
        </div>
      </div>
    </section>
  )
}
