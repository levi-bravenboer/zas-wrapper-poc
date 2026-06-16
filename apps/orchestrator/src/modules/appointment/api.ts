import { api } from '@/lib/api/client'
import { unwrapApi } from '@/lib/api/unwrap'

import type { Appointment, PatientAppointmentEntry } from './types'

export async function fetchAppointments(): Promise<Appointment[]> {
  const page = await unwrapApi(
    api.GET('/appointments', { params: { query: { page_size: 100 } } }),
    'Appointments fetch failed',
  )
  return page.items
}

export async function fetchAppointment(appointmentId: string): Promise<Appointment> {
  return unwrapApi(
    api.GET('/appointments/{appointment_id}', { params: { path: { appointment_id: appointmentId } } }),
    'Appointment fetch failed',
  )
}

export async function fetchPatientAppointments(
  patientId: string,
): Promise<PatientAppointmentEntry[]> {
  return unwrapApi(
    api.GET('/patients/{patient_id}/appointments', { params: { path: { patient_id: patientId } } }),
    'Patient appointments fetch failed',
  )
}
