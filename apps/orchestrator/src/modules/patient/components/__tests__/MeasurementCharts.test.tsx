import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import type { LusciiPatientData } from '@/modules/patient/types'

import { MeasurementCharts } from '../MeasurementCharts'

const { useLusciiDataMock } = vi.hoisted(() => ({
  useLusciiDataMock: vi.fn(),
}))

vi.mock('@/modules/patient/hooks', () => ({
  useLusciiData: useLusciiDataMock,
  useLinkLuscii: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUnlinkLuscii: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

function renderWithI18n(): void {
  render(
    <I18nextProvider i18n={i18n}>
      <MeasurementCharts patientId="pat-1" />
    </I18nextProvider>,
  )
}

function stub<T>(data: T) {
  return { data, isLoading: false, error: null, isError: false, refetch: vi.fn() }
}

const EMPTY_LINKED: LusciiPatientData = {
  state: 'linked',
  luscii_patient_id: '00000000-0000-4000-8000-000000000001',
  window_days: 30,
  program: { id: 'prog-1', name: 'Hartfalen' },
  protocol: null,
  planned_actions: [],
  unmatched_measurements: [],
  series: [],
}

describe('MeasurementCharts', () => {
  beforeEach(() => {
    useLusciiDataMock.mockReset()
  })

  it('renders skeletons while the query is loading', () => {
    useLusciiDataMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
      refetch: vi.fn(),
    })
    renderWithI18n()
    // Skeleton primitive carries `data-slot="skeleton"`; assert the panel
    // does NOT render any of the loaded-state copy.
    expect(screen.queryByText(/geen metingen/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /tonen/i })).toBeNull()
  })

  it('renders the empty-state with the widen CTA when a linked patient has no series in the window', () => {
    useLusciiDataMock.mockReturnValue(stub(EMPTY_LINKED))
    renderWithI18n()
    expect(screen.getByText(/geen metingen in deze periode/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bekijk 90 dagen/i })).toBeInTheDocument()
  })

  it('window selector calls the hook with the picked days value', async () => {
    useLusciiDataMock.mockReturnValue(stub(EMPTY_LINKED))
    renderWithI18n()
    await userEvent.setup().click(screen.getByRole('button', { name: '90 dagen' }))
    // Last call must reflect the new days option.
    const last = useLusciiDataMock.mock.calls.at(-1)
    expect(last?.[1]).toEqual({ days: 90 })
  })

  it('shows the programme name when present and the fallback when null', () => {
    useLusciiDataMock.mockReturnValue(stub({ ...EMPTY_LINKED, program: null }))
    renderWithI18n()
    expect(screen.getByText(/geen programma/i)).toBeInTheDocument()
  })

  it('renders the planned-actions disclosure trigger with the count', () => {
    const data: LusciiPatientData = {
      ...EMPTY_LINKED,
      // The disclosure trigger reads `.length`; pass minimal but typed stubs.
      planned_actions: [
        { id: 'pa-1', not_before: null, expires_at: null, completed_at: null, created_at: null, self_planned: null, measurement: null },
        { id: 'pa-2', not_before: null, expires_at: null, completed_at: null, created_at: null, self_planned: null, measurement: null },
      ],
      unmatched_measurements: [
        { measurement_id: 'm-1', instrument_id: null, instrument_name: null, created_at: null, processed_at: null, values: [] },
      ],
    }
    useLusciiDataMock.mockReturnValue(stub(data))
    renderWithI18n()
    expect(screen.getByRole('button', { name: /geplande acties \(3\) tonen/i })).toBeInTheDocument()
  })
})
