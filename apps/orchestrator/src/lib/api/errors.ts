export interface ApiError extends Error {
  status: number
  code?: string
  details?: Record<string, unknown>
}

export function apiError(
  message: string,
  status: number,
  code?: string,
  details?: Record<string, unknown>,
): ApiError {
  const err = new Error(message) as ApiError
  err.status = status
  if (code) err.code = code
  if (details) err.details = details
  return err
}

export async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as { code?: unknown }
    return typeof body?.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

export async function readErrorBody(
  response: Response,
): Promise<{ code?: string; message?: string; details?: Record<string, unknown> } | undefined> {
  try {
    const body = (await response.clone().json()) as {
      code?: unknown
      message?: unknown
      details?: unknown
    }
    const result: { code?: string; message?: string; details?: Record<string, unknown> } = {}
    if (typeof body?.code === 'string') result.code = body.code
    if (typeof body?.message === 'string') result.message = body.message
    if (body?.details && typeof body.details === 'object') {
      result.details = body.details as Record<string, unknown>
    }
    return result
  } catch {
    return undefined
  }
}
