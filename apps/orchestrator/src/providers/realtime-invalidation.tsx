import * as React from 'react'

/**
 * Stub. Real impl (SSE subscriber + topic→queryKey invalidation map)
 * lands with §12. Provider mounts now so children can `useRealtimeInvalidation()`
 * without crashing during the parallel build-out.
 */

export interface RealtimeInvalidationContextValue {
  register: (topic: string, queryKeys: ReadonlyArray<readonly unknown[]>) => () => void
  status: 'idle' | 'connecting' | 'open' | 'offline'
}

const noopRegister: RealtimeInvalidationContextValue['register'] = () => () => undefined

const RealtimeInvalidationContext = React.createContext<RealtimeInvalidationContextValue>({
  register: noopRegister,
  status: 'idle',
})

export function RealtimeInvalidationProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const value = React.useMemo<RealtimeInvalidationContextValue>(
    () => ({ register: noopRegister, status: 'idle' }),
    [],
  )
  return (
    <RealtimeInvalidationContext.Provider value={value}>
      {children}
    </RealtimeInvalidationContext.Provider>
  )
}

export function useRealtimeInvalidation(): RealtimeInvalidationContextValue {
  return React.useContext(RealtimeInvalidationContext)
}
