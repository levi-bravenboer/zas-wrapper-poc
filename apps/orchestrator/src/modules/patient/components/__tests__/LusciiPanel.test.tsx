import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import { apiError } from '@/lib/api/errors'
import type { LusciiPatientData } from '@/modules/patient/types'

import { LusciiPanel } from '../LusciiPanel'

const { useLusciiDataMock, useLinkLusciiMock, useUnlinkLusciiMock } = vi.hoisted(() => ({
  useLusciiDataMock: vi.fn(),
  useLinkLusciiMock: vi.fn(),
  useUnlinkLusciiMock: vi.fn(),
}))

vi.mock('@/modules/patient/hooks', () => ({
  useLusciiData: useLusciiDataMock,
  useLinkLuscii: useLinkLusciiMock,
  useUnlinkLuscii: useUnlinkLusciiMock,
}))

const LINKED_DATA: LusciiPatientData = {
  state: 'linked',
  luscii_patient_id: '7659dfb3-c089-4d12-95b7-46ff8ce1e7dd',
  window_days: 30,
  program: { id: 'p-1', name: 'Hartfalen programma', start_date: null },
  protocol: { id: 'pr-1', name: 'Intake protocol' },
  planned_actions: [
    {
      id: 'pa-1',
      not_before: '2026-06-01T08:00:00Z',
      expires_at: '2026-06-02T08:00:00Z',
      completed_at: '2026-06-01T09:05:00Z',
      created_at: '2026-05-30T12:00:00Z',
      self_planned: false,
      measurement: {
        measurement_id: 'm-1',
        instrument_name: 'Gewicht meting',
        created_at: '2026-06-01T09:00:00Z',
        processed_at: null,
        values: [
          {
            label: 'Gewicht',
            value: '82',
            unit: 'kg',
            response_texts: [],
            archetype: 'numeric',
          },
          {
            label: 'Voelt u zich goed?',
            value: null,
            unit: null,
            response_texts: ['Ja'],
            archetype: 'categorical',
          },
        ],
      },
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
      measurement_id: 'm-2',
      instrument_name: null,
      created_at: '2026-06-03T10:00:00Z',
      processed_at: null,
      values: [
        {
          label: null,
          value: 'raw-only',
          unit: null,
          response_texts: [],
          archetype: 'free_text',
        },
      ],
    },
  ],
}

function renderPanel(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  render(
    <Wrap>
      <LusciiPanel patientId="pat-1" />
    </Wrap>,
  )
}

function mockIdleMutations(): { mutate: ReturnType<typeof vi.fn> } {
  const link = { mutate: vi.fn(), isPending: false, error: null }
  useLinkLusciiMock.mockReturnValue(link)
  useUnlinkLusciiMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
  return link
}

describe('LusciiPanel', () => {
  beforeEach(() => {
    useLusciiDataMock.mockReset()
    useLinkLusciiMock.mockReset()
    useUnlinkLusciiMock.mockReset()
  })

  it('renders quiet info state when not configured', () => {
    mockIdleMutations()
    useLusciiDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: apiError('not configured', 503, 'unavailable.luscii.not_configured'),
      refetch: vi.fn(),
    })
    renderPanel()
    expect(screen.getByText(/niet geconfigureerd/)).toBeTruthy()
    // No retry button, no input — quiet state.
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('renders error state with retry for upstream failure', () => {
    mockIdleMutations()
    const refetch = vi.fn()
    useLusciiDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: apiError('upstream', 502, 'unavailable.luscii.upstream'),
      refetch,
    })
    renderPanel()
    expect(screen.getByText(/konden niet worden geladen/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('renders link form for unlinked patient and submits UUID', () => {
    const link = mockIdleMutations()
    useLusciiDataMock.mockReturnValue({
      data: {
        state: 'not_linked',
        window_days: 30,
        planned_actions: [],
        unmatched_measurements: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPanel()
    const input = screen.getByRole('textbox', { name: 'Luscii patiënt-ID' })
    fireEvent.change(input, { target: { value: ' 7659dfb3-c089-4d12-95b7-46ff8ce1e7dd ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Koppelen' }))
    expect(link.mutate).toHaveBeenCalledWith({
      patientId: 'pat-1',
      lusciiPatientId: '7659dfb3-c089-4d12-95b7-46ff8ce1e7dd',
    })
  })

  it.each([
    ['invalid.luscii.patient_not_found', 422, /niet gevonden of niet toegankelijk/],
    ['conflict.luscii.already_linked', 409, /al gekoppeld aan een andere/],
    ['unavailable.luscii.upstream', 502, /niet bereikbaar/],
  ])('shows inline error for %s', (code, status, expected) => {
    useLinkLusciiMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: apiError('link failed', status as number, code as string),
    })
    useUnlinkLusciiMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
    useLusciiDataMock.mockReturnValue({
      data: {
        state: 'not_linked',
        window_days: 30,
        planned_actions: [],
        unmatched_measurements: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPanel()
    expect(screen.getByRole('alert').textContent).toMatch(expected)
  })

  it('renders programme header, merged timeline, and decoded values', () => {
    mockIdleMutations()
    useLusciiDataMock.mockReturnValue({
      data: LINKED_DATA,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPanel()
    expect(screen.getByText('Hartfalen programma')).toBeTruthy()
    expect(screen.getByText('Intake protocol')).toBeTruthy()
    expect(screen.getByText('Voltooid')).toBeTruthy()
    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.getByText('Gewicht meting')).toBeTruthy()
    expect(screen.getByText('Gewicht:')).toBeTruthy()
    expect(screen.getByText('82')).toBeTruthy()
    expect(screen.getByText('kg')).toBeTruthy()
    expect(screen.getByText('Ja')).toBeTruthy()
    // Unmatched measurement renders raw value without label.
    expect(screen.getByText('raw-only')).toBeTruthy()
    expect(screen.getByText('Onbekend instrument')).toBeTruthy()
  })

  it('unlink calls the mutation', () => {
    const unlinkMutate = vi.fn()
    useLinkLusciiMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
    useUnlinkLusciiMock.mockReturnValue({ mutate: unlinkMutate, isPending: false, error: null })
    useLusciiDataMock.mockReturnValue({
      data: LINKED_DATA,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Ontkoppelen' }))
    expect(unlinkMutate).toHaveBeenCalledWith('pat-1')
  })
})
