import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { CareTeamSlot } from '../CareTeamSlot'

const { usePatientCareTeamsMock } = vi.hoisted(() => ({
  usePatientCareTeamsMock: vi.fn(),
}))

vi.mock('@/modules/patient/hooks', () => ({
  usePatientCareTeams: usePatientCareTeamsMock,
}))

vi.mock('@/hooks/use-paginated-query', () => ({
  usePaginatedQuery: () => ({ data: { items: [] }, isLoading: false }),
}))

vi.mock('@/modules/organisation/hooks', () => ({
  useOrganisations: () => ({ data: [] }),
}))

const TEAM = {
  id: 'ct-1',
  patient_id: 'pat-1',
  name: 'Thuiszorg-team',
  status: 'active' as const,
  period_start: '2026-01-01T00:00:00Z',
  period_end: null,
  category: null,
  participants: [
    {
      id: 'pp-1',
      user_id: 'u-1',
      role_in_care: 'primary' as const,
      period_start: '2026-01-01T00:00:00Z',
      period_end: null,
      acting_as_practitioner_role_id: null,
      assigned_by: 'u-admin',
      unassigned_by: null,
    },
  ],
}

function renderSlot(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  render(
    <Wrap>
      <CareTeamSlot patientId="pat-1" />
    </Wrap>,
  )
}

describe('CareTeamSlot', () => {
  beforeEach(() => {
    usePatientCareTeamsMock.mockReset()
  })

  it('renders team name and participant role badge', () => {
    usePatientCareTeamsMock.mockReturnValue({
      data: [TEAM],
      isLoading: false,
      error: null,
    })
    renderSlot()
    expect(screen.getByText('Thuiszorg-team')).toBeTruthy()
    expect(screen.getByText('Primair')).toBeTruthy()
  })

  it('shows empty state when no teams', () => {
    usePatientCareTeamsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })
    renderSlot()
    expect(screen.getByText(/Nog geen zorgteam/)).toBeTruthy()
  })
})
