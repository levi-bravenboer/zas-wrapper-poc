import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { OrganisationRead } from '../../schemas'
import { CreateOrganisationDialog } from '../CreateOrganisationDialog'

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))

vi.mock('../../api', () => ({
  createOrganisation: createMock,
  fetchOrganisations: vi.fn(),
  updateOrganisation: vi.fn(),
  deleteOrganisation: vi.fn(),
  fetchAffiliatedPractitionerRoles: vi.fn(),
}))

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
}

const parent: OrganisationRead = {
  id: '00000000-0000-0000-0000-000000000001',
  parent_organisation_id: null,
  name: 'Root Org',
  type_code: 'prov',
  type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
  type_display: 'Healthcare Provider',
  sort_index: 0,
}

describe('CreateOrganisationDialog', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('uses root title when no parent', () => {
    render(
      <Wrap>
        <CreateOrganisationDialog open parent={null} onOpenChange={() => {}} />
      </Wrap>,
    )
    expect(screen.getByText(/nieuwe hoofdorganisatie/i)).toBeTruthy()
  })

  it('uses child title and submits with parent_organisation_id', async () => {
    const created: OrganisationRead = { ...parent, id: 'new-id', name: 'New Sub' }
    createMock.mockResolvedValue(created)
    const onCreated = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <Wrap>
        <CreateOrganisationDialog
          open
          parent={parent}
          onCreated={onCreated}
          onOpenChange={onOpenChange}
        />
      </Wrap>,
    )
    expect(screen.getByText(/nieuwe sub-organisatie/i)).toBeTruthy()

    await userEvent.type(screen.getByLabelText(/naam/i), 'New Sub')
    await userEvent.click(screen.getByRole('button', { name: /aanmaken/i }))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    const firstCall = createMock.mock.calls[0]
    if (!firstCall) throw new Error('expected createMock to be called')
    const payload = firstCall[0]
    expect(payload.name).toBe('New Sub')
    expect(payload.parent_organisation_id).toBe(parent.id)
    expect(payload.type.code).toBe('prov')
    expect(payload.type.system).toBe('http://terminology.hl7.org/CodeSystem/organization-type')
  })
})
