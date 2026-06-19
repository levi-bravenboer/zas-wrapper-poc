import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { i18n } from '@/lib/i18n'
import { server } from '@/mocks/server'

const navigateMock = vi.fn()
let currentRedirect: string | undefined

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useRouterState: ({ select }: { select?: (s: unknown) => unknown }) => {
      const state = { location: { search: { redirect: currentRedirect } } }
      return select ? select(state) : state
    },
  }
})

import { safeRedirect } from '../redirect'

import { LoginForm } from './LoginForm'

const baseUrl = env.API_BASE_URL
const STUB_USER = {
  id: 'u1',
  email: 'caregiver@zas.local',
  display_name: 'Care',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  role_id: 'd2222222-2222-4222-8222-2222222222d1',
  role_slug: 'default',
  permissions: [],
  patient_id: null,
}

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <LoginForm />
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

async function fillAndSubmit(email = STUB_USER.email, password = 'changeme') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/E-mailadres/i), email)
  await user.type(screen.getByLabelText(/Wachtwoord/i), password)
  await user.click(screen.getByRole('button', { name: 'Inloggen' }))
  return user
}

describe('LoginForm', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    currentRedirect = undefined
  })

  it('navigates to / on happy path', async () => {
    server.use(http.post(`${baseUrl}/auth/login/password`, () => HttpResponse.json(STUB_USER)))
    renderForm()
    await fillAndSubmit()
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/' }))
  })

  it('honours ?redirect=/tasks/abc', async () => {
    currentRedirect = '/tasks/abc'
    server.use(http.post(`${baseUrl}/auth/login/password`, () => HttpResponse.json(STUB_USER)))
    renderForm()
    await fillAndSubmit()
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks/abc' }))
  })

  it('drops //evil.com redirect to /', async () => {
    currentRedirect = '//evil.com'
    server.use(http.post(`${baseUrl}/auth/login/password`, () => HttpResponse.json(STUB_USER)))
    renderForm()
    await fillAndSubmit()
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/' }))
  })

  it('shows invalid_credentials and clears password on 401', async () => {
    server.use(
      http.post(`${baseUrl}/auth/login/password`, () =>
        HttpResponse.json({ detail: 'nope' }, { status: 401 }),
      ),
    )
    renderForm()
    await fillAndSubmit('caregiver@zas.local', 'nope')
    expect(await screen.findByText('Ongeldige inloggegevens')).toBeInTheDocument()
    const password = screen.getByLabelText(/Wachtwoord/i) as HTMLInputElement
    expect(password.value).toBe('')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows generic error on 500', async () => {
    server.use(
      http.post(`${baseUrl}/auth/login/password`, () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    )
    renderForm()
    await fillAndSubmit()
    expect(await screen.findByText('Er ging iets mis, probeer opnieuw')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('blocks submit with invalid email', async () => {
    renderForm()
    await fillAndSubmit('not-an-email', 'changeme')
    expect(await screen.findByText('Ongeldige gegevens')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('safeRedirect', () => {
  it.each([
    [undefined, '/'],
    ['', '/'],
    ['evil.com', '/'],
    ['//evil.com', '/'],
    ['/tasks\\foo', '/'],
    ['/login', '/'],
    ['/tasks/abc', '/tasks/abc'],
  ])('safeRedirect(%j) → %j', (input, expected) => {
    expect(safeRedirect(input as string | undefined)).toBe(expected)
  })
})

describe('LoginForm multi-role', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    currentRedirect = undefined
  })

  it('shows the role picker on requires_role_selection and binds on pick', async () => {
    server.use(
      http.post(`${baseUrl}/auth/login/password`, () =>
        HttpResponse.json(
          {
            requires_role_selection: true,
            available_roles: [
              { user_id: 'u-admin', role_slug: 'admin', is_patient: false },
              { user_id: 'u-care', role_slug: 'default', is_patient: false },
            ],
          },
          { status: 200 },
        ),
      ),
      http.post(`${baseUrl}/auth/session/role`, () =>
        HttpResponse.json(
          {
            ...STUB_USER,
            id: 'u9',
            role_id: 'a1111111-1111-4111-8111-1111111111a1',
            role_slug: 'admin',
          },
          { status: 200 },
        ),
      ),
    )
    currentRedirect = '/tasks'
    renderForm()
    await fillAndSubmit('hoofdarts@zas.local')

    expect(await screen.findByText(/Kies je rol/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Beheerder/i }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: safeRedirect('/tasks') }))
  })
})
