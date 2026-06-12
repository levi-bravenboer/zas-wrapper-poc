import type { components } from '@/lib/api/schema'

export type TaskItem = components['schemas']['TaskItem']
export type AppointmentPayload = components['schemas']['AppointmentPayload']
export type PatientInlineSummary = components['schemas']['PatientInlineSummary']
export type AppointmentParticipantInlineSummary =
  components['schemas']['AppointmentParticipantInlineSummary']
export type AppointmentKind = AppointmentPayload['kind']
export type AppointmentModality = AppointmentPayload['modality']
