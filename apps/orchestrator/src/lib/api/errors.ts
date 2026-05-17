export interface ApiError extends Error {
  status: number
  code?: string
}

export function apiError(message: string, status: number, code?: string): ApiError {
  const err = new Error(message) as ApiError
  err.status = status
  if (code) err.code = code
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
