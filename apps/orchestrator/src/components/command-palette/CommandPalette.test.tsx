import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, type Mock } from 'vitest'

import { i18n } from '@/lib/i18n'

import { CommandPalette } from './CommandPalette'
import { CommandPaletteProvider } from './CommandPaletteProvider'
import { useRegisterCommands } from './context'
import type { CommandEntry } from './types'

type HarnessProps = {
  entries: readonly CommandEntry[]
}

function Harness({ entries }: HarnessProps) {
  useRegisterCommands('test', entries)
  return null
}

function mount(entries: readonly CommandEntry[]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CommandPaletteProvider>
        <Harness entries={entries} />
        <CommandPalette />
      </CommandPaletteProvider>
    </I18nextProvider>,
  )
}

describe('CommandPalette', () => {
  it('opens on ⌘K and lists registered entries grouped by group', async () => {
    const user = userEvent.setup()
    const perform: Mock = vi.fn()

    mount([{ id: 'go-dashboard', label: 'Open Dashboard', group: 'Routes', perform }])

    expect(screen.queryByText('Open Dashboard')).toBeNull()

    await user.keyboard('{Meta>}k{/Meta}')

    expect(await screen.findByText('Open Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Routes')).toBeInTheDocument()
  })

  it('invokes the entry perform callback when selected', async () => {
    const user = userEvent.setup()
    const perform: Mock = vi.fn()

    mount([{ id: 'go-dashboard', label: 'Open Dashboard', group: 'Routes', perform }])

    await user.keyboard('{Meta>}k{/Meta}')
    const item = await screen.findByText('Open Dashboard')
    await user.click(item)

    await waitFor(() => {
      expect(perform).toHaveBeenCalledTimes(1)
    })
  })
})
