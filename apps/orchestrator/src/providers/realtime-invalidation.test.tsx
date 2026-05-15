import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as authHooks from '@/modules/auth/hooks'

import { RealtimeInvalidationProvider } from './realtime-invalidation'

type FakeListener = (event: Event | MessageEvent) => void

class FakeEventSource {
  static instances: FakeEventSource[] = []

  readonly url: string
  readonly withCredentials: boolean
  readonly listeners: Record<string, FakeListener[]> = {}
  closed = false

  constructor(url: string, init?: EventSourceInit) {
    this.url = url
    this.withCredentials = init?.withCredentials ?? false
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: FakeListener): void {
    ;(this.listeners[type] ??= []).push(listener)
  }

  removeEventListener(type: string, listener: FakeListener): void {
    const arr = this.listeners[type]
    if (!arr) return
    this.listeners[type] = arr.filter((l) => l !== listener)
  }

  dispatch(type: string, event: Event | MessageEvent): void {
    for (const l of this.listeners[type] ?? []) l(event)
  }

  emitOpen(): void {
    this.dispatch('open', new Event('open'))
  }

  emitMessage(payload: unknown): void {
    const ev = new MessageEvent('message', { data: JSON.stringify(payload) })
    this.dispatch('message', ev)
  }

  emitError(): void {
    this.dispatch('error', new Event('error'))
  }

  close(): void {
    this.closed = true
  }

  static reset(): void {
    FakeEventSource.instances = []
  }
}

const sessionUser = {
  id: 'u1',
  email: 'a@b.co',
  displayName: 'A',
  roles: ['clinician'],
}

function mockSession(value: typeof sessionUser | null): void {
  vi.spyOn(authHooks, 'useSession').mockReturnValue({
    data: value,
    isSuccess: true,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof authHooks.useSession>)
}

const warningSpy = vi.fn()

vi.mock('@/lib/notifications/toast', () => ({
  toast: {
    warning: (...args: unknown[]) => warningSpy(...args),
  },
}))

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  })
}

function wrap(client: QueryClient, children: React.ReactNode): React.ReactElement {
  return (
    <QueryClientProvider client={client}>
      <RealtimeInvalidationProvider>{children}</RealtimeInvalidationProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  FakeEventSource.reset()
  warningSpy.mockReset()
  ;(globalThis as unknown as { EventSource: typeof FakeEventSource }).EventSource =
    FakeEventSource
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (globalThis as { EventSource?: unknown }).EventSource
})

describe('RealtimeInvalidationProvider', () => {
  it('opens exactly one EventSource even when mounted twice', () => {
    mockSession(sessionUser)
    const client = makeClient()
    const { unmount: u1 } = render(wrap(client, <div>one</div>))
    const { unmount: u2 } = render(wrap(client, <div>two</div>))

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]!.url).toMatch(/\/events$/)
    expect(FakeEventSource.instances[0]!.withCredentials).toBe(true)

    u1()
    u2()
  })

  it('invalidates queries on incoming RealtimeEvent messages', () => {
    mockSession(sessionUser)
    const client = makeClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { unmount } = render(wrap(client, <div />))

    const es = FakeEventSource.instances[0]!
    act(() => {
      es.emitOpen()
      es.emitMessage({ resource: 'Patient', action: 'upsert', id: 'p1', v: 3 })
    })

    expect(spy).toHaveBeenCalledWith({ queryKey: ['Patient'], exact: false })
    unmount()
  })

  it('shows the offline warning after 5 errors inside 60s', () => {
    mockSession(sessionUser)
    const client = makeClient()
    const { unmount } = render(wrap(client, <div />))
    const es = FakeEventSource.instances[0]!

    act(() => {
      for (let i = 0; i < 5; i += 1) {
        es.emitError()
        vi.advanceTimersByTime(1_000)
      }
    })

    expect(warningSpy).toHaveBeenCalledTimes(1)
    const [, opts] = warningSpy.mock.calls[0]! as [string, { id?: string }]
    expect(opts?.id).toBe('data-table.realtime.offline')
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true)
    unmount()
  })

  it('does not warn if 5 errors are spread beyond the 60s window', () => {
    mockSession(sessionUser)
    const client = makeClient()
    const { unmount } = render(wrap(client, <div />))
    const es = FakeEventSource.instances[0]!

    act(() => {
      for (let i = 0; i < 5; i += 1) {
        es.emitError()
        vi.advanceTimersByTime(30_000)
      }
    })

    expect(warningSpy).not.toHaveBeenCalled()
    unmount()
  })

  it('does not open a connection when the session is absent', () => {
    mockSession(null)
    const client = makeClient()
    const { unmount } = render(wrap(client, <div />))
    expect(FakeEventSource.instances).toHaveLength(0)
    unmount()
  })

  it('closes the EventSource on unmount (logout flow)', () => {
    mockSession(sessionUser)
    const client = makeClient()
    const { unmount } = render(wrap(client, <div />))
    const es = FakeEventSource.instances[0]!
    expect(es.closed).toBe(false)
    unmount()
    expect(es.closed).toBe(true)
  })
})
