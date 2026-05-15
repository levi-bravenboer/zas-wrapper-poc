import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useLaunchStore } from '@/modules/smart-launch/store'
import { EmbedShell } from '@/platform/embed/EmbedShell'

import { mountShellWithTasks, seedSmartLaunchSession } from './shellTestUtils'

describe('EmbedShell', () => {
  beforeEach(() => {
    seedSmartLaunchSession()
  })
  afterEach(() => {
    useLaunchStore.getState().clear()
  })

  it('renders the active route inside the bare shell without a sidebar', async () => {
    const { container } = mountShellWithTasks(EmbedShell, '/tasks')

    expect(await screen.findByRole('heading', { name: 'Taken' })).toBeInTheDocument()

    /* eslint-disable testing-library/no-node-access -- attribute selectors lack a semantic Testing Library equivalent */
    const bare = container.querySelector('[data-shell="bare"]')
    expect(bare).not.toBeNull()
    expect(bare?.getAttribute('data-surface')).toBe('embed')

    expect(container.querySelector('[data-slot="sidebar"]')).toBeNull()
    expect(container.querySelector('[data-shell="menu"]')).toBeNull()
    /* eslint-enable testing-library/no-node-access */
  })
})
