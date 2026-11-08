import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import { beginLaunch } from '@/modules/smart-launch/api'

import { LaunchPage } from './launch'

vi.mock('@/modules/smart-launch/api', async (orig) => {
  const actual = (await orig()) as typeof import('@/modules/smart-launch/api')
  return { ...actual, beginLaunch: vi.fn() }
})

const SEARCH = { iss: 'https://fhir.example.org', launch: 'launch-1', surface: 'smart' } as const

describe('LaunchPage', () => {
  it('shows the translated failure and logs the cause when the launch fails', async () => {
    const cause = new Error('VITE_SMART_CLIENT_ID is not configured')
    vi.mocked(beginLaunch).mockRejectedValue(cause)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <I18nextProvider i18n={i18n}>
        <LaunchPage search={SEARCH} />
      </I18nextProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('SMART-launch mislukt')
    expect(alert).not.toHaveTextContent('VITE_SMART_CLIENT_ID')
    expect(consoleError).toHaveBeenCalledWith('SMART launch failed:', cause)
    consoleError.mockRestore()
  })
})
