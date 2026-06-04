import type { PatientSession } from '@/modules/auth/types'

export function makePatientSession(
  overrides?: Partial<PatientSession>
): PatientSession {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    given_name: 'Sven',
    patient_id: '11111111-2222-3333-4444-555555555555',
    tenant_id: '99999999-8888-7777-6666-555555555555',
    ...overrides,
  }
}
