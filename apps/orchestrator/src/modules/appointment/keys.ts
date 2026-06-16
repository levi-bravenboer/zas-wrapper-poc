export const appointmentsListKey = ['appointments'] as const

export function appointmentKey(appointmentId: string): readonly unknown[] {
  return ['appointments', appointmentId] as const
}

export function appointmentNotesKey(appointmentId: string): readonly unknown[] {
  return ['appointments', appointmentId, 'notes'] as const
}

export function appointmentAttachmentsKey(appointmentId: string): readonly unknown[] {
  return ['appointments', appointmentId, 'attachments'] as const
}

export function patientAppointmentsKey(patientId: string): readonly unknown[] {
  return ['patients', patientId, 'appointments'] as const
}
