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

  it('renders the active route inside the bare embed main without a sidebar', async () => {
    mountShellWithTasks(EmbedShell, '/tasks')

    expect(await screen.findByRole('heading', { name: 'Taken' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'primary' })).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('data-embed', 'hix')
  })
})
