import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { CreatePatientDialog } from '../CreatePatientDialog'

const { useCreatePatientMock, mutateAsync, useCanMock, useOrganisationsMock, useMyOrganisationsMock } =
  vi.hoisted(() => ({
    useCreatePatientMock: vi.fn(),
    mutateAsync: vi.fn(),
    useCanMock: vi.fn(),
    useOrganisationsMock: vi.fn(),
    useMyOrganisationsMock: vi.fn(),
  }))

vi.mock('../../hooks', () => ({ useCreatePatient: useCreatePatientMock }))
vi.mock('@/modules/auth/permissions', () => ({ useCan: useCanMock }))
vi.mock('@/modules/organisation/hooks', () => ({
  useOrganisations: useOrganisationsMock,
  useMyOrganisations: useMyOrganisationsMock,
}))

const ORG_A = { id: 'org-a', name: 'Org A' }
const ORG_B = { id: 'org-b', name: 'Org B' }

type Setup = { crossOrg?: boolean; own?: unknown[]; all?: unknown[]; loading?: boolean }

function configure({ crossOrg = false, own = [], all = [], loading = false }: Setup): void {
  useCanMock.mockImplementation((cap: string) =>
    cap === 'patient.createCrossOrg' ? crossOrg : false,
  )
  useOrganisationsMock.mockReturnValue({ data: all, isLoading: crossOrg && loading })
  useMyOrganisationsMock.mockReturnValue({ data: own, isLoading: !crossOrg && loading })
}

function renderDialog(): { onOpenChange: ReturnType<typeof vi.fn> } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const onOpenChange = vi.fn()
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  render(
    <Wrap>
      <CreatePatientDialog open onOpenChange={onOpenChange} />
    </Wrap>,
  )
  return { onOpenChange }
}

describe('CreatePatientDialog', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
    useCreatePatientMock.mockReset()
    useCreatePatientMock.mockReturnValue({ mutateAsync, isPending: false })
  })

  it('shows a tenant-wide org selector for cross-org holders', () => {
    configure({ crossOrg: true, all: [ORG_A, ORG_B] })
    renderDialog()
    expect(screen.getByText('Organisatie')).toBeInTheDocument()
  })

  it('shows an own-org selector when the caller has more than one own org', () => {
    configure({ crossOrg: false, own: [ORG_A, ORG_B] })
    renderDialog()
    expect(screen.getByText('Organisatie')).toBeInTheDocument()
  })

  it('hides the org selector for a single-own-org caller', () => {
    configure({ crossOrg: false, own: [ORG_A] })
    renderDialog()
    expect(screen.queryByText('Organisatie')).not.toBeInTheDocument()
  })

  it('submits without an org for a single-own-org caller and closes on success', async () => {
    configure({ crossOrg: false, own: [ORG_A] })
    mutateAsync.mockResolvedValue({ id: 'new-pat' })
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()

    await user.type(screen.getByLabelText('Voornaam'), 'Nieuw')
    await user.type(screen.getByLabelText('Achternaam'), 'Patient')
    await user.click(screen.getByRole('button', { name: 'Aanmaken' }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync).toHaveBeenCalledWith({
      given_name: 'Nieuw',
      family_name: 'Patient',
      birth_date: null,
      gender: 'unknown',
      source: 'local',
      identifiers: [],
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('does not submit when required name fields are empty', async () => {
    configure({ crossOrg: false, own: [ORG_A] })
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Aanmaken' }))

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
