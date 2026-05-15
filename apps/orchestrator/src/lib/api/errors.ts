export interface ApiError extends Error {
  status: number
}

export function apiError(message: string, status: number): ApiError {
  const err = new Error(message) as ApiError
  err.status = status
  return err
}
