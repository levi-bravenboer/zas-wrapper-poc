import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/router', () => ({
  router: { navigate: vi.fn() },
}))

import { router } from '@/app/router'
import { env } from '@/config/env'
import { server } from '@/mocks/server'

import { useLogin, useLogout, useProviders, useSession } from './hooks'
import { authKeys } from './keys'

const baseUrl = env.API_BASE_URL

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
          display_name: 'A',
          tenant_id: '00000000-0000-0000-0000-000000000001',
          role: 'caregiver',
        }),
      ),
    )

    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('u1')
  })

  it('returns null on 401', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json({ detail: 'no' }, { status: 401 })),
    )

    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('errors on a 500 response', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
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
      display_name: 'L',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      role: 'caregiver',
    }
    server.use(http.post(`${baseUrl}/auth/login/password`, () => HttpResponse.json(user)))

    const { result } = renderHook(() => useLogin(), { wrapper })
    await result.current.mutateAsync({ email: 'l@b.co', password: 'p' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('u2')
  })

  it('surfaces an error on 401', async () => {
    server.use(
      http.post(`${baseUrl}/auth/login/password`, () =>
        HttpResponse.json({ detail: 'nope' }, { status: 401 }),
      ),
    )

    const { result } = renderHook(() => useLogin(), { wrapper })
    await expect(result.current.mutateAsync({ email: 'l@b.co', password: 'p' })).rejects.toThrow()
  })
})

describe('useProviders', () => {
  it('uses authKeys.providers and resolves the mocked endpoint', async () => {
    server.use(
      http.get(`${baseUrl}/auth/providers`, () =>
        HttpResponse.json([{ key: 'password', label: 'pwd', kind: 'password' }]),
      ),
    )
    expect(authKeys.providers()).toEqual(['auth', 'providers'])

    const { result } = renderHook(() => useProviders(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.kind).toBe('password')
  })
})

describe('useLogout', () => {
  const navigateMock = vi.mocked(router.navigate)

  beforeEach(() => {
    navigateMock.mockClear()
  })

  it('clears the session cache and navigates to /login on success', async () => {
    server.use(http.post(`${baseUrl}/auth/logout`, () => new HttpResponse(null, { status: 204 })))

    const { result } = renderHook(() => useLogout(), { wrapper })
    await result.current.mutateAsync()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/login', replace: true })
  })

  it('throws on a non-2xx response and does not navigate', async () => {
    server.use(
      http.post(`${baseUrl}/auth/logout`, () =>
        HttpResponse.json({ detail: 'fail' }, { status: 500 }),
      ),
    )

    const { result } = renderHook(() => useLogout(), { wrapper })
    await expect(result.current.mutateAsync()).rejects.toThrow()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
