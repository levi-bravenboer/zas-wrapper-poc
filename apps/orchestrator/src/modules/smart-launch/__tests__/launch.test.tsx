import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SmartLaunchNotImplementedError, exchangeAuthCode } from '../api'
import { useLaunchContext } from '../hooks'
import { launchSearchSchema } from '../schemas'
import { useLaunchStore } from '../store'

describe('smart-launch validation', () => {
  it('parses valid SMART params', () => {
    const parsed = launchSearchSchema.parse({
      iss: 'https://fhir.example.org',
      launch: 'abc123',
      state: 'xyz',
    })
    expect(parsed.iss).toBe('https://fhir.example.org')
    expect(parsed.launch).toBe('abc123')
    expect(parsed.state).toBe('xyz')
  })

  it('rejects an invalid iss URL', () => {
    const parsed = launchSearchSchema.safeParse({ iss: 'not-a-url', launch: 'abc' })
    expect(parsed.success).toBe(false)
  })

  it('stores context in zustand', () => {
    useLaunchStore.getState().setContext({ iss: 'https://x.y', launch: 'l' })
    expect(useLaunchStore.getState().context?.launch).toBe('l')
    useLaunchStore.getState().clear()
    expect(useLaunchStore.getState().context).toBeNull()
  })

  it('exposes context through useLaunchContext', () => {
    useLaunchStore.getState().setContext({ iss: 'https://a.b', launch: 'L1' })
    const { result } = renderHook(() => useLaunchContext())
    expect(result.current?.launch).toBe('L1')
    useLaunchStore.getState().clear()
  })

  it('exchangeAuthCode throws SmartLaunchNotImplementedError', async () => {
    await expect(exchangeAuthCode({ code: 'c', state: 's' })).rejects.toBeInstanceOf(
      SmartLaunchNotImplementedError,
    )
  })
})
