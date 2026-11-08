import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import { exchangeAuthCode, SmartExchangeError } from '@/modules/smart-launch/api'
import { useLaunchStore } from '@/modules/smart-launch/store'

import { LaunchCallbackPage } from './launch.callback'

vi.mock('@/modules/smart-launch/api', async (orig) => {
  const actual = (await orig()) as typeof import('@/modules/smart-launch/api')
  return { ...actual, exchangeAuthCode: vi.fn() }
})

const exchangeMock = vi.mocked(exchangeAuthCode)

function renderPage(props: Parameters<typeof LaunchCallbackPage>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <LaunchCallbackPage {...props} />
    </I18nextProvider>,
  )
}

beforeEach(() => {
  useLaunchStore.getState().setFromSearch({
    iss: 'https://fhir.example.org',
    launch: 'launch-1',
    surface: 'smart',
  })
})

afterEach(() => {
  exchangeMock.mockReset()
  useLaunchStore.getState().clear()
  window.sessionStorage.clear()
})

describe('LaunchCallbackPage', () => {
  it('renders the OAuth error UI without invoking exchange', () => {
    renderPage({
      search: { error: 'access_denied', error_description: 'user cancelled' },
      navigate: vi.fn(),
    })

    expect(screen.getByRole('alert')).toHaveTextContent('user cancelled')
    expect(exchangeMock).not.toHaveBeenCalled()
  })

  it('falls back to the error code when no description is provided', () => {
    renderPage({ search: { error: 'invalid_grant' }, navigate: vi.fn() })

    expect(screen.getByRole('alert')).toHaveTextContent('invalid_grant')
  })

  it('navigates to the surface base path on a successful exchange', async () => {
    exchangeMock.mockResolvedValue({
      client: {} as never,
      token: { access_token: 't', token_type: 'bearer' } as never,
      ctx: {},
    })
    const navigate = vi.fn()

    renderPage({ search: { code: 'auth-code', state: 'st' }, navigate })

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/s/', replace: true }))
    expect(exchangeMock).toHaveBeenCalledOnce()
  })

  it('navigates to the stored returnPath when set', async () => {
    useLaunchStore.getState().setFromSearch({
      iss: 'https://fhir.example.org',
      launch: 'launch-2',
      surface: 'embed',
      return: '/embed/tasks',
    })
    exchangeMock.mockResolvedValue({
      client: {} as never,
      token: { access_token: 't', token_type: 'bearer' } as never,
      ctx: {},
    })
    const navigate = vi.fn()

    renderPage({ search: { code: 'c', state: 's' }, navigate })

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/embed/tasks', replace: true }),
    )
  })

  it('shows the translated message instead of the technical SmartExchangeError text', async () => {
    exchangeMock.mockRejectedValue(new SmartExchangeError('token response missing', null))
    const navigate = vi.fn()

    renderPage({ search: { code: 'c', state: 's' }, navigate })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Inloggen via EPD mislukt')
    expect(alert).not.toHaveTextContent('token response missing')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to the generic message for non-SmartExchangeError failures', async () => {
    exchangeMock.mockRejectedValue(new Error('boom'))
    const navigate = vi.fn()

    renderPage({ search: { code: 'c', state: 's' }, navigate })

    expect(await screen.findByRole('alert')).toHaveTextContent('Inloggen via EPD mislukt')
  })

  it('rebuilds the launch URL when the retry button is pressed', async () => {
    const assignSpy = vi.fn()
    vi.spyOn(window.location, 'assign').mockImplementation(assignSpy)
    const user = userEvent.setup()

    renderPage({ search: { error: 'oops' }, navigate: vi.fn() })
    await user.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))

    expect(assignSpy).toHaveBeenCalledWith(
      '/launch?iss=https%3A%2F%2Ffhir.example.org&launch=launch-1&surface=smart',
    )
  })
})
