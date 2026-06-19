const PATIENT_KEYS_SCOPE = 'patient' as const

export const patientKeys = {
  all: [PATIENT_KEYS_SCOPE] as const,
  detail: (patientId: string) => [PATIENT_KEYS_SCOPE, 'detail', patientId] as const,
  careTeams: (patientId: string) => [PATIENT_KEYS_SCOPE, 'care-teams', patientId] as const,
  lusciiDataPrefix: (patientId: string) => [PATIENT_KEYS_SCOPE, 'luscii-data', patientId] as const,
  lusciiData: (patientId: string, days?: number) =>
    [PATIENT_KEYS_SCOPE, 'luscii-data', patientId, days ?? 30] as const,
  lusciiConnections: (patientId: string) =>
    [PATIENT_KEYS_SCOPE, 'luscii-connections', patientId] as const,
}
