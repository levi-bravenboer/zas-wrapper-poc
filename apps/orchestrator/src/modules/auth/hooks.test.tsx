import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import * as React from 'react'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/server'

import { useLogin, useLogout, useSession } from './hooks'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSession', () => {
  it('returns the user on 200', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@b.co',
          displayName: 'A',
          roles: ['clinician'],
        }),
      ),
    )

    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('u1')
  })

  it('returns null on 401', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({ detail: 'no' }, { status: 401 }),
      ),
    )

    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('errors on a 500 response', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    )

    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useLogin', () => {
  it('updates the session cache on success', async () => {
    const user = {
      id: 'u2',
      email: 'l@b.co',
      displayName: 'L',
      roles: ['clinician'],
    }
    server.use(http.post(`${baseUrl}/auth/login`, () => HttpResponse.json(user)))

    const { result } = renderHook(() => useLogin(), { wrapper })
    await result.current.mutateAsync({ username: 'l', password: 'p' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('u2')
  })

  it('surfaces an error on 401', async () => {
    server.use(
      http.post(`${baseUrl}/auth/login`, () =>
        HttpResponse.json({ detail: 'nope' }, { status: 401 }),
      ),
    )

    const { result } = renderHook(() => useLogin(), { wrapper })
    await expect(
      result.current.mutateAsync({ username: 'l', password: 'p' }),
    ).rejects.toThrow()
  })
})

describe('useLogout', () => {
  it('clears the session cache on success', async () => {
    server.use(http.post(`${baseUrl}/auth/logout`, () => new HttpResponse(null, { status: 204 })))

    const { result } = renderHook(() => useLogout(), { wrapper })
    await result.current.mutateAsync()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('throws on a non-2xx response', async () => {
    server.use(
      http.post(`${baseUrl}/auth/logout`, () =>
        HttpResponse.json({ detail: 'fail' }, { status: 500 }),
      ),
    )

    const { result } = renderHook(() => useLogout(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow()
  })
})
