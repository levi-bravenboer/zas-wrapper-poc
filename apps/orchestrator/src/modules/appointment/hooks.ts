import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { fetchAppointment, fetchAppointments, fetchPatientAppointments } from './api'
import { appointmentKey, appointmentsListKey, patientAppointmentsKey } from './keys'
import type { Appointment, PatientAppointmentEntry } from './types'

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
