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

vi.mock('../../hooks', () => ({
  usePatientCareTeams: usePatientCareTeamsMock,
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
      care_team_id: 'ct-1',
      practitioner_role_id: 'pr-1',
      role_code: 'doctor',
      period_start: '2026-01-01T00:00:00Z',
      period_end: null,
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

  it('renders placeholder copy + current team list', () => {
    usePatientCareTeamsMock.mockReturnValue({
      data: [TEAM],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    renderSlot()
    expect(screen.getByText(/Komt binnenkort/)).toBeTruthy()
    expect(screen.getByText('Thuiszorg-team')).toBeTruthy()
    expect(screen.getByText(/1 deelnemer/)).toBeTruthy()
  })

  it('shows empty state when no teams', () => {
    usePatientCareTeamsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    renderSlot()
    expect(screen.getByText(/Nog geen zorgteam/)).toBeTruthy()
  })
})
