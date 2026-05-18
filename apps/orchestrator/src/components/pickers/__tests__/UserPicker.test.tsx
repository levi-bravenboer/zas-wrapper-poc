import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserPicker } from '../UserPicker'

const { usePaginatedQueryMock } = vi.hoisted(() => ({
  usePaginatedQueryMock: vi.fn(),
}))

vi.mock('@/hooks/use-paginated-query', () => ({
  usePaginatedQuery: usePaginatedQueryMock,
}))

const users = [
  {
    id: 'u-1',
    email: 'alice@zas.demo',
    display_name: 'Alice Admin',
    role: 'admin' as const,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u-2',
    email: 'bob@zas.demo',
    display_name: 'Bob Caregiver',
    role: 'caregiver' as const,
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
  },
]

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('UserPicker', () => {
  beforeEach(() => {
    usePaginatedQueryMock.mockReset()
    usePaginatedQueryMock.mockReturnValue({
      data: { items: users, page: 1, page_size: 50, total: 2, total_pages: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('renders the placeholder when no value is selected', () => {
    render(
      <Wrap>
        <UserPicker role="admin" value={null} onChange={vi.fn()} />
      </Wrap>,
    )
    expect(screen.getByRole('combobox', { name: /selecteer gebruiker/i })).toBeTruthy()
  })

  it('opens, shows items, and calls onChange(userId, user) on select', async () => {
    const onChange = vi.fn()
    render(
      <Wrap>
        <UserPicker role="caregiver" value={null} onChange={onChange} />
      </Wrap>,
    )
    await userEvent.click(screen.getByRole('combobox'))
    const option = await screen.findByText('Bob Caregiver')
    await userEvent.click(option)
    expect(onChange).toHaveBeenCalledWith('u-2', expect.objectContaining({ id: 'u-2' }))
  })

  it('forwards the role filter into usePaginatedQuery via filter envelope', () => {
    render(
      <Wrap>
        <UserPicker role="caregiver" value={null} onChange={vi.fn()} />
      </Wrap>,
    )
    const lastCall = usePaginatedQueryMock.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('/users')
    expect(lastCall?.[1].filters).toEqual({ role: { op: 'eq', value: 'caregiver' } })
  })
})
