import { api } from '@/lib/api/client'

import type { Enrollment, EnrollmentCreate } from './types'

export type EnrollmentApiError = Error & {
  status: number
  code?: string
  /** Set when the backend rejects a create for unsupplied required deferred fields. */
  missing?: string[]
}

function enrollmentError(message: string, status: number): EnrollmentApiError {
  const err = new Error(message) as EnrollmentApiError
  err.status = status
  return err
}

export async function listPatientEnrollments(patientId: string): Promise<Enrollment[]> {
  const result = await api.GET('/enrollments', {
    params: { query: { patient_id: patientId } },
  })
  if (!result.data) {
    throw enrollmentError('Failed to load enrollments', result.response.status)
  }
  return result.data
}

export async function createEnrollment(payload: EnrollmentCreate): Promise<Enrollment> {
  const result = await api.POST('/enrollments', { body: payload })
  if (result.data) return result.data

  const status = result.response.status
  const body = result.error as
    | { code?: string; message?: string; details?: { missing?: string[] } }
    | undefined
  const err = enrollmentError(body?.message ?? 'Failed to create enrollment', status)
  if (body?.code) err.code = body.code
  if (body?.details?.missing) err.missing = body.details.missing
  throw err
}
