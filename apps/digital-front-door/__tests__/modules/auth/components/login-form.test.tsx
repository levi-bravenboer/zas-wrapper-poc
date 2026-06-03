import { requestAuthed, UnauthenticatedError } from '@/lib/api'
import { LoginForm } from '@/modules/auth/components/login-form'

import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderWithProviders } from '../../../utils/render-with-providers'

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.requireActual bypasses module mock
  const i18nModule = jest.requireActual('@/lib/i18n') as {
    initI18n: () => Promise<void>
  }
  await i18nModule.initI18n()
})

const mockRequestAuthed = requestAuthed as jest.MockedFunction<
  typeof requestAuthed
>

describe('LoginForm', () => {
  beforeEach(() => {
    mockRequestAuthed.mockReset()
  })

  it('renders Dutch labels', () => {
    const { getByText } = renderWithProviders(<LoginForm />)

    expect(getByText('E-mailadres')).toBeTruthy()
    expect(getByText('Wachtwoord')).toBeTruthy()
    expect(getByText('Aanmelden')).toBeTruthy()
  })

  it('calls login mutation on submit', async () => {
    mockRequestAuthed.mockResolvedValue({
      session: {
        id: 'test',
        given_name: 'Sven',
        patient_id: 'p1',
        tenant_id: 't1',
      },
    })

    const { getByText, getByTestId } = renderWithProviders(<LoginForm />)

    fireEvent.changeText(getByTestId('login-email'), 'patient@zas.local')
    fireEvent.changeText(getByTestId('login-password'), 'secret')

    await act(async () => {
      fireEvent.press(getByText('Aanmelden'))
    })

    await waitFor(() => {
      expect(mockRequestAuthed).toHaveBeenCalledWith(
        '/mobile/auth/login/password',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('shows error on 401', async () => {
    mockRequestAuthed.mockRejectedValue(new UnauthenticatedError())

    const { getByText, getByTestId } = renderWithProviders(<LoginForm />)

    fireEvent.changeText(getByTestId('login-email'), 'patient@zas.local')
    fireEvent.changeText(getByTestId('login-password'), 'wrong')

    await act(async () => {
      fireEvent.press(getByText('Aanmelden'))
    })

    await waitFor(() => {
      expect(getByText('Ongeldige inloggegevens')).toBeTruthy()
    })
  })
})
