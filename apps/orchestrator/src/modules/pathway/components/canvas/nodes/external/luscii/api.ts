import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'

import type { LusciiProgramData } from './types'

export type LusciiProgramSummary = components['schemas']['LusciiProgramSummary']

export type LusciiApiError = Error & { status: number; code?: string }

function lusciiError(message: string, status: number, code?: string): LusciiApiError {
  const err = new Error(message) as LusciiApiError
  err.status = status
  if (code) err.code = code
  return err
}

export async function listLusciiPrograms(): Promise<LusciiProgramSummary[]> {
  const result = await api.GET('/luscii/programs', {})
  if (!result.data) {
    throw lusciiError('Failed to load Luscii programs', result.response.status)
  }
  return result.data
}

export async function getLusciiProgram(id: string): Promise<LusciiProgramData> {
  const result = await api.GET('/luscii/programs/{program_id}', {
    params: { path: { program_id: id } },
  })
  if (!result.data) {
    throw lusciiError('Failed to load Luscii program', result.response.status)
  }
  return result.data
}
