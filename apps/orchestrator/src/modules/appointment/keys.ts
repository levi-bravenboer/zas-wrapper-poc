export const appointmentsListKey = ['appointments'] as const

export function appointmentKey(appointmentId: string): readonly unknown[] {
  return ['appointments', appointmentId] as const
}

export function patientAppointmentsKey(patientId: string): readonly unknown[] {
  return ['patients', patientId, 'appointments'] as const
}
