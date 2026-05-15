import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { i18n } from '@/lib/i18n'
import { server } from '@/mocks/server'
import { strategies } from '@/modules/auth/providers'

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useRouterState: ({ select }: { select?: (s: unknown) => unknown }) => {
      const state = { location: { search: {} } }
      return select ? select(state) : state
    },
  }
})

import { ProviderList } from './ProviderList'

const baseUrl = env.API_BASE_URL

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <ProviderList />
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('ProviderList', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the password strategy when the registry returns it', async () => {
    server.use(
      http.get(`${baseUrl}/auth/providers`, () =>
        HttpResponse.json([{ key: 'password', label: 'pwd', kind: 'password' }]),
      ),
    )
    renderList()
    expect(await screen.findByLabelText(/E-mailadres/i)).toBeInTheDocument()
  })

  it('renders the "no provider available" message on an empty list', async () => {
    server.use(http.get(`${baseUrl}/auth/providers`, () => HttpResponse.json([])))
    renderList()
    expect(await screen.findByText(/Geen inlogmethode beschikbaar/i)).toBeInTheDocument()
  })

  it('renders an error + retry button when discovery fails', async () => {
    server.use(
      http.get(`${baseUrl}/auth/providers`, () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    )
    renderList()
    expect(await screen.findByText(/Inlogmethodes konden niet worden geladen/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Opnieuw proberen/i })).toBeInTheDocument()
  })

  it('skips an unknown provider kind with a console warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(strategies.oidc).toBeUndefined()
    server.use(
      http.get(`${baseUrl}/auth/providers`, () =>
        HttpResponse.json([{ key: 'eid', label: 'eID', kind: 'oidc' }]),
      ),
    )
    renderList()
    // Wait for at least one warn call (which fires after the query resolves).
    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled())
  })
})
