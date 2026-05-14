import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { RootErrorBoundary } from './errorBoundary'

function wrap(children: ReactElement): ReactElement {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

function Boom(): null {
  throw new Error('kaboom')
}

function Recoverable({ shouldFail }: { shouldFail: boolean }): string {
  if (shouldFail) throw new Error('kaboom')
  return 'ok'
}

describe('RootErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error', () => {
    render(
      wrap(
        <RootErrorBoundary>
          <p>healthy</p>
        </RootErrorBoundary>,
      ),
    )
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('renders the fallback when a child throws', () => {
    render(
      wrap(
        <RootErrorBoundary>
          <Boom />
        </RootErrorBoundary>,
      ),
    )
    expect(screen.getByRole('button', { name: 'Opnieuw proberen' })).toBeInTheDocument()
    expect(screen.getByText('Er ging iets mis')).toBeInTheDocument()
  })

  it('clears the error and re-renders children when retry is pressed', async () => {
    const user = userEvent.setup()
    let shouldFail = true
    const { rerender } = render(
      wrap(
        <RootErrorBoundary>
          <Recoverable shouldFail={shouldFail} />
        </RootErrorBoundary>,
      ),
    )
    expect(screen.getByRole('button', { name: 'Opnieuw proberen' })).toBeInTheDocument()

    shouldFail = false
    rerender(
      wrap(
        <RootErrorBoundary>
          <Recoverable shouldFail={shouldFail} />
        </RootErrorBoundary>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Opnieuw proberen' }))

    expect(screen.getByText('ok')).toBeInTheDocument()
  })
})
