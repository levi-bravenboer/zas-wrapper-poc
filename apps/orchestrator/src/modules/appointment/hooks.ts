import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import {
  addNote,
  createAttachment,
  deleteAttachment,
  fetchAppointment,
  fetchAppointments,
  fetchAttachments,
  fetchNotes,
  fetchPatientAppointments,
  uploadToPresignedUrl,
} from './api'
import {
  appointmentAttachmentsKey,
  appointmentKey,
  appointmentNotesKey,
  appointmentsListKey,
  patientAppointmentsKey,
} from './keys'
import type { Appointment, AppointmentNote, Attachment, PatientAppointmentEntry } from './types'

export function useAppointmentsQuery(): UseQueryResult<Appointment[], Error> {
  return useQuery({ queryKey: appointmentsListKey, queryFn: fetchAppointments })
}

export function useAppointmentQuery(id: string): UseQueryResult<Appointment, Error> {
  return useQuery({ queryKey: appointmentKey(id), queryFn: () => fetchAppointment(id) })
}

export function usePatientAppointmentsQuery(
  patientId: string | null,
): UseQueryResult<PatientAppointmentEntry[], Error> {
  return useQuery({
    queryKey: patientAppointmentsKey(patientId ?? ''),
    queryFn: () => fetchPatientAppointments(patientId as string),
    enabled: patientId !== null,
  })
}

export function useNotesQuery(id: string): UseQueryResult<AppointmentNote[], Error> {
  return useQuery({ queryKey: appointmentNotesKey(id), queryFn: () => fetchNotes(id) })
}

export function useAddNote(id: string): UseMutationResult<AppointmentNote, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => addNote(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: appointmentNotesKey(id) }),
  })
}

export function useAttachmentsQuery(id: string): UseQueryResult<Attachment[], Error> {
  return useQuery({ queryKey: appointmentAttachmentsKey(id), queryFn: () => fetchAttachments(id) })
}

export function useUploadAttachment(id: string): UseMutationResult<void, Error, File> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { upload_url } = await createAttachment(id, {
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        size: file.size,
      })
      await uploadToPresignedUrl(upload_url, file)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: appointmentAttachmentsKey(id) }),
  })
}

export function useDeleteAttachment(id: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(id, attachmentId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: appointmentAttachmentsKey(id) }),
  })
}
