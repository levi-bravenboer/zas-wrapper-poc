import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { LoginForm } from './LoginForm'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

describe('LoginForm (PoC placeholder)', () => {
  it('navigates to / on submit without validating or hitting the network', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <LoginForm />
        </I18nextProvider>
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Inloggen' }))

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
