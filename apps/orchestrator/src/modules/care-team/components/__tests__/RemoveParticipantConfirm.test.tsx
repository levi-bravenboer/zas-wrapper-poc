import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { RemoveParticipantConfirm } from '../RemoveParticipantConfirm'

const { unassignParticipantMock } = vi.hoisted(() => ({
  unassignParticipantMock: vi.fn(),
}))

vi.mock('../../api', () => ({
  unassignParticipant: unassignParticipantMock,
}))

function renderConfirm(onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  return render(
    <Wrap>
      <RemoveParticipantConfirm
        open
        careTeamId="ct-1"
        patientId="pat-1"
        userId="u-1"
        displayName="Dr. Janssen"
        onOpenChange={onOpenChange}
      />
    </Wrap>,
  )
}

describe('RemoveParticipantConfirm (7.4)', () => {
  it('renders destructive confirm with participant name', () => {
    renderConfirm()
    expect(screen.getByText(/Deelnemer verwijderen/)).toBeInTheDocument()
    expect(screen.getByText(/Dr. Janssen/)).toBeInTheDocument()
  })

  it('calls unassign API on confirm and closes', async () => {
    unassignParticipantMock.mockResolvedValue(undefined)
    const onOpenChange = vi.fn()
    renderConfirm(onOpenChange)

    const confirm = screen.getByRole('button', { name: /Verwijderen/ })
    await userEvent.click(confirm)

    expect(unassignParticipantMock).toHaveBeenCalledTimes(1)
    expect(unassignParticipantMock).toHaveBeenCalledWith('ct-1', 'u-1')
  })
})
