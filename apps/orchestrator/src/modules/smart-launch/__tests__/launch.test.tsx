import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useLaunchContext } from '../hooks'
import { launchSearchSchema } from '../schemas'
import { useLaunchStore } from '../store'

afterEach(() => {
  useLaunchStore.getState().clear()
})

describe('smart-launch validation', () => {
  it('parses valid SMART params and defaults surface to smart', () => {
    const parsed = launchSearchSchema.parse({
      iss: 'https://fhir.example.org',
      launch: 'abc123',
      state: 'xyz',
    })
    expect(parsed.iss).toBe('https://fhir.example.org')
    expect(parsed.launch).toBe('abc123')
    expect(parsed.state).toBe('xyz')
    expect(parsed.surface).toBe('smart')
  })

  it('accepts surface=embed and a return path', () => {
    const parsed = launchSearchSchema.parse({
      iss: 'https://fhir.example.org',
      launch: 'abc',
      surface: 'embed',
      return: '/embed/tasks',
    })
    expect(parsed.surface).toBe('embed')
    expect(parsed.return).toBe('/embed/tasks')
  })

  it('rejects an invalid iss URL', () => {
    const parsed = launchSearchSchema.safeParse({ iss: 'not-a-url', launch: 'abc' })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown surface value', () => {
    const parsed = launchSearchSchema.safeParse({
      iss: 'https://a.b',
      launch: 'l',
      surface: 'app',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a return path that is not absolute', () => {
    const parsed = launchSearchSchema.safeParse({
      iss: 'https://a.b',
      launch: 'l',
      return: 'embed/tasks',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('launch store', () => {
  it('seeds context from a parsed launch search', () => {
    useLaunchStore.getState().setFromSearch({
      iss: 'https://x.y',
      launch: 'l',
      surface: 'embed',
      return: '/embed/tasks',
    })
    const ctx = useLaunchStore.getState().context
    expect(ctx?.surface).toBe('embed')
    expect(ctx?.returnPath).toBe('/embed/tasks')
    expect(ctx?.client).toBeNull()
    expect(ctx?.token).toBeNull()
  })

  it('clears context', () => {
    useLaunchStore.getState().setFromSearch({
      iss: 'https://a.b',
      launch: 'L1',
      surface: 'smart',
    })
    useLaunchStore.getState().clear()
    expect(useLaunchStore.getState().context).toBeNull()
  })

  it('exposes context through useLaunchContext', () => {
    useLaunchStore.getState().setFromSearch({
      iss: 'https://a.b',
      launch: 'L1',
      surface: 'smart',
    })
    const { result } = renderHook(() => useLaunchContext())
    expect(result.current?.launch).toBe('L1')
  })
})
