import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { OrganisationRead } from '../../schemas'
import { OrganisationDetailSheet } from '../OrganisationDetailSheet'

const { fetchRolesMock } = vi.hoisted(() => ({ fetchRolesMock: vi.fn() }))

vi.mock('../../api', () => ({
  createOrganisation: vi.fn(),
  fetchOrganisations: vi.fn(),
  updateOrganisation: vi.fn(),
  deleteOrganisation: vi.fn(),
  fetchAffiliatedPractitionerRoles: fetchRolesMock,
}))

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
}

const org: OrganisationRead = {
  id: '00000000-0000-0000-0000-000000000001',
  parent_organisation_id: null,
  name: 'Root Org',
  type_code: 'prov',
  type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
  type_display: 'Healthcare Provider',
}

describe('OrganisationDetailSheet', () => {
  beforeEach(() => {
    fetchRolesMock.mockReset()
  })

  it('renders demographics and empty affiliated state', async () => {
    fetchRolesMock.mockResolvedValue([])
    render(
      <Wrap>
        <OrganisationDetailSheet open organisation={org} parent={null} onOpenChange={() => {}} />
      </Wrap>,
    )
    expect(screen.getByText('Root Org')).toBeTruthy()
    expect(screen.getByText('Healthcare Provider')).toBeTruthy()
    expect(await screen.findByText(/nog geen aangesloten zorgverleners/i)).toBeTruthy()
  })

  it('lists affiliated practitioner roles', async () => {
    fetchRolesMock.mockResolvedValue([
      {
        id: 'r1',
        practitioner_id: 'p1',
        organisation_id: org.id,
        code: 'gp',
        specialty: null,
        is_primary: true,
        period_start: '2026-01-01T00:00:00Z',
      },
    ])
    render(
      <Wrap>
        <OrganisationDetailSheet open organisation={org} parent={null} onOpenChange={() => {}} />
      </Wrap>,
    )
    expect(await screen.findByText('gp')).toBeTruthy()
    expect(screen.getByText('p1')).toBeTruthy()
  })
})
