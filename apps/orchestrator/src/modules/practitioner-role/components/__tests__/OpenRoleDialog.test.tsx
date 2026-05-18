/* eslint-disable i18next/no-literal-string -- inline test fixtures, not user copy. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { PRACTITIONER_ROLES_LIST_PATH } from '../../keys'
import type { PractitionerRoleRead } from '../../schemas'
import { OpenRoleDialog } from '../OpenRoleDialog'

const { openMock } = vi.hoisted(() => ({ openMock: vi.fn() }))

vi.mock('../../api', () => ({
  openPractitionerRole: openMock,
  updatePractitionerRole: vi.fn(),
  closePractitionerRole: vi.fn(),
}))

const ORG_ID = '4f3c5d1e-9b7a-4c2f-8e6d-1a2b3c4d5e6f'
const PRACT_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

vi.mock('@/components/pickers', () => ({
  PractitionerPicker: ({ onChange }: { onChange: (id: string | null) => void }) => (
    <button type="button" onClick={() => onChange('7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d')}>
      pick-practitioner
    </button>
  ),
  OrganisationPicker: ({ onChange }: { onChange: (id: string | null) => void }) => (
    <button type="button" onClick={() => onChange('4f3c5d1e-9b7a-4c2f-8e6d-1a2b3c4d5e6f')}>
      pick-organisation
    </button>
  ),
}))

const created: PractitionerRoleRead = {
  id: 'r-new',
  practitioner_id: PRACT_ID,
  organisation_id: ORG_ID,
  code: 'gp',
  specialty: null,
  is_primary: true,
  period_start: '2026-05-17T00:00:00Z',
  period_end: null,
  practitioner: null,
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  return { qc, invalidateSpy, Wrap }
}

describe('OpenRoleDialog', () => {
  beforeEach(() => {
    openMock.mockReset()
  })

  it('submits is_primary=true and invalidates the paginated list cache on success', async () => {
    openMock.mockResolvedValue(created)
    const { Wrap, invalidateSpy } = setup()
    const onOpenChange = vi.fn()

    render(
      <Wrap>
        <OpenRoleDialog open onOpenChange={onOpenChange} />
      </Wrap>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'pick-practitioner' }))
    await userEvent.click(screen.getByRole('button', { name: 'pick-organisation' }))
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /toevoegen/i }))

    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1))
    const payload = openMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload['practitioner_id']).toBe(PRACT_ID)
    expect(payload['organisation_id']).toBe(ORG_ID)
    expect(payload['is_primary']).toBe(true)
    expect(payload['code']).toBe('gp')

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['paginated', PRACTITIONER_ROLES_LIST_PATH],
      })
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
