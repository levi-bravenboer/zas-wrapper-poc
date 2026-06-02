import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react-native'
import { Provider as JotaiProvider } from 'jotai'
import type { ReactElement, ReactNode } from 'react'

function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

type Wrapper = (props: { children: ReactNode }) => ReactElement

function makeWrapper(): Wrapper {
  const client = buildClient()
  return function Providers({ children }) {
    return (
      <QueryClientProvider client={client}>
        <JotaiProvider>{children}</JotaiProvider>
      </QueryClientProvider>
    )
  }
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: makeWrapper(), ...options })
}
