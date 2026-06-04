import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Provider as JotaiProvider } from 'jotai'
import type { ReactNode } from 'react'
import React from 'react'

import { requestAuthed } from '@/lib/api'
import { useLogin } from '@/modules/auth/hooks/use-login'

import { makePatientSession } from '../../../fixtures/auth'

const mockRequestAuthed = requestAuthed as jest.MockedFunction<
  typeof requestAuthed
>

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(JotaiProvider, null, children)
    )
  }
}

describe('useLogin', () => {
  beforeEach(() => {
    mockRequestAuthed.mockReset()
  })

  it('calls login API and resolves', async () => {
    const session = makePatientSession()
    mockRequestAuthed.mockResolvedValue({ session })

    const { result } = renderHook(() => useLogin(), {
      wrapper: makeWrapper(),
    })

    expect(result.current.isLoading).toBe(false)

    act(() => {
      result.current.login({
        tenant: 'zas',
        email: 'patient@zas.local',
        password: 'secret',
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockRequestAuthed).toHaveBeenCalled()
  })
})
