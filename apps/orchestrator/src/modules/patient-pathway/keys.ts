export const patientPathwayKeys = {
  all: ['patient-pathway'] as const,
  enrollments: (patientId: string) => ['patient-pathway', 'enrollments', patientId] as const,
}
