import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LusciiPatientData } from '@/modules/patient/types'
import { renderWithProviders } from '@/test/renderWithProviders'

import { MeasurementCharts } from '../MeasurementCharts'

const { useLusciiDataMock, refetchMock } = vi.hoisted(() => ({
  useLusciiDataMock: vi.fn(),
  refetchMock: vi.fn(),
}))

vi.mock('@/modules/patient/hooks', () => ({
  useLusciiData: useLusciiDataMock,
  useLinkLuscii: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUnlinkLuscii: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

function renderPanel(): void {
  renderWithProviders(<MeasurementCharts patientId="pat-1" />)
}

function stub<T>(data: T) {
  return { data, isLoading: false, error: null, isError: false, refetch: refetchMock }
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

const LOADED: LusciiPatientData = {
  ...EMPTY_LINKED,
  series: [
    {
      series_id: 'abc123def456',
      instrument_id: 'inst-w',
      instrument_name: 'Gewicht',
      item_id: 'item-w',
      label: 'Gewicht',
      archetype: 'numeric',
      unit: 'kg',
      points: [
        {
          observed_at: '2026-06-10T08:00:00Z',
          archetype: 'numeric',
          value: 80,
          program_id: 'prog-1',
        },
        {
          observed_at: '2026-06-13T08:00:00Z',
          archetype: 'numeric',
          value: 81,
          program_id: 'prog-1',
        },
      ],
    },
  ],
}

describe('MeasurementCharts', () => {
  beforeEach(() => {
    useLusciiDataMock.mockReset()
    refetchMock.mockReset()
  })

  it('renders skeletons while the query is loading', () => {
    useLusciiDataMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
      refetch: refetchMock,
    })
    renderPanel()
    // No loaded-state copy until data lands.
    expect(screen.queryByText(/geen metingen/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /tonen/i })).toBeNull()
  })

  it('renders the empty-state with the widen CTA when a linked patient has no series in the window', async () => {
    useLusciiDataMock.mockReturnValue(stub(EMPTY_LINKED))
    renderPanel()
    expect(await screen.findByText(/geen metingen in deze periode/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bekijk 90 dagen/i })).toBeInTheDocument()
  })

  it('renders a metric tile per instrument with the latest value', async () => {
    useLusciiDataMock.mockReturnValue(stub(LOADED))
    renderPanel()
    expect(await screen.findByText('Gewicht')).toBeInTheDocument()
    expect(screen.getByText(/81 kg/i)).toBeInTheDocument()
  })

  it('opens the detail dialog when a tile is clicked', async () => {
    useLusciiDataMock.mockReturnValue(stub(LOADED))
    renderPanel()
    await userEvent.setup().click(await screen.findByRole('button', { name: /gewicht/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('keeps the chrome and offers a retry on a panel-scoped error (D-STATES)', async () => {
    useLusciiDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      isError: true,
      refetch: refetchMock,
    })
    renderPanel()
    // WindowSelector stays visible — error must NOT wipe the chrome.
    expect(await screen.findByRole('button', { name: '30 dagen' })).toBeInTheDocument()
    expect(screen.getByText(/luscii-gegevens konden niet/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /opnieuw proberen/i }))
    expect(refetchMock).toHaveBeenCalledTimes(1)
  })

  it('window selector calls the hook with the picked days value', async () => {
    useLusciiDataMock.mockReturnValue(stub(EMPTY_LINKED))
    renderPanel()
    const ninetyDays = await screen.findByRole('button', { name: '90 dagen' })
    await userEvent.setup().click(ninetyDays)
    const last = useLusciiDataMock.mock.calls.at(-1)
    expect(last?.[1]).toEqual({ days: 90 })
  })

  it('shows the programme name when present and the fallback when null', async () => {
    useLusciiDataMock.mockReturnValue(stub({ ...EMPTY_LINKED, program: null }))
    renderPanel()
    expect(await screen.findByText(/geen programma/i)).toBeInTheDocument()
  })

  it('renders the planned-actions disclosure trigger with the count', async () => {
    const data: LusciiPatientData = {
      ...EMPTY_LINKED,
      planned_actions: [
        {
          id: 'pa-1',
          not_before: null,
          expires_at: null,
          completed_at: null,
          created_at: null,
          self_planned: null,
          measurement: null,
        },
        {
          id: 'pa-2',
          not_before: null,
          expires_at: null,
          completed_at: null,
          created_at: null,
          self_planned: null,
          measurement: null,
        },
      ],
      unmatched_measurements: [
        {
          measurement_id: 'm-1',
          instrument_id: null,
          instrument_name: null,
          created_at: null,
          processed_at: null,
          values: [],
        },
      ],
    }
    useLusciiDataMock.mockReturnValue(stub(data))
    renderPanel()
    expect(
      await screen.findByRole('button', { name: /geplande acties \(3\) tonen/i }),
    ).toBeInTheDocument()
  })
})
