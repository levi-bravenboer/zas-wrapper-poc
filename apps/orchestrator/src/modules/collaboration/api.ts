import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'
import { unwrapApi } from '@/lib/api/unwrap'

import type { Note, NoteUploadResponse, OwnerType } from './types'

// openapi-fetch needs literal path keys, so branch per owner. The four owners
// share the same nested notes surface; only the path segment + path-param name
// differ. A note carries text and/or a file — one surface covers both.

export type NewNoteFile = { filename: string; content_type: string; size: number }

export async function fetchNotes(ownerType: OwnerType, ownerId: string): Promise<Note[]> {
  switch (ownerType) {
    case 'appointment':
      return unwrapApi(
        api.GET('/appointments/{appointment_id}/notes', {
          params: { path: { appointment_id: ownerId } },
        }),
        'Notes fetch failed',
      )
    case 'task':
      return unwrapApi(
        api.GET('/tasks/{task_id}/notes', { params: { path: { task_id: ownerId } } }),
        'Notes fetch failed',
      )
    case 'patient':
      return unwrapApi(
        api.GET('/patients/{patient_id}/notes', { params: { path: { patient_id: ownerId } } }),
        'Notes fetch failed',
      )
    case 'pathway_step':
      return unwrapApi(
        api.GET('/pathway-steps/{execution_id}/notes', {
          params: { path: { execution_id: ownerId } },
        }),
        'Notes fetch failed',
      )
  }
}

type NoteBody = { body?: string | null; file?: NewNoteFile | null }

export async function addNote(
  ownerType: OwnerType,
  ownerId: string,
  payload: NoteBody,
): Promise<NoteUploadResponse> {
  switch (ownerType) {
    case 'appointment':
      return unwrapApi(
        api.POST('/appointments/{appointment_id}/notes', {
          params: { path: { appointment_id: ownerId } },
          body: payload,
        }),
        'Note add failed',
      )
    case 'task':
      return unwrapApi(
        api.POST('/tasks/{task_id}/notes', {
          params: { path: { task_id: ownerId } },
          body: payload,
        }),
        'Note add failed',
      )
    case 'patient':
      return unwrapApi(
        api.POST('/patients/{patient_id}/notes', {
          params: { path: { patient_id: ownerId } },
          body: payload,
        }),
        'Note add failed',
      )
    case 'pathway_step':
      return unwrapApi(
        api.POST('/pathway-steps/{execution_id}/notes', {
          params: { path: { execution_id: ownerId } },
          body: payload,
        }),
        'Note add failed',
      )
  }
}

export async function getNoteFileUrl(
  ownerType: OwnerType,
  ownerId: string,
  noteId: string,
): Promise<string> {
  const r = await (() => {
    switch (ownerType) {
      case 'appointment':
        return api.GET('/appointments/{appointment_id}/notes/{note_id}/url', {
          params: { path: { appointment_id: ownerId, note_id: noteId } },
        })
      case 'task':
        return api.GET('/tasks/{task_id}/notes/{note_id}/url', {
          params: { path: { task_id: ownerId, note_id: noteId } },
        })
      case 'patient':
        return api.GET('/patients/{patient_id}/notes/{note_id}/url', {
          params: { path: { patient_id: ownerId, note_id: noteId } },
        })
      case 'pathway_step':
        return api.GET('/pathway-steps/{execution_id}/notes/{note_id}/url', {
          params: { path: { execution_id: ownerId, note_id: noteId } },
        })
    }
  })()
  if (!r.response.ok || !r.data) throw apiError('Note file url failed', r.response.status)
  return r.data.url
}

export async function deleteNote(
  ownerType: OwnerType,
  ownerId: string,
  noteId: string,
): Promise<void> {
  const r = await (() => {
    switch (ownerType) {
      case 'appointment':
        return api.DELETE('/appointments/{appointment_id}/notes/{note_id}', {
          params: { path: { appointment_id: ownerId, note_id: noteId } },
        })
      case 'task':
        return api.DELETE('/tasks/{task_id}/notes/{note_id}', {
          params: { path: { task_id: ownerId, note_id: noteId } },
        })
      case 'patient':
        return api.DELETE('/patients/{patient_id}/notes/{note_id}', {
          params: { path: { patient_id: ownerId, note_id: noteId } },
        })
      case 'pathway_step':
        return api.DELETE('/pathway-steps/{execution_id}/notes/{note_id}', {
          params: { path: { execution_id: ownerId, note_id: noteId } },
        })
    }
  })()
  if (!r.response.ok) throw apiError('Note delete failed', r.response.status)
}

export async function uploadToPresignedUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) throw apiError('Upload to storage failed', response.status)
}
