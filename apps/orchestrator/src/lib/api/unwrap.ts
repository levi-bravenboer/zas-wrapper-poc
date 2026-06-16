import { apiError } from './errors'

/**
 * Unwrap an openapi-fetch `{ data, response }` result, throwing a typed
 * `apiError` on a non-OK response or missing body. Centralises the
 * `if (!response.ok || !data) throw …` boilerplate repeated across module api
 * layers.
 */
export async function unwrapApi<T>(
  call: Promise<{ data?: T; response: Response }>,
  message: string,
): Promise<T> {
  const { data, response } = await call
  if (!response.ok || data === undefined) {
    throw apiError(message, response.status)
  }
  return data
}
