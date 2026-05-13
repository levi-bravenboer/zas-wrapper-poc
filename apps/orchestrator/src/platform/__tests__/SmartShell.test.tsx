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

  it('renders the primary sidebar alongside the active route', async () => {
    mountShellWithTasks(SmartShell, '/tasks')

    expect(await screen.findByRole('navigation', { name: 'primary' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Taken' })).toBeInTheDocument()
  })
})
