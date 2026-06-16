import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'
import { unwrapApi } from '@/lib/api/unwrap'

import type { Attachment, AttachmentUploadResponse, Note, OwnerType } from './types'

// openapi-fetch needs literal path keys, so branch per owner. The three owners
// share the same nested notes/attachments surface; only the path segment +
// path-param name differ.

export async function fetchNotes(ownerType: OwnerType, ownerId: string): Promise<Note[]> {
  switch (ownerType) {
    case 'appointment':
      return unwrapApi(api.GET('/appointments/{appointment_id}/notes', { params: { path: { appointment_id: ownerId } } }), 'Notes fetch failed')
    case 'task':
      return unwrapApi(api.GET('/tasks/{task_id}/notes', { params: { path: { task_id: ownerId } } }), 'Notes fetch failed')
    case 'patient':
      return unwrapApi(api.GET('/patients/{patient_id}/notes', { params: { path: { patient_id: ownerId } } }), 'Notes fetch failed')
  }
}

export async function addNote(ownerType: OwnerType, ownerId: string, body: string): Promise<Note> {
  switch (ownerType) {
    case 'appointment':
      return unwrapApi(api.POST('/appointments/{appointment_id}/notes', { params: { path: { appointment_id: ownerId } }, body: { body } }), 'Note add failed')
    case 'task':
      return unwrapApi(api.POST('/tasks/{task_id}/notes', { params: { path: { task_id: ownerId } }, body: { body } }), 'Note add failed')
    case 'patient':
      return unwrapApi(api.POST('/patients/{patient_id}/notes', { params: { path: { patient_id: ownerId } }, body: { body } }), 'Note add failed')
  }
}

export async function fetchAttachments(ownerType: OwnerType, ownerId: string): Promise<Attachment[]> {
  switch (ownerType) {
    case 'appointment':
      return unwrapApi(api.GET('/appointments/{appointment_id}/attachments', { params: { path: { appointment_id: ownerId } } }), 'Attachments fetch failed')
    case 'task':
      return unwrapApi(api.GET('/tasks/{task_id}/attachments', { params: { path: { task_id: ownerId } } }), 'Attachments fetch failed')
    case 'patient':
      return unwrapApi(api.GET('/patients/{patient_id}/attachments', { params: { path: { patient_id: ownerId } } }), 'Attachments fetch failed')
  }
}

type NewFile = { filename: string; content_type: string; size: number }

export async function createAttachment(
  ownerType: OwnerType,
  ownerId: string,
  file: NewFile,
): Promise<AttachmentUploadResponse> {
  switch (ownerType) {
    case 'appointment':
      return unwrapApi(api.POST('/appointments/{appointment_id}/attachments', { params: { path: { appointment_id: ownerId } }, body: file }), 'Attachment create failed')
    case 'task':
      return unwrapApi(api.POST('/tasks/{task_id}/attachments', { params: { path: { task_id: ownerId } }, body: file }), 'Attachment create failed')
    case 'patient':
      return unwrapApi(api.POST('/patients/{patient_id}/attachments', { params: { path: { patient_id: ownerId } }, body: file }), 'Attachment create failed')
  }
}

export async function getAttachmentUrl(
  ownerType: OwnerType,
  ownerId: string,
  attachmentId: string,
): Promise<string> {
  const r = await (() => {
    switch (ownerType) {
      case 'appointment':
        return api.GET('/appointments/{appointment_id}/attachments/{attachment_id}/url', { params: { path: { appointment_id: ownerId, attachment_id: attachmentId } } })
      case 'task':
        return api.GET('/tasks/{task_id}/attachments/{attachment_id}/url', { params: { path: { task_id: ownerId, attachment_id: attachmentId } } })
      case 'patient':
        return api.GET('/patients/{patient_id}/attachments/{attachment_id}/url', { params: { path: { patient_id: ownerId, attachment_id: attachmentId } } })
    }
  })()
  if (!r.response.ok || !r.data) throw apiError('Attachment url failed', r.response.status)
  return r.data.url
}

export async function deleteAttachment(
  ownerType: OwnerType,
  ownerId: string,
  attachmentId: string,
): Promise<void> {
  const r = await (() => {
    switch (ownerType) {
      case 'appointment':
        return api.DELETE('/appointments/{appointment_id}/attachments/{attachment_id}', { params: { path: { appointment_id: ownerId, attachment_id: attachmentId } } })
      case 'task':
        return api.DELETE('/tasks/{task_id}/attachments/{attachment_id}', { params: { path: { task_id: ownerId, attachment_id: attachmentId } } })
      case 'patient':
        return api.DELETE('/patients/{patient_id}/attachments/{attachment_id}', { params: { path: { patient_id: ownerId, attachment_id: attachmentId } } })
    }
  })()
  if (!r.response.ok) throw apiError('Attachment delete failed', r.response.status)
}

export async function uploadToPresignedUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) throw apiError('Upload to storage failed', response.status)
}
