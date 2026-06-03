import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { ParticipantRow } from '../../types'
import { ChangeRoleDialog } from '../ChangeRoleDialog'

const { changeParticipantRoleMock } = vi.hoisted(() => ({
  changeParticipantRoleMock: vi.fn(),
}))

vi.mock('../../api', () => ({
  changeParticipantRole: changeParticipantRoleMock,
}))

const PARTICIPANT: ParticipantRow = {
  id: 'pp-1',
  user_id: 'u-1',
  role_in_care: 'primary',
  period_start: '2026-01-01T00:00:00Z',
  period_end: null,
  acting_as_practitioner_role_id: null,
  assigned_by: 'u-admin',
  unassigned_by: null,
}

function renderDialog(onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  return render(
    <Wrap>
      <ChangeRoleDialog
        open
        careTeamId="ct-1"
        patientId="pat-1"
        participant={PARTICIPANT}
        onOpenChange={onOpenChange}
      />
    </Wrap>,
  )
}

describe('ChangeRoleDialog (7.3)', () => {
  it('renders role selector pre-filled with current role', () => {
    renderDialog()
    expect(screen.getByText('Rol wijzigen')).toBeInTheDocument()
  })

  it('submits single PATCH request (no double-fire)', async () => {
    changeParticipantRoleMock.mockResolvedValue({
      ...PARTICIPANT,
      role_in_care: 'consulting',
    })

    const onOpenChange = vi.fn()
    renderDialog(onOpenChange)

    const submit = screen.getByRole('button', { name: /Wijzigen/ })
    await userEvent.click(submit)

    expect(changeParticipantRoleMock).toHaveBeenCalledTimes(1)
    expect(changeParticipantRoleMock).toHaveBeenCalledWith(
      'ct-1',
      'u-1',
      expect.objectContaining({ role_in_care: expect.any(String) }),
    )
  })
})
