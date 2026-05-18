import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { EditPatientDialog } from '../EditPatientDialog'

const { useUpdatePatientMock, mutateAsync } = vi.hoisted(() => ({
  useUpdatePatientMock: vi.fn(),
  mutateAsync: vi.fn(),
}))

vi.mock('../../hooks', () => ({
  useUpdatePatient: useUpdatePatientMock,
}))

const PATIENT = {
  id: 'pat-1',
  primary_organisation_id: 'org-1',
  given_name: 'Eva',
  family_name: 'Bos',
  birth_date: '1980-05-12',
  gender: 'female' as const,
  source: 'local' as const,
  external_system: null,
  external_ref: null,
  external_version: null,
  last_synced_at: null,
  identifiers: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-02-02T11:00:00Z',
  deleted_at: null,
  created_by: 'u-admin',
  updated_by: 'u-admin',
  deleted_by: null,
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
      <EditPatientDialog patient={PATIENT} open onOpenChange={onOpenChange} />
    </Wrap>,
  )
  return { onOpenChange }
}

describe('EditPatientDialog', () => {
  beforeEach(() => {
    useUpdatePatientMock.mockReset()
    mutateAsync.mockReset()
    useUpdatePatientMock.mockReturnValue({ mutateAsync, isPending: false })
  })

  it('submits PATCH payload and closes on success', async () => {
    mutateAsync.mockResolvedValue(PATIENT)
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()

    const givenName = await screen.findByLabelText('Voornaam')
    await user.clear(givenName)
    await user.type(givenName, 'Evita')

    await user.click(screen.getByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync).toHaveBeenCalledWith({
      patientId: 'pat-1',
      payload: {
        given_name: 'Evita',
        family_name: 'Bos',
        birth_date: '1980-05-12',
        gender: 'female',
      },
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('keeps dialog open when mutation fails', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()

    await user.click(await screen.findByRole('button', { name: 'Opslaan' }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
