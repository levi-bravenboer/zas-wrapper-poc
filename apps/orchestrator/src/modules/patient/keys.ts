const PATIENT_KEYS_SCOPE = 'patient' as const

export const patientKeys = {
  all: [PATIENT_KEYS_SCOPE] as const,
  detail: (patientId: string) => [PATIENT_KEYS_SCOPE, 'detail', patientId] as const,
  careTeams: (patientId: string) => [PATIENT_KEYS_SCOPE, 'care-teams', patientId] as const,
}
