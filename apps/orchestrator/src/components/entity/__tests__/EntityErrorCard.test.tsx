import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { EntityErrorCard } from '../EntityErrorCard'

describe('EntityErrorCard', () => {
  it('fires onRetry on click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <EntityErrorCard onRetry={onRetry} />
      </I18nextProvider>,
    )
    await user.click(screen.getByRole('button', { name: /opnieuw proberen/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
