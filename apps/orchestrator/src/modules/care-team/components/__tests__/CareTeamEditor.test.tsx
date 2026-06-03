import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import { patientKeys } from '@/modules/patient/keys'

import type { CareTeamRow } from '../../types'
import { CareTeamEditor } from '../CareTeamEditor'

vi.mock('@/hooks/use-paginated-query', () => ({
  usePaginatedQuery: () => ({ data: { items: [] }, isLoading: false }),
}))

vi.mock('@/modules/organisation/hooks', () => ({
  useOrganisations: () => ({ data: [] }),
}))

function makeTeam(overrides: Partial<CareTeamRow> = {}): CareTeamRow {
  return {
    id: 'ct-1',
    patient_id: 'pat-1',
    name: 'Hartfalen team',
    status: 'active',
    period_start: '2026-01-01T00:00:00Z',
    period_end: null,
    category: 'Multidisciplinair',
    participants: [
      {
        id: 'pp-1',
        user_id: 'u-1',
        role_in_care: 'primary',
        period_start: '2026-01-01T00:00:00Z',
        period_end: null,
        acting_as_practitioner_role_id: null,
        assigned_by: 'u-admin',
        unassigned_by: null,
      },
    ],
    ...overrides,
  } as CareTeamRow
}

function renderEditor(teams: CareTeamRow[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  qc.setQueryData(patientKeys.careTeams('pat-1'), teams)

  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  return render(
    <Wrap>
      <CareTeamEditor patientId="pat-1" />
    </Wrap>,
  )
}

describe('CareTeamEditor (7.1)', () => {
  it('renders active teams and their participant rows', () => {
    renderEditor([makeTeam()])
    expect(screen.getByText('Hartfalen team')).toBeInTheDocument()
    expect(screen.getByText('Primair')).toBeInTheDocument()
  })

  it('renders empty state with CTA when no teams', () => {
    renderEditor([])
    expect(screen.getByText(/Nog geen zorgteam/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nieuw zorgteam/ })).toBeInTheDocument()
  })

  it('renders collapsed Geschiedenis accordion for closed teams', async () => {
    const closed = makeTeam({
      id: 'ct-2',
      name: 'Oud team',
      status: 'inactive',
      period_end: '2026-03-01T00:00:00Z',
    })
    renderEditor([makeTeam(), closed])

    // Closed team section hidden by default
    expect(screen.queryByText('Oud team')).not.toBeInTheDocument()

    // Click Geschiedenis toggle
    const toggle = screen.getByRole('button', { name: /Geschiedenis/ })
    expect(toggle).toBeInTheDocument()
    await userEvent.click(toggle)

    // Now closed team visible
    expect(screen.getByText('Oud team')).toBeInTheDocument()
  })
})
