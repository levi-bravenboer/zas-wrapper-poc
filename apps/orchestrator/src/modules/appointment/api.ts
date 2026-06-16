import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

import type {
  Appointment,
  AppointmentNote,
  Attachment,
  AttachmentUploadResponse,
  PatientAppointmentEntry,
} from './types'

export async function fetchAppointments(): Promise<Appointment[]> {
  const { data, response } = await api.GET('/appointments', {
    params: { query: { page_size: 100 } },
  })
  if (!response.ok || !data) {
    throw apiError('Appointments fetch failed', response.status)
  }
  return data.items
}

export async function fetchAppointment(appointmentId: string): Promise<Appointment> {
  const { data, response } = await api.GET('/appointments/{appointment_id}', {
    params: { path: { appointment_id: appointmentId } },
  })
  if (!response.ok || !data) {
    throw apiError('Appointment fetch failed', response.status)
  }
  return data
}

export async function fetchPatientAppointments(
  patientId: string,
): Promise<PatientAppointmentEntry[]> {
  const { data, response } = await api.GET('/patients/{patient_id}/appointments', {
    params: { path: { patient_id: patientId } },
  })
  if (!response.ok || !data) {
    throw apiError('Patient appointments fetch failed', response.status)
  }
  return data
}

export async function fetchNotes(appointmentId: string): Promise<AppointmentNote[]> {
  const { data, response } = await api.GET('/appointments/{appointment_id}/notes', {
    params: { path: { appointment_id: appointmentId } },
  })
  if (!response.ok || !data) {
    throw apiError('Notes fetch failed', response.status)
  }
  return data
}

export async function addNote(appointmentId: string, body: string): Promise<AppointmentNote> {
  const { data, response } = await api.POST('/appointments/{appointment_id}/notes', {
    params: { path: { appointment_id: appointmentId } },
    body: { body },
  })
  if (!response.ok || !data) {
    throw apiError('Note add failed', response.status)
  }
  return data
}

export async function fetchAttachments(appointmentId: string): Promise<Attachment[]> {
  const { data, response } = await api.GET('/appointments/{appointment_id}/attachments', {
    params: { path: { appointment_id: appointmentId } },
  })
  if (!response.ok || !data) {
    throw apiError('Attachments fetch failed', response.status)
  }
  return data
}

export async function createAttachment(
  appointmentId: string,
  file: { filename: string; content_type: string; size: number },
): Promise<AttachmentUploadResponse> {
  const { data, response } = await api.POST('/appointments/{appointment_id}/attachments', {
    params: { path: { appointment_id: appointmentId } },
    body: file,
  })
  if (!response.ok || !data) {
    throw apiError('Attachment create failed', response.status)
  }
  return data
}

export async function getAttachmentUrl(
  appointmentId: string,
  attachmentId: string,
): Promise<string> {
  const { data, response } = await api.GET(
    '/appointments/{appointment_id}/attachments/{attachment_id}/url',
    { params: { path: { appointment_id: appointmentId, attachment_id: attachmentId } } },
  )
  if (!response.ok || !data) {
    throw apiError('Attachment url failed', response.status)
  }
  return data.url
}

export async function deleteAttachment(
  appointmentId: string,
  attachmentId: string,
): Promise<void> {
  const { response } = await api.DELETE(
    '/appointments/{appointment_id}/attachments/{attachment_id}',
    { params: { path: { appointment_id: appointmentId, attachment_id: attachmentId } } },
  )
  if (!response.ok) {
    throw apiError('Attachment delete failed', response.status)
  }
}

/** Upload bytes straight to object storage via the presigned PUT URL. */
export async function uploadToPresignedUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) {
    throw apiError('Upload to storage failed', response.status)
  }
}
