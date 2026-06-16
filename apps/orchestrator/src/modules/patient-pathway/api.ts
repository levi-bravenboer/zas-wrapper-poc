import { api } from '@/lib/api/client'

import type { BlockExecution, Enrollment, EnrollmentCreate } from './types'

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

export async function cancelEnrollment(enrollmentId: string): Promise<Enrollment> {
  const result = await api.POST('/enrollments/{enrollment_id}:cancel', {
    params: { path: { enrollment_id: enrollmentId } },
  })
  if (!result.data) {
    throw enrollmentError('Failed to cancel enrollment', result.response.status)
  }
  return result.data
}

export async function pauseEnrollment(enrollmentId: string): Promise<Enrollment> {
  const result = await api.POST('/enrollments/{enrollment_id}:pause', {
    params: { path: { enrollment_id: enrollmentId } },
  })
  if (!result.data) {
    throw enrollmentError('Failed to pause enrollment', result.response.status)
  }
  return result.data
}

export async function resumeEnrollment(enrollmentId: string): Promise<Enrollment> {
  const result = await api.POST('/enrollments/{enrollment_id}:resume', {
    params: { path: { enrollment_id: enrollmentId } },
  })
  if (!result.data) {
    throw enrollmentError('Failed to resume enrollment', result.response.status)
  }
  return result.data
}

async function startExecution(enrollmentId: string, executionId: string): Promise<void> {
  const result = await api.POST('/enrollments/{enrollment_id}/executions/{execution_id}:start', {
    params: { path: { enrollment_id: enrollmentId, execution_id: executionId } },
  })
  if (!result.data) {
    throw enrollmentError('Failed to start step', result.response.status)
  }
}

async function completeExecution(
  enrollmentId: string,
  executionId: string,
  result: Record<string, unknown> | null,
): Promise<BlockExecution> {
  const response = await api.POST(
    '/enrollments/{enrollment_id}/executions/{execution_id}:complete',
    {
      params: { path: { enrollment_id: enrollmentId, execution_id: executionId } },
      body: { result },
    },
  )
  if (!response.data) {
    throw enrollmentError('Failed to complete step', response.response.status)
  }
  return response.data
}

/**
 * Drives a step from eligible/active to completed. The runtime requires an
 * `active` state before completion (eligible → active → completed), so this
 * starts the execution first when it has not been started yet.
 */
export async function completeStep(
  enrollmentId: string,
  execution: BlockExecution,
  result: Record<string, unknown> | null,
): Promise<BlockExecution> {
  if (execution.state === 'eligible') {
    await startExecution(enrollmentId, execution.id)
  }
  return completeExecution(enrollmentId, execution.id, result)
}
