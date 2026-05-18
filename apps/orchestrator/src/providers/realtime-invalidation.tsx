import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { env } from '@/config/env'
import { i18n } from '@/lib/i18n'
import { toast } from '@/lib/notifications/toast'
import { useSession } from '@/modules/auth/hooks'

import {
  RealtimeInvalidationContext,
  type RealtimeEvent,
  type RealtimeInvalidationContextValue,
  type RealtimeStatus,
} from './realtime-invalidation-context'

/**
 * Realtime invalidation provider — opens a single SSE connection to
 * `${API_BASE_URL}/events` while the user has an active session and turns
 * incoming `RealtimeEvent` messages into `queryClient.invalidateQueries`
 * calls keyed by `[event.resource]`.
 *
 * Auth gating uses {@link useSession} (apps/orchestrator/src/modules/auth/hooks.ts).
 * The connection only opens when `session.data` is non-null and closes when
 * the session disappears (logout, 401).
 *
 * Reconnect handling relies on the native `EventSource` retry behaviour. We
 * track the timestamps of `error` events within a rolling 60s window. Once
 * ≥5 failures occur in that window we surface a warning toast and flip the
 * query-client default `refetchOnWindowFocus` to true so users still get
 * fresh data when they refocus the tab.
 *
 * The `useRealtimeInvalidation` hook and the `RealtimeEvent`,
 * `RealtimeStatus`, `RealtimeInvalidationContextValue` types live in
 * `./realtime-invalidation-context` — import them from there directly.
 */

const FAILURE_WINDOW_MS = 60_000
const FAILURE_THRESHOLD = 5

// Module-level singleton guard. Ensures that even if the provider is mounted
// more than once (StrictMode double-invocation, accidental double-mount) we
// only ever hold a single live EventSource against the backend.
let activeConnections = 0

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.resource === 'string' &&
    (v.action === 'upsert' || v.action === 'delete') &&
    (typeof v.id === 'string' || v.id === null) &&
    typeof v.v === 'number'
  )
}

export function RealtimeInvalidationProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const queryClient = useQueryClient()
  const session = useSession()
  const hasSession = session.data != null
  const [status, setStatus] = React.useState<RealtimeStatus>('idle')

  React.useEffect(() => {
    if (!hasSession) {
      return
    }
    if (typeof globalThis.EventSource === 'undefined') {
      // Environments without EventSource (some test setups) — stay idle.
      return
    }
    if (activeConnections > 0) {
      // Another instance already owns the singleton connection. Stay idle but
      // do not open a duplicate.
      return
    }

    activeConnections += 1
    // Defer state transition out of the render phase so React Compiler's
    // set-state-in-effect rule stays satisfied. The 'connecting' status is
    // transient — it will be replaced by 'open' (or 'offline') as soon as the
    // EventSource fires its first event.
    queueMicrotask(() => setStatus('connecting'))

    const url = `${env.API_BASE_URL}/events`
    const source = new EventSource(url, { withCredentials: true })
    const failureTimestamps: number[] = []
    let warned = false

    const handleOpen = () => {
      setStatus('open')
    }

    const handleMessage = (event: MessageEvent<string>) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }
      if (!isRealtimeEvent(parsed)) return
      void queryClient.invalidateQueries({ queryKey: [parsed.resource], exact: false })
    }

    const handleError = () => {
      setStatus('offline')
      const now = Date.now()
      failureTimestamps.push(now)
      // Drop anything older than the rolling window.
      while (failureTimestamps.length && now - failureTimestamps[0]! > FAILURE_WINDOW_MS) {
        failureTimestamps.shift()
      }
      if (!warned && failureTimestamps.length >= FAILURE_THRESHOLD) {
        warned = true
        // Make sure user still gets fresh data on tab refocus while SSE is down.
        queryClient.setDefaultOptions({
          ...queryClient.getDefaultOptions(),
          queries: {
            ...queryClient.getDefaultOptions().queries,
            refetchOnWindowFocus: true,
          },
        })
        toast.warning(i18n.t('realtime.offline', { ns: 'data-table' }), {
          id: 'data-table.realtime.offline',
        })
      }
    }

    source.addEventListener('open', handleOpen)
    source.addEventListener('message', handleMessage)
    source.addEventListener('error', handleError)

    return () => {
      source.removeEventListener('open', handleOpen)
      source.removeEventListener('message', handleMessage)
      source.removeEventListener('error', handleError)
      source.close()
      activeConnections = Math.max(0, activeConnections - 1)
      setStatus('idle')
    }
  }, [hasSession, queryClient])

  const value = React.useMemo<RealtimeInvalidationContextValue>(
    () => ({ register: () => () => undefined, status }),
    [status],
  )

  return (
    <RealtimeInvalidationContext.Provider value={value}>
      {children}
    </RealtimeInvalidationContext.Provider>
  )
}
