import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import * as React from 'react'
import { describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { paginatedQueryKey } from '@/lib/query/paginated'
import { server } from '@/mocks/server'

import { useAssignUserRole, useSetUserActive, useUserDetail } from './hooks'
import { USERS_LIST_PATH, userKeys } from './keys'

const baseUrl = env.API_BASE_URL

const USER_ID = '11111111-1111-4111-8111-111111111111'

const ROLE_ID = '22222222-2222-4222-8222-222222222222'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'u@zas.local',
    display_name: 'U',
    role_id: ROLE_ID,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    ...makeRow(),
    external_idp: null,
    external_subject: null,
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function makeSharedWrapper(qc: QueryClient) {
  return function SharedWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useUserDetail', () => {
  it('fetches detail by id', async () => {
    server.use(http.get(`${baseUrl}/users/${USER_ID}`, () => HttpResponse.json(makeDetail())))

    const { result } = renderHook(() => useUserDetail(USER_ID), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe(USER_ID)
    expect(result.current.data?.external_idp).toBeNull()
  })

  it('stays disabled for empty userId', () => {
    const { result } = renderHook(() => useUserDetail(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces error on 404', async () => {
    server.use(
      http.get(`${baseUrl}/users/${USER_ID}`, () =>
        HttpResponse.json({ detail: 'gone' }, { status: 404 }),
      ),
    )
    const { result } = renderHook(() => useUserDetail(USER_ID), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSetUserActive', () => {
  it('toggles is_active', async () => {
    server.use(
      http.patch(`${baseUrl}/users/${USER_ID}/active`, () =>
        HttpResponse.json(makeRow({ is_active: false })),
      ),
    )

    const { result } = renderHook(() => useSetUserActive(), { wrapper })
    const row = await result.current.mutateAsync({ userId: USER_ID, is_active: false })
    expect(row.is_active).toBe(false)
  })

  it('invalidates paginated users list and detail caches on success', async () => {
    server.use(
      http.patch(`${baseUrl}/users/${USER_ID}/active`, () =>
        HttpResponse.json(makeRow({ is_active: false })),
      ),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const listKey = paginatedQueryKey(USERS_LIST_PATH, {})
    qc.setQueryData(listKey, { items: [], page: 1, page_size: 25, total: 0, total_pages: 1 })
    qc.setQueryData(userKeys.detail(USER_ID), makeRow())

    const { result } = renderHook(() => useSetUserActive(), {
      wrapper: makeSharedWrapper(qc),
    })
    await result.current.mutateAsync({ userId: USER_ID, is_active: false })

    expect(qc.getQueryState(listKey)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(userKeys.detail(USER_ID))?.isInvalidated).toBe(true)
  })
})

describe('useAssignUserRole', () => {
  it('assigns role', async () => {
    server.use(
      http.patch(`${baseUrl}/users/${USER_ID}/role`, () =>
        HttpResponse.json(makeRow({ role_id: ROLE_ID })),
      ),
    )

    const { result } = renderHook(() => useAssignUserRole(), { wrapper })
    const row = await result.current.mutateAsync({ userId: USER_ID, role_id: ROLE_ID })
    expect(row.role_id).toBe(ROLE_ID)
  })

  it('invalidates paginated users list and detail caches on success', async () => {
    server.use(
      http.patch(`${baseUrl}/users/${USER_ID}/role`, () =>
        HttpResponse.json(makeRow({ role_id: ROLE_ID })),
      ),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const listKey = paginatedQueryKey(USERS_LIST_PATH, {})
    qc.setQueryData(listKey, { items: [], page: 1, page_size: 25, total: 0, total_pages: 1 })
    qc.setQueryData(userKeys.detail(USER_ID), makeRow())

    const { result } = renderHook(() => useAssignUserRole(), {
      wrapper: makeSharedWrapper(qc),
    })
    await result.current.mutateAsync({ userId: USER_ID, role_id: ROLE_ID })

    expect(qc.getQueryState(listKey)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(userKeys.detail(USER_ID))?.isInvalidated).toBe(true)
  })
})
