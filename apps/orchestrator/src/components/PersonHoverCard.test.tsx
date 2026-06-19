import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { i18n } from '@/lib/i18n'
import { server } from '@/mocks/server'

import { PersonHoverCard, type PersonRef } from './PersonHoverCard'

const baseUrl = env.API_BASE_URL

const PATIENT_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const ROLE_ID = '22222222-2222-4222-8222-222222222222'

function servePatient(): void {
  server.use(
    http.get(`${baseUrl}/patients/${PATIENT_ID}`, () =>
      HttpResponse.json({
        id: PATIENT_ID,
        family_name: 'Janssen',
        given_name: 'Marie',
        birth_date: '1990-01-01',
        gender: 'female',
        identifiers: [{ use: 'official', system: 'urn:ssin', value: '90010100156' }],
      }),
    ),
  )
}

function serveUser(): void {
  server.use(
    http.get(`${baseUrl}/users/${USER_ID}`, () =>
      HttpResponse.json({
        id: USER_ID,
        email: 'lee@zas.local',
        display_name: 'Dr. Lee',
        role_id: ROLE_ID,
        is_active: true,
        external_idp: null,
        external_subject: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      }),
    ),
    http.get(`${baseUrl}/roles`, () =>
      HttpResponse.json([
        { id: ROLE_ID, slug: 'nurse', name: 'Verpleegkundige', is_system: false, permissions: [] },
      ]),
    ),
  )
}

function renderCard(person: PersonRef, name: string): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }): ReactElement => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <PersonHoverCard person={person} name={name} />
      </Wrap>
    ),
  })
  // Register the patient route so the card's <Link> can resolve its target.
  const patientRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/patients/$patientId',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([patientRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}

describe('PersonHoverCard', () => {
  it('shows patient demographics and a link to the patient', async () => {
    servePatient()
    renderCard({ kind: 'patient', id: PATIENT_ID }, 'loading…')
    // Loaded name (distinct from the fallback) proves the fetch resolved.
    expect(await screen.findByText('Janssen, Marie')).toBeInTheDocument()
    // INSZ from the official identifier.
    expect(await screen.findByText('90010100156')).toBeInTheDocument()
    // Open-patient link.
    expect(screen.getByRole('link')).toHaveAttribute('href', `/patients/${PATIENT_ID}`)
  })

  it('shows the caregiver name, role and email', async () => {
    serveUser()
    renderCard({ kind: 'user', id: USER_ID }, 'loading…')
    expect(await screen.findByText('lee@zas.local')).toBeInTheDocument()
    expect(await screen.findByText('Dr. Lee')).toBeInTheDocument()
    expect(await screen.findByText('Verpleegkundige')).toBeInTheDocument()
  })
})
