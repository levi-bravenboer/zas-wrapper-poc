import type { components } from '@/lib/api/schema'

export type Note = components['schemas']['NoteRead']
export type NoteUploadResponse = components['schemas']['NoteUploadResponse']
export type OwnerType = Note['owner_type']

/** A note carrying a file — its file metadata is non-null. */
export type FileNote = Note & {
  filename: string
  content_type: string
  size: number
}

export function isFileNote(note: Note): note is FileNote {
  return note.filename !== null
}
