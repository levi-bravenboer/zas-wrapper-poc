import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ListQuery } from '@/lib/query/paginated'

import { usePaginatedQuery, type Page } from './use-paginated-query'

// Hoisted GET spy so the `vi.mock` factory below sees it.
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('@/lib/api/client', () => ({
  api: { GET: getMock },
}))

interface DemoItem {
  id: string
  name: string
}

function makePage(overrides: Partial<Page<DemoItem>> = {}): Page<DemoItem> {
  return {
    items: [{ id: 'a', name: 'Alice' }],
    page: 1,
    page_size: 25,
    total: 1,
    total_pages: 1,
    ...overrides,
  }
}

function wrapper(): {
  queryClient: QueryClient
  Wrapper: React.FC<{ children: React.ReactNode }>
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, Wrapper }
}

describe('usePaginatedQuery', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('returns a Page<T> shape on success', async () => {
    getMock.mockResolvedValue({
      data: makePage(),
      response: new Response(null, { status: 200 }),
    })
    const { Wrapper } = wrapper()

    const { result } = renderHook(
      () => usePaginatedQuery<DemoItem>('/patients', { page: 1, page_size: 25 }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        page: expect.any(Number),
        page_size: expect.any(Number),
        total: expect.any(Number),
        total_pages: expect.any(Number),
      }),
    )
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith(
      '/patients',
      expect.objectContaining({
        params: { query: { page: 1, page_size: 25 } },
        querySerializer: expect.any(Function),
      }),
    )
  })

  it('does not refetch when the query object is reordered but logically equivalent', async () => {
    getMock.mockResolvedValue({
      data: makePage(),
      response: new Response(null, { status: 200 }),
    })
    const { Wrapper } = wrapper()

    const initial: ListQuery = {
      page: 1,
      page_size: 25,
      filters: {
        status: { op: 'eq', value: 'active' },
        owner_id: { op: 'in', value: ['u1', 'u2'] },
      },
    }
    const reordered: ListQuery = {
      filters: {
        owner_id: { op: 'in', value: ['u2', 'u1'] },
        status: { op: 'eq', value: 'active' },
      },
      page_size: 25,
      page: 1,
    }

    const { result, rerender } = renderHook(
      ({ q }: { q: ListQuery }) => usePaginatedQuery<DemoItem>('/patients', q),
      { wrapper: Wrapper, initialProps: { q: initial } },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getMock).toHaveBeenCalledTimes(1)

    rerender({ q: reordered })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Same canonical query key => no extra GET.
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when any query field changes', async () => {
    getMock.mockResolvedValue({
      data: makePage(),
      response: new Response(null, { status: 200 }),
    })
    const { Wrapper } = wrapper()

    const { result, rerender } = renderHook(
      ({ q }: { q: ListQuery }) => usePaginatedQuery<DemoItem>('/patients', q),
      { wrapper: Wrapper, initialProps: { q: { page: 1, page_size: 25 } } },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getMock).toHaveBeenCalledTimes(1)

    rerender({ q: { page: 2, page_size: 25 } })

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    expect(getMock).toHaveBeenLastCalledWith(
      '/patients',
      expect.objectContaining({
        params: { query: { page: 2, page_size: 25 } },
        querySerializer: expect.any(Function),
      }),
    )
  })
})
