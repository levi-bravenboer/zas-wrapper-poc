import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

import type { Appointment, PatientAppointmentEntry } from './types'

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
