import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isInIframe,
  postNavigate,
  postReady,
  postResize,
  subscribeToHost,
} from '@/platform/embed/host'

vi.mock('@/config/env', () => ({
  env: {
    EMBED_HOST_ORIGIN: 'https://hix.example.com',
  },
}))

const HOST_ORIGIN = 'https://hix.example.com'

describe('embed host bridge', () => {
  let postMessageSpy: ReturnType<typeof vi.fn>
  let originalParent: Window
  let originalSelf: Window

  beforeEach(() => {
    postMessageSpy = vi.fn()
    originalParent = window.parent
    originalSelf = window.self
    // simulate iframe context: self !== top, parent has postMessage
    const fakeParent = { postMessage: postMessageSpy } as unknown as Window
    Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true })
    Object.defineProperty(window, 'top', { value: fakeParent, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: originalParent, configurable: true })
    Object.defineProperty(window, 'top', { value: originalSelf, configurable: true })
    vi.restoreAllMocks()
  })

  it('detects iframe context', () => {
    expect(isInIframe()).toBe(true)
  })

  it('posts ready/resize/navigate to the configured host origin', () => {
    postReady()
    postResize(420)
    postNavigate('/embed/tasks')

    expect(postMessageSpy).toHaveBeenCalledTimes(3)
    expect(postMessageSpy).toHaveBeenNthCalledWith(
      1,
      { source: 'zas-embed', type: 'ready' },
      HOST_ORIGIN,
    )
    expect(postMessageSpy).toHaveBeenNthCalledWith(
      2,
      { source: 'zas-embed', type: 'resize', height: 420 },
      HOST_ORIGIN,
    )
    expect(postMessageSpy).toHaveBeenNthCalledWith(
      3,
      { source: 'zas-embed', type: 'navigate', path: '/embed/tasks' },
      HOST_ORIGIN,
    )
  })

  it('dispatches inbound host-navigate messages from the configured origin', () => {
    const handler = vi.fn()
    const unsubscribe = subscribeToHost(handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: HOST_ORIGIN,
        data: { source: 'zas-embed', type: 'host-navigate', path: '/embed/patients' },
      }),
    )

    expect(handler).toHaveBeenCalledWith({
      source: 'zas-embed',
      type: 'host-navigate',
      path: '/embed/patients',
    })

    unsubscribe()
  })

  it('ignores messages from a different origin', () => {
    const handler = vi.fn()
    const unsubscribe = subscribeToHost(handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://attacker.example',
        data: { source: 'zas-embed', type: 'host-navigate', path: '/embed/patients' },
      }),
    )

    expect(handler).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('ignores messages without the zas-embed source marker', () => {
    const handler = vi.fn()
    const unsubscribe = subscribeToHost(handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: HOST_ORIGIN,
        data: { source: 'other-extension', type: 'host-navigate', path: '/' },
      }),
    )

    expect(handler).not.toHaveBeenCalled()
    unsubscribe()
  })
})
