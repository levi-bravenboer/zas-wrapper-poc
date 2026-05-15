import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useLaunchStore } from '@/modules/smart-launch/store'
import { SmartShell } from '@/platform/embed/SmartShell'

import { mountShellWithTasks, seedSmartLaunchSession } from './shellTestUtils'

describe('SmartShell', () => {
  beforeEach(() => {
    seedSmartLaunchSession()
  })
  afterEach(() => {
    useLaunchStore.getState().clear()
  })

  it('mounts the menu shell (sidebar present) alongside the active route', async () => {
    const { container } = mountShellWithTasks(SmartShell, '/tasks')

    expect(await screen.findByRole('heading', { name: 'Taken' })).toBeInTheDocument()
    /* eslint-disable testing-library/no-node-access -- attribute selectors lack a semantic Testing Library equivalent */
    expect(container.querySelector('[data-shell="menu"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="sidebar"]')).not.toBeNull()
    /* eslint-enable testing-library/no-node-access */
  })
})
